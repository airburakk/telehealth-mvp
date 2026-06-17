"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { urgencyStyle } from "@/lib/constants";
import { TranslateButton } from "@/components/TranslateButton";
import { LiveInterpreter } from "@/components/LiveInterpreter";
import { ConsultationTimer } from "@/components/ConsultationTimer";
import RecommendedTreatments from "@/components/RecommendedTreatments";
import DicomViewer from "@/components/DicomViewer";
import { getIceServers } from "@/lib/ice";
import {
  Video, VideoOff, Mic, MicOff, PhoneOff, Camera, Sparkles, FileText,
  Save, Check, Pill, FlaskConical, Stethoscope, AlertTriangle, Languages, Loader2, Luggage,
  Copy, Wifi, WifiOff, UserRound, MessageSquareText, FileImage,
} from "lucide-react";

interface CaseData {
  id: string; patientName: string; country: string; language: string;
  branch: string; urgency: number; confidence: number; symptoms: string; reasoning: string; files: string[];
}
interface DoctorData { title: string; name: string; branch: string; color: string; }
type Phase = "connecting" | "waiting" | "connected" | "ended" | "error";

// M2→M3 tavsiye edilen tedaviler için doktorun branş listesi + M5 fiyatları
interface RecProc { code: string; name: string; price: number | null; branch: string; group: string }
interface RecommendData {
  branchLabel: string;
  branchProcedures: RecProc[];
  doctorPrices: Record<string, number>;
  initial: { code: string; name: string; priceTRY: number }[];
  rate: number; // güncel USD/₺ (≈$ gösterimi için)
}

// ── Canlı transkript (Web Speech API) ──
interface TLine { who: "doctor" | "patient"; text: string; ts: number }

// Tarayıcı SpeechRecognition için minimal tip (standart DOM tiplerinde tam yok)
type AnySpeechRecognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  start: () => void; stop: () => void;
};
function getSpeechRecognition(): (new () => AnySpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => AnySpeechRecognition) | null;
}

// Hasta kendi dilinde konuşur → tanıyıcıya BCP-47 kodu
const SPEECH_LANG: Record<string, string> = {
  "Türkçe": "tr-TR", "Rusça": "ru-RU", "Arapça": "ar-SA", "Azerice": "az-AZ",
  "İngilizce": "en-US", "Fransızca": "fr-FR", "Almanca": "de-DE", "Kazakça": "kk-KZ", "Kırgızca": "ky-KG",
};

export function ConsultationRoom({
  consultationId, selfRole, status, initialNotes, doctor, caseData, recommend,
}: {
  consultationId: string; selfRole: "doctor" | "patient"; status: string;
  initialNotes: string; doctor: DoctorData; caseData: CaseData; recommend?: RecommendData;
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
  const [showDicom, setShowDicom] = useState(false);
  const [joined, setJoined] = useState(false);
  const [retry, setRetry] = useState(0);
  const [connState, setConnState] = useState("");
  const [startTime, setStartTime] = useState<number | null>(null); // video ilk bağlandığı an (süre tüpü)
  const [soapBusy, setSoapBusy] = useState(false);
  const [soapErr, setSoapErr] = useState("");

  // Canlı transkript + sesli not (dikte)
  const [transcript, setTranscript] = useState<TLine[]>([]);
  const [sttOn, setSttOn] = useState(false);
  const [dictating, setDictating] = useState(false);
  const [interim, setInterim] = useState("");
  const [sttErr, setSttErr] = useState("");
  const [sttSupported, setSttSupported] = useState(true);
  const [txBusy, setTxBusy] = useState(false);

  // Sağlık Turizmi Agent'ı — SOAP'tan paket teklifi
  interface ProposalResp {
    proposal: { tier: string; nights: number; hospitalType: string; hotelStars: number; translator: boolean; insuranceExtended: boolean; insuranceMalpractice: boolean; rationale: string };
    quote: { total: number; currency: string };
  }
  const [proposal, setProposal] = useState<ProposalResp | null>(null);
  const [propBusy, setPropBusy] = useState(false);
  const [propErr, setPropErr] = useState("");
  const recRef = useRef<AnySpeechRecognition | null>(null);
  const sttOnRef = useRef(false);
  const dictatingRef = useRef(false);

  const isDoctor = selfRole === "doctor";
  const u = urgencyStyle(caseData.urgency);
  const remoteName = isDoctor ? caseData.patientName : `${doctor.title} ${doctor.name}`;
  const myLang = isDoctor ? "tr-TR" : (SPEECH_LANG[caseData.language] ?? "tr-TR");

  useEffect(() => { setSttSupported(!!getSpeechRecognition()); }, []);

  // Süre tüpü: doktor görüşmeye girer girmez başlar (karşı tarafın bağlanmasını beklemez).
  // Bir kez set edilir; ağ kopup yeniden bağlansa/yenilense bile aynı oturumda sıfırlanmaz.
  useEffect(() => {
    if (isDoctor && joined && startTime === null) setStartTime(Date.now());
  }, [isDoctor, joined, startTime]);

  // Sinyal gönder (transkript relay) — effect dışından da kullanılabilir
  async function postSignal(kind: string, data: unknown) {
    try {
      await fetch(`/api/consultations/${consultationId}/signal`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender: selfRole, kind, data: JSON.stringify(data) }),
      });
    } catch {}
  }

  // Tanınan kesin (final) konuşmayı yönlendir: dikte açıksa nota, değilse transkripte + karşı tarafa
  function routeFinal(text: string) {
    const t = text.trim();
    if (!t) return;
    if (dictatingRef.current && isDoctor) {
      setNotes((n) => (n ? n + "\n" : "") + "🎤 " + t);
      setSaved(false);
    } else {
      const line: TLine = { who: selfRole, text: t, ts: Date.now() };
      setTranscript((prev) => [...prev, line]);
      postSignal("transcript", line);
    }
  }

  // Konuşma tanıma yaşam döngüsü: transkript veya dikte açıkken çalışır; sessizlikte Chrome durdurursa yeniden başlar
  useEffect(() => {
    sttOnRef.current = sttOn;
    dictatingRef.current = dictating;
    const want = (sttOn || dictating) && joined && phase !== "ended";
    if (want && !recRef.current) {
      const Ctor = getSpeechRecognition();
      if (!Ctor) { setSttSupported(false); setSttOn(false); setDictating(false); return; }
      const rec = new Ctor();
      rec.lang = myLang;
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (e) => {
        let interimTxt = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) routeFinal(r[0].transcript);
          else interimTxt += r[0].transcript;
        }
        setInterim(interimTxt);
      };
      rec.onend = () => {
        if ((sttOnRef.current || dictatingRef.current) && recRef.current === rec) {
          try { rec.start(); } catch {}
        }
      };
      rec.onerror = (e) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          setSttErr("Mikrofon izni reddedildi — konuşma tanıma kapatıldı.");
          setSttOn(false);
          setDictating(false);
        }
      };
      recRef.current = rec;
      try { rec.start(); } catch {}
    } else if (!want && recRef.current) {
      const rec = recRef.current;
      recRef.current = null;
      try { rec.stop(); } catch {}
      setInterim("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sttOn, dictating, joined, phase]);

  useEffect(() => () => { try { recRef.current?.stop(); } catch {} }, []);

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
              } else if (m.kind === "transcript") {
                if (data && typeof data.text === "string" && data.text.trim()) {
                  const line: TLine = { who: data.who === "doctor" ? "doctor" : "patient", text: String(data.text), ts: Number(data.ts) || Date.now() };
                  setTranscript((prev) => [...prev, line].sort((a, b) => a.ts - b.ts));
                }
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

      // ICE sunucuları sunucudan (Metered ephemeral TURN). Cross-network (farklı WiFi/mobil)
      // bağlantı için TURN relay şart; anahtarsızsa STUN+OpenRelay'e düşer. Bkz. lib/ice + /api/realtime/ice.
      const iceServers = await getIceServers();
      const pc = new RTCPeerConnection({ iceServers });
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
        else if (s === "failed") setErrMsg("Bağlantı kurulamadı (ağ/NAT). Sayfayı yenileyin; sorun sürerse internet bağlantınızı kontrol edin.");
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

  async function generateSoap() {
    setSoapBusy(true); setSoapErr("");
    try {
      const r = await fetch(`/api/ai/soap`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes, caseId: caseData.id }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "SOAP oluşturulamadı.");
      setNotes(d.soap); setSaved(false);
    } catch (e) { setSoapErr(e instanceof Error ? e.message : "Hata."); }
    finally { setSoapBusy(false); }
  }

  // Adım 1: görüşme transkriptinden SOAP taslağı (mevcut notlarla birleştirilir)
  async function generateSoapFromTranscript() {
    if (!transcript.length) return;
    setTxBusy(true); setSoapErr("");
    const txText = transcript.map((l) => `${l.who === "doctor" ? "Doktor" : "Hasta"}: ${l.text}`).join("\n");
    const merged = txText + (notes.trim() ? `\n\n[Doktorun mevcut notları]\n${notes}` : "");
    try {
      const r = await fetch(`/api/ai/soap`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes: merged, caseId: caseData.id, source: "transcript" }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Transkriptten SOAP oluşturulamadı.");
      setNotes(d.soap); setSaved(false);
    } catch (e) { setSoapErr(e instanceof Error ? e.message : "Hata."); }
    finally { setTxBusy(false); }
  }

  // Adım 4 (Modül 2): nihai SOAP'tan sağlık turizmi teklifi — not önce kaydedilir (teklif kayıtlı SOAP'a göre)
  async function generateProposal() {
    setPropBusy(true); setPropErr(""); setProposal(null);
    try {
      if (!saved && notes.trim()) await saveNotes();
      const r = await fetch("/api/ai/package-proposal", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: caseData.id }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Teklif hazırlanamadı.");
      setProposal(d);
    } catch (e) { setPropErr(e instanceof Error ? e.message : "Hata."); }
    finally { setPropBusy(false); }
  }

  function openProposalPackage() {
    if (!proposal) return;
    const p = proposal.proposal;
    const q = new URLSearchParams({
      ai: "1", tier: p.tier, nights: String(p.nights), hotel: String(p.hotelStars), htype: p.hospitalType,
      tr: p.translator ? "1" : "0", ie: p.insuranceExtended ? "1" : "0", im: p.insuranceMalpractice ? "1" : "0",
      why: p.rationale.slice(0, 300),
    });
    router.push(`/paket/${caseData.id}?${q.toString()}`);
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
          {/* Görüşme süre tüpü — yalnız doktor; video bağlanınca devreye girer */}
          {isDoctor && startTime !== null && (
            <ConsultationTimer startTime={startTime} active={phase !== "ended"} />
          )}
          <div className="relative aspect-video overflow-hidden rounded-3xl bg-slate-900 shadow-lg">
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
              <div className="absolute bottom-3 right-3 h-28 w-44 overflow-hidden rounded-2xl border border-white/20 bg-black/60 shadow-lg">
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

          {/* AI Canlı Tercüman (Gemini) — iki yön: her taraf karşı tarafın sesini kendi dilinde duyar */}
          {joined && (
            <LiveInterpreter
              targetLang={isDoctor ? "tr" : (SPEECH_LANG[caseData.language]?.split("-")[0] ?? "en")}
              targetLabel={isDoctor ? "Türkçe" : caseData.language}
              otherLabel={isDoctor ? caseData.language : "Türkçe"}
              getRemoteStream={() => (remoteVideoRef.current?.srcObject as MediaStream | null) ?? null}
              onMuteRemote={(m) => { if (remoteVideoRef.current) remoteVideoRef.current.muted = m; }}
            />
          )}

          {/* Canlı Transkript — iki taraf da kendi konuşmasını yazıya çevirir, karşı tarafa iletilir */}
          {(joined || transcript.length > 0) && (
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <MessageSquareText size={14} /> Canlı Transkript
                  {sttOn && <span className="ml-1 inline-flex h-2 w-2 animate-pulse rounded-full bg-red-500" />}
                </div>
                {sttSupported ? (
                  <button
                    onClick={() => { setSttErr(""); setSttOn((v) => !v); }}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium ${sttOn ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}
                  >
                    <Mic size={13} /> {sttOn ? "Durdur" : `Başlat (${myLang.split("-")[0].toUpperCase()})`}
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-400">Tarayıcı desteklemiyor — Chrome/Edge önerilir</span>
                )}
              </div>
              {sttErr && <div className="mt-1 text-[11px] text-red-600">{sttErr}</div>}
              <div className="mt-2 max-h-44 space-y-1 overflow-y-auto">
                {transcript.length === 0 && !interim && (
                  <p className="text-xs text-slate-400">
                    Başlat&apos;a basın; söyledikleriniz yazıya çevrilir, karşı tarafın konuşması da otomatik gelir.
                    {isDoctor ? " Görüşme sonunda transkriptten tek tıkla SOAP taslağı oluşturabilirsiniz." : ""}
                  </p>
                )}
                {transcript.map((l, i) => (
                  <p key={i} className="text-sm leading-snug text-slate-700">
                    <span className={`font-semibold ${l.who === "doctor" ? "text-[#0EA5B2]" : "text-emerald-700"}`}>
                      {l.who === "doctor" ? "Doktor" : "Hasta"}:
                    </span>{" "}
                    {l.text}
                  </p>
                ))}
                {interim && !dictating && <p className="text-sm italic text-slate-400">{interim}…</p>}
              </div>
            </div>
          )}

          {/* Doktor: hasta bağlantısı paylaş */}
          {isDoctor && (
            <div className="flex items-center justify-between gap-2 rounded-2xl border border-teal-200 bg-teal-50/60 p-3">
              <div className="text-sm text-slate-600">
                <span className="font-semibold text-teal-800">Hastayı davet et:</span> bu görüşme bağlantısını hastayla paylaş.
              </div>
              <button onClick={copyPatientLink} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-medium text-teal-700 ring-1 ring-teal-200 hover:bg-teal-100">
                {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Kopyalandı" : "Hasta linkini kopyala"}
              </button>
            </div>
          )}

          {isDoctor && (
            <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
              <div className="text-sm text-amber-800"><span className="font-semibold">AI Kritik Uyarı (demo):</span> Hasta dosyasında alerji/ilaç etkileşimi taranıyor.</div>
            </div>
          )}
        </div>

        {/* Sağ panel */}
        <aside className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-800">{caseData.patientName}</h2>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${u.badge}`}>
                <span className={`h-2 w-2 rounded-full ${u.dot}`} /> {caseData.urgency}/5
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-sm">
              <Stethoscope size={14} className="text-[#0EA5B2]" />
              <span className="font-medium text-[#0EA5B2]">{caseData.branch}</span>
            </div>
            <div className="mt-3">
              <div className="text-xs uppercase tracking-wide text-slate-400">Şikayet</div>
              <p className="mt-1 text-sm text-slate-700">{caseData.symptoms}</p>
              {isDoctor && <TranslateButton text={caseData.symptoms} defaultTarget="Türkçe" />}
            </div>
            {isDoctor && (
              <div className="mt-3 rounded-lg bg-teal-50/70 p-3 ring-1 ring-teal-100">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-teal-700"><Sparkles size={13} /> AI özeti</div>
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
                  {caseData.files.map((f) => <li key={f} className="flex items-center gap-1.5 text-xs text-slate-600"><FileText size={13} className="text-teal-600" /> {f}</li>)}
                </ul>
              </div>
            )}
          </div>

          {/* Not paneli — yalnız doktor */}
          {isDoctor && (
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Görüşme Notları</div>
                {saved ? <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600"><Check size={13} /> kaydedildi</span> : <span className="text-[11px] text-amber-600">kaydedilmedi</span>}
              </div>
              <textarea value={notes} onChange={(e) => { setNotes(e.target.value); setSaved(false); }} rows={6} placeholder="Görüşme sırasında dağınık not alın; AI ile SOAP'a dönüştürün…" className="mt-2 w-full resize-none rounded-lg border border-slate-300 p-2.5 text-sm outline-none focus:border-[#14C3D0]" />

              {/* Akış: 1) transkriptten taslak → 2) sesli not ekle → 3) SOAP'a dönüştür (güncelle) */}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  onClick={generateSoapFromTranscript}
                  disabled={txBusy || !transcript.length}
                  title={!transcript.length ? "Önce Canlı Transkript'i başlatın" : "Görüşme transkriptinden SOAP taslağı"}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-violet-300 bg-violet-50 px-2 py-2 text-[12px] font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-50"
                >
                  {txBusy ? <Loader2 size={13} className="animate-spin" /> : <MessageSquareText size={13} />} Transkriptten taslak
                </button>
                <button
                  onClick={() => { setSttErr(""); setDictating((v) => !v); }}
                  disabled={!sttSupported}
                  title="Konuşarak nota ekleyin"
                  className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[12px] font-semibold disabled:opacity-50 ${dictating ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}
                >
                  <Mic size={13} /> {dictating ? "Dikteyi kapat" : "Sesli not"}
                </button>
              </div>
              {dictating && (
                <p className="mt-1 text-[11px] font-medium text-amber-600">
                  🎤 Dikte açık — konuştuklarınız nota eklenir{interim ? `: "${interim}…"` : "."}
                </p>
              )}

              <button onClick={generateSoap} disabled={soapBusy || !notes.trim()} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-teal-300 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-100 disabled:opacity-50">
                {soapBusy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} AI · SOAP&apos;a dönüştür
              </button>
              {soapErr && <div className="mt-1 text-[11px] text-red-600">{soapErr}</div>}
              <button onClick={saveNotes} disabled={saving || saved} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#14C3D0] px-3 py-2 text-sm font-semibold text-[#101010] hover:bg-[#0EA5B2] disabled:opacity-50">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Notu kaydet
              </button>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <QuickAction icon={<Pill size={14} />}>Reçete</QuickAction>
                <QuickAction icon={<FlaskConical size={14} />}>Lab iste</QuickAction>
              </div>
              <button onClick={() => setShowDicom(true)} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                <FileImage size={15} /> Radyoloji (DICOM) görüntüleyici
              </button>
            </div>
          )}

          {isDoctor && (
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Tedavi Kararı</div>

              {/* M2→M3: doktorun tavsiye ettiği tedaviler (KSHFT listesi + kendi fiyatı) → pakete yansır */}
              {recommend && (
                <RecommendedTreatments
                  caseId={caseData.id}
                  branchLabel={recommend.branchLabel}
                  branchProcedures={recommend.branchProcedures}
                  doctorPrices={recommend.doctorPrices}
                  initial={recommend.initial}
                  rate={recommend.rate}
                />
              )}

              <div className="mt-3 border-t border-emerald-100 pt-3 text-[11px] font-medium uppercase tracking-wide text-slate-400">veya AI ile otomatik teklif</div>

              {/* Sağlık Turizmi Agent'ı: nihai SOAP → otomatik teklif */}
              <button
                onClick={generateProposal}
                disabled={propBusy || !notes.trim()}
                title={!notes.trim() ? "Önce SOAP notunu oluşturun" : "SOAP'taki tedavi planından paket teklifi"}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-violet-300 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-50"
              >
                {propBusy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} AI · Teklif hazırla (SOAP&apos;tan)
              </button>
              {propErr && <div className="mt-1.5 text-[11px] text-red-600">{propErr}</div>}

              {proposal && (
                <div className="mt-3 rounded-2xl border border-violet-200 bg-white p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-bold text-violet-700">{proposal.proposal.tier}</span>
                    <span className="text-sm font-bold text-[#101010]">${proposal.quote.total.toLocaleString("en-US")}</span>
                  </div>
                  <div className="mt-2 text-xs leading-relaxed text-slate-600">
                    {proposal.proposal.nights} gece · {proposal.proposal.hotelStars}★ otel · {proposal.proposal.hospitalType} hastane
                    {proposal.proposal.translator ? " · tercüman" : ""}
                    {proposal.proposal.insuranceMalpractice ? " · malpraktis sigortası" : ""}
                  </div>
                  <p className="mt-2 border-t border-slate-100 pt-2 text-[11px] leading-relaxed text-slate-500">{proposal.proposal.rationale}</p>
                  <button onClick={openProposalPackage} className="mt-2.5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                    <Luggage size={15} /> Teklifle paketi aç
                  </button>
                </div>
              )}

              <button onClick={() => router.push(`/paket/${caseData.id}`)} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
                <Luggage size={16} /> Sağlık Turizmi Paketi (manuel)
              </button>
            </div>
          )}
        </aside>
      </div>

      <DicomViewer open={showDicom} onClose={() => setShowDicom(false)} />
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
