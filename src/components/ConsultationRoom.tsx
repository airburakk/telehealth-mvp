"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { urgencyStyle } from "@/lib/constants";
import {
  Video, VideoOff, Mic, MicOff, PhoneOff, Camera, Sparkles, FileText,
  Save, Check, Pill, FlaskConical, Stethoscope, AlertTriangle, Languages, Loader2, Luggage,
  Copy, Wifi, WifiOff, UserRound,
} from "lucide-react";

interface CaseData {
  id: string; patientName: string; country: string; language: string;
  branch: string; urgency: number; confidence: number; symptoms: string; reasoning: string; files: string[];
}
interface DoctorData { title: string; name: string; branch: string; color: string; }
type Phase = "connecting" | "waiting" | "connected" | "ended" | "error";

export function ConsultationRoom({
  consultationId, selfRole, status, initialNotes, doctor, caseData,
}: {
  consultationId: string; selfRole: "doctor" | "patient"; status: string;
  initialNotes: string; doctor: DoctorData; caseData: CaseData;
}) {
  const router = useRouter();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const [phase, setPhase] = useState<Phase>(status === "ENDED" ? "ended" : "connecting");
  const [errMsg, setErrMsg] = useState("");
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [remoteOn, setRemoteOn] = useState(false);
  const [notes, setNotes] = useState(initialNotes);
  const [saved, setSaved] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ending, setEnding] = useState(false);
  const [copied, setCopied] = useState(false);
  const [joined, setJoined] = useState(false);
  const [retry, setRetry] = useState(0);
  const [connState, setConnState] = useState("");

  const isDoctor = selfRole === "doctor";
  const u = urgencyStyle(caseData.urgency);
  const remoteName = isDoctor ? caseData.patientName : `${doctor.title} ${doctor.name}`;

  useEffect(() => {
    if (status === "ENDED" || !joined) return;
    let polling = true;
    let lastId = 0;
    let remoteDescSet = false;
    const pendingIce: RTCIceCandidateInit[] = [];

    async function send(kind: string, data: unknown) {
      try {
        await fetch(`/api/consultations/${consultationId}/signal`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sender: selfRole, kind, data: JSON.stringify(data) }),
        });
      } catch {}
    }

    async function poll(pc: RTCPeerConnection) {
      while (polling) {
        try {
          const res = await fetch(`/api/consultations/${consultationId}/signal?role=${selfRole}&after=${lastId}`);
          const msgs: { id: number; kind: string; data: string }[] = await res.json();
          for (const m of msgs) {
            lastId = Math.max(lastId, m.id);
            try {
              const data = JSON.parse(m.data);
              if (m.kind === "offer" && selfRole === "patient") {
                await pc.setRemoteDescription(new RTCSessionDescription(data));
                remoteDescSet = true;
                for (const c of pendingIce.splice(0)) { try { await pc.addIceCandidate(c); } catch {} }
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                await send("answer", answer);
              } else if (m.kind === "answer" && selfRole === "doctor") {
                await pc.setRemoteDescription(new RTCSessionDescription(data));
                remoteDescSet = true;
                for (const c of pendingIce.splice(0)) { try { await pc.addIceCandidate(c); } catch {} }
              } else if (m.kind === "ice") {
                if (data) { if (remoteDescSet) { try { await pc.addIceCandidate(data); } catch {} } else pendingIce.push(data); }
              } else if (m.kind === "bye") {
                setRemoteOn(false); setPhase("ended");
              }
            } catch {}
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 1200));
      }
    }

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setErrMsg("Bu tarayıcı kamera erişimini desteklemiyor. Linki uygulama içinde değil, Chrome veya Safari'de açın. [desteksiz]");
        setPhase("error"); return;
      }
      // Esnek edinim: kamera+mik → sadece mik (kamerasız cihaz) → yalnız izleme
      let stream: MediaStream | null = null;
      let lastErr = "";
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch (e) {
        lastErr = (e as DOMException)?.name || "";
        if (lastErr === "NotFoundError" || lastErr === "OverconstrainedError" || lastErr === "NotReadableError") {
          try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); lastErr = ""; }
          catch (e2) { lastErr = (e2 as DOMException)?.name || lastErr; }
        }
      }
      if (!stream && (lastErr === "NotAllowedError" || lastErr === "SecurityError")) {
        setErrMsg(`İzin reddedildi/engellendi. Kilit simgesinden Kamera ve Mikrofon'a izin verip tekrar deneyin. [${lastErr}]`);
        setPhase("error"); return;
      }
      const hasVideo = !!stream && stream.getVideoTracks().length > 0;
      const hasAudio = !!stream && stream.getAudioTracks().length > 0;
      localStreamRef.current = stream;
      setCamOn(hasVideo);
      setMicOn(hasAudio);
      if (!hasVideo) {
        setErrMsg(hasAudio
          ? "Bu cihazda kamera yok — sesli katıldınız; karşı tarafı görebilirsiniz."
          : `Kamera/mikrofon yok — yalnızca izleme modundasınız. [${lastErr || "cihaz yok"}]`);
      }
      if (stream && localVideoRef.current) { localVideoRef.current.srcObject = stream; localVideoRef.current.play().catch(() => {}); }

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          // Ücretsiz public TURN (OpenRelay) — mobil/symmetric NAT için relay
          { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
          { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
          { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
        ],
      });
      pcRef.current = pc;
      if (stream) stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      // Kamera/mik yoksa karşı tarafın yayınını alabilmek için alıcı kanal ekle
      if (!hasVideo) { try { pc.addTransceiver("video", { direction: "recvonly" }); } catch {} }
      if (!hasAudio) { try { pc.addTransceiver("audio", { direction: "recvonly" }); } catch {} }
      pc.ontrack = (e) => {
        if (remoteVideoRef.current) { remoteVideoRef.current.srcObject = e.streams[0]; remoteVideoRef.current.play().catch(() => {}); }
        setRemoteOn(true);
      };
      pc.onicecandidate = (e) => { if (e.candidate) send("ice", e.candidate.toJSON()); };
      pc.onconnectionstatechange = () => {
        const s = pc.connectionState;
        setConnState(s);
        if (s === "connected") { setPhase("connected"); setErrMsg(""); }
        else if (s === "failed") setErrMsg("Bağlantı kurulamadı (ağ/NAT). En garantisi: iki cihazı aynı Wi-Fi'ya alın, sonra yenileyin.");
      };
      pc.oniceconnectionstatechange = () => setConnState(pc.iceConnectionState);

      setPhase("waiting");
      if (selfRole === "doctor") {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await send("offer", offer);
      }
      poll(pc);
    })();

    return () => {
      polling = false;
      pcRef.current?.close();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [consultationId, selfRole, status, joined, retry]);

  function toggleCam() { const t = localStreamRef.current?.getVideoTracks()[0]; if (t) { t.enabled = !t.enabled; setCamOn(t.enabled); } }
  function toggleMic() { const t = localStreamRef.current?.getAudioTracks()[0]; if (t) { t.enabled = !t.enabled; setMicOn(t.enabled); } }

  async function saveNotes() {
    setSaving(true);
    try {
      await fetch(`/api/consultations/${consultationId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes }) });
      setSaved(true);
    } finally { setSaving(false); }
  }

  async function copyPatientLink() {
    const url = `${window.location.origin}/gorusme/${consultationId}?role=patient`;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  }

  async function endCall() {
    setEnding(true);
    try {
      await fetch(`/api/consultations/${consultationId}/signal`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sender: selfRole, kind: "bye", data: "null" }) });
    } catch {}
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    if (isDoctor) {
      try { await fetch(`/api/consultations/${consultationId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes, status: "ENDED" }) }); } catch {}
      router.push(`/doktor/vaka/${caseData.id}`);
    } else {
      router.push(`/triyaj`);
    }
  }

  const statusLabel = !joined
    ? "Katılmaya hazır"
    : phase === "connected" ? "Bağlandı"
    : phase === "waiting" ? "Karşı taraf bekleniyor…"
    : phase === "connecting" ? "Kamera açılıyor…"
    : phase === "ended" ? "Görüşme sona erdi" : "Hata";

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span className={`inline-flex h-2.5 w-2.5 rounded-full ${phase === "connected" ? "bg-emerald-500" : phase === "ended" || phase === "error" ? "bg-slate-400" : "bg-amber-500 animate-pulse"}`} />
          {statusLabel} · {isDoctor ? "Doktor görünümü" : "Hasta görünümü"}{connState ? ` · ${connState}` : ""}
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
          {phase === "connected" ? <Wifi size={13} /> : <WifiOff size={13} />} Gerçek WebRTC (P2P)
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* Video alanı */}
        <div className="space-y-3">
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-slate-900 shadow-lg">
            {/* Uzak taraf (gerçek video) */}
            <video ref={remoteVideoRef} autoPlay playsInline className={`h-full w-full object-cover ${remoteOn ? "" : "hidden"}`} />
            {!remoteOn && (
              <div className="absolute inset-0 grid place-items-center p-4 text-center">
                {!joined ? (
                  <div>
                    <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/10 text-white"><Camera size={28} /></span>
                    <h3 className="mt-3 text-lg font-semibold text-white">Görüşmeye katılın</h3>
                    <p className="mx-auto mt-1 max-w-xs text-sm text-white/60">Bağlanmak için kamera ve mikrofon izni vermeniz gerekir.</p>
                    <button onClick={() => { setErrMsg(""); setPhase("connecting"); setJoined(true); }} className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
                      <Video size={17} /> Kamera & mikrofonla katıl
                    </button>
                  </div>
                ) : phase === "error" ? (
                  <div>
                    <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-amber-500/20 text-amber-300"><AlertTriangle size={28} /></span>
                    <p className="mx-auto mt-3 max-w-xs text-sm text-white/85">{errMsg || "Kamera/mikrofona erişilemedi."}</p>
                    <p className="mx-auto mt-1 max-w-xs text-xs text-white/50">Adres çubuğundaki kilit/kamera simgesine dokunup Kamera ve Mikrofon&apos;a &quot;İzin ver&quot; deyin, sonra tekrar deneyin.</p>
                    <button onClick={() => { setErrMsg(""); setPhase("connecting"); setRetry((r) => r + 1); }} className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-100">
                      Tekrar dene
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-white/10 text-2xl font-bold text-white">{remoteName.slice(0, 1)}</div>
                    <div className="mt-3 font-medium text-white/90">{remoteName}</div>
                    <div className="text-xs text-white/50">{phase === "waiting" ? "karşı taraf bekleniyor…" : "kamera açılıyor…"}</div>
                    <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs text-white/70"><Languages size={13} /> Canlı çeviri: {caseData.language} ⇄ Türkçe (demo)</div>
                  </div>
                )}
              </div>
            )}

            {/* Yerel self-view */}
            {joined && (
              <div className="absolute bottom-3 right-3 h-28 w-44 overflow-hidden rounded-xl border border-white/20 bg-black/60 shadow-lg">
                <video ref={localVideoRef} autoPlay muted playsInline className={`h-full w-full object-cover ${camOn ? "" : "hidden"}`} />
                {!camOn && <div className="grid h-full place-items-center text-center text-[11px] text-white/50"><div><Camera size={18} className="mx-auto mb-1" /> Kamera kapalı</div></div>}
                <span className="absolute left-1.5 top-1.5 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white/80">Siz</span>
              </div>
            )}

            {/* Kontroller */}
            {joined && (
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2">
                <button onClick={toggleCam} className={`grid h-11 w-11 place-items-center rounded-full ${camOn ? "bg-white/15 text-white hover:bg-white/25" : "bg-white text-slate-800"}`}>
                  {camOn ? <Video size={18} /> : <VideoOff size={18} />}
                </button>
                <button onClick={toggleMic} className={`grid h-11 w-11 place-items-center rounded-full ${micOn ? "bg-white/15 text-white hover:bg-white/25" : "bg-white text-slate-800"}`}>
                  {micOn ? <Mic size={18} /> : <MicOff size={18} />}
                </button>
                <button onClick={endCall} disabled={ending} className="inline-flex h-11 items-center gap-2 rounded-full bg-red-600 px-5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                  {ending ? <Loader2 size={17} className="animate-spin" /> : <PhoneOff size={17} />} Bitir
                </button>
              </div>
            )}
          </div>

          {errMsg && <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 ring-1 ring-amber-200">{errMsg}</div>}

          {/* Doktor: hasta bağlantısı paylaş */}
          {isDoctor && (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-sky-200 bg-sky-50/60 p-3">
              <div className="text-sm text-slate-600">
                <span className="font-semibold text-sky-800">Hastayı davet et:</span> bu görüşme bağlantısını hastayla paylaş.
              </div>
              <button onClick={copyPatientLink} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-medium text-sky-700 ring-1 ring-sky-200 hover:bg-sky-100">
                {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Kopyalandı" : "Hasta linkini kopyala"}
              </button>
            </div>
          )}

          {isDoctor && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
              <div className="text-sm text-amber-800"><span className="font-semibold">AI Kritik Uyarı (demo):</span> Hasta dosyasında alerji/ilaç etkileşimi taranıyor.</div>
            </div>
          )}
        </div>

        {/* Sağ panel */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-800">{caseData.patientName}</h2>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${u.badge}`}>
                <span className={`h-2 w-2 rounded-full ${u.dot}`} /> {caseData.urgency}/5
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-sm">
              <Stethoscope size={14} className="text-[#16467a]" />
              <span className="font-medium text-[#16467a]">{caseData.branch}</span>
            </div>
            <div className="mt-3">
              <div className="text-xs uppercase tracking-wide text-slate-400">Şikayet</div>
              <p className="mt-1 text-sm text-slate-700">{caseData.symptoms}</p>
            </div>
            {isDoctor && (
              <div className="mt-3 rounded-lg bg-sky-50/70 p-3 ring-1 ring-sky-100">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-sky-700"><Sparkles size={13} /> AI özeti</div>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{caseData.reasoning}</p>
              </div>
            )}
            {!isDoctor && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 ring-1 ring-emerald-100">
                <UserRound size={15} /> {doctor.title} {doctor.name} ile görüşüyorsunuz
              </div>
            )}
            {caseData.files.length > 0 && isDoctor && (
              <div className="mt-3">
                <div className="text-xs uppercase tracking-wide text-slate-400">Belgeler</div>
                <ul className="mt-1.5 space-y-1">
                  {caseData.files.map((f) => <li key={f} className="flex items-center gap-1.5 text-xs text-slate-600"><FileText size={13} className="text-sky-600" /> {f}</li>)}
                </ul>
              </div>
            )}
          </div>

          {/* Not paneli — yalnız doktor */}
          {isDoctor && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Görüşme Notları</div>
                {saved ? <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600"><Check size={13} /> kaydedildi</span> : <span className="text-[11px] text-amber-600">kaydedilmedi</span>}
              </div>
              <textarea value={notes} onChange={(e) => { setNotes(e.target.value); setSaved(false); }} rows={5} placeholder="SOAP notu…" className="mt-2 w-full resize-none rounded-lg border border-slate-300 p-2.5 text-sm outline-none focus:border-[#0f2a4a]" />
              <button onClick={saveNotes} disabled={saving || saved} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0f2a4a] px-3 py-2 text-sm font-semibold text-white hover:bg-[#143a63] disabled:opacity-50">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Notu kaydet
              </button>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <QuickAction icon={<Pill size={14} />}>Reçete</QuickAction>
                <QuickAction icon={<FlaskConical size={14} />}>Lab iste</QuickAction>
              </div>
            </div>
          )}

          {isDoctor && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Tedavi Kararı</div>
              <button onClick={() => router.push(`/paket/${caseData.id}`)} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
                <Luggage size={16} /> Sağlık Turizmi Paketi
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function QuickAction({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-400" title="Yakında">
      {icon} {children}
    </button>
  );
}
