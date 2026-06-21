"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Video, VideoOff, Mic, MicOff, PhoneOff, Wifi, WifiOff, UserRound } from "lucide-react";
import { getIceServers } from "@/lib/ice";
import { useT } from "@/components/useT";
import { useSoLang, SoLangSelect } from "@/components/SoLocale";
import { langDir } from "@/lib/constants";
import { PreConsultLobby } from "@/components/PreConsultLobby";

type Phase = "idle" | "connecting" | "waiting" | "connected" | "ended" | "error";

// TR kanonik UI metinleri — useT ile hasta diline çevrilir
const S = {
  title: "İkinci Görüş — Video",
  ended: "Görüşme sona erdi",
  endedSub: "İkinci görüş video görüşmeniz tamamlandı.",
  backToCase: "Vakaya dön",
  patient: "Hasta",
  doctor: "Hekim",
  permNote: "Kamera ve mikrofon izni istenecek. En iyi deneyim için Chrome veya Safari kullanın.",
  join: "Görüşmeye katıl",
  connected: "Bağlandı",
  waiting: "Karşı taraf bekleniyor…",
  errorLbl: "Hata",
  connecting: "Bağlanıyor…",
  waitingFor: "bekleniyor…",
  you: "Siz",
  connLbl: "Bağlantı:",
  // errMsg literalleri (setErrMsg'deki metinlerle birebir → t(errMsg) cache'ten çevirir; cihaz-kod ekli olanlar TR'ye düşer)
  errNoCam: "Bu tarayıcı kamera erişimini desteklemiyor. Linki Chrome veya Safari'de açın.",
  errAudioOnly: "Kamera yok — sesli katıldınız; karşı tarafı görebilirsiniz.",
  errConnFail: "Bağlantı kurulamadı (ağ/NAT). İki cihazı aynı Wi-Fi'ya alıp yenileyin.",
} as const;

// İzole SO video odası — WebRTC (P2P) + mevcut string-anahtarlı sinyalleşme API'si.
// Doktor 'offer', hasta 'answer' üretir; ICE adayları polling ile değişilir.
export function SoVideoRoom({
  roomId, caseId, selfRole, ended, branchLabel, remoteName, scheduledAt,
}: {
  roomId: string; caseId: string; selfRole: "doctor" | "patient"; ended: boolean; branchLabel: string; remoteName: string; scheduledAt: string | null;
}) {
  const router = useRouter();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const [joined, setJoined] = useState(false);
  const [phase, setPhase] = useState<Phase>(ended ? "ended" : "idle");
  const [errMsg, setErrMsg] = useState("");
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [remoteOn, setRemoteOn] = useState(false);
  const [connState, setConnState] = useState("");

  const [lang, setLang] = useSoLang();
  const texts = useMemo(() => [...Object.values(S), branchLabel], [branchLabel]);
  const { t } = useT(lang, texts);

  useEffect(() => {
    if (!joined || ended) return;
    let polling = true;
    let lastId = 0;
    let remoteDescSet = false;
    const pendingIce: RTCIceCandidateInit[] = [];

    async function send(kind: string, data: unknown) {
      try {
        await fetch(`/api/consultations/${roomId}/signal`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sender: selfRole, kind, data: JSON.stringify(data) }),
        });
      } catch {}
    }

    async function poll(pc: RTCPeerConnection) {
      while (polling) {
        try {
          const res = await fetch(`/api/consultations/${roomId}/signal?role=${selfRole}&after=${lastId}`);
          const msgs: { id: number; kind: string; data: string }[] = await res.json();
          for (const m of msgs) {
            lastId = Math.max(lastId, m.id);
            try {
              const data = JSON.parse(m.data);
              if (m.kind === "offer" && selfRole === "patient") {
                await pc.setRemoteDescription(new RTCSessionDescription(data));
                remoteDescSet = true;
                for (const cand of pendingIce.splice(0)) { try { await pc.addIceCandidate(cand); } catch {} }
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                await send("answer", answer);
              } else if (m.kind === "answer" && selfRole === "doctor") {
                await pc.setRemoteDescription(new RTCSessionDescription(data));
                remoteDescSet = true;
                for (const cand of pendingIce.splice(0)) { try { await pc.addIceCandidate(cand); } catch {} }
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
        setErrMsg("Bu tarayıcı kamera erişimini desteklemiyor. Linki Chrome veya Safari'de açın.");
        setPhase("error"); return;
      }
      let stream: MediaStream | null = null;
      let lastErr = "";
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch (e) {
        lastErr = (e as DOMException)?.name || "";
        if (["NotFoundError", "OverconstrainedError", "NotReadableError"].includes(lastErr)) {
          try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); lastErr = ""; }
          catch (e2) { lastErr = (e2 as DOMException)?.name || lastErr; }
        }
      }
      if (!stream && (lastErr === "NotAllowedError" || lastErr === "SecurityError")) {
        setErrMsg(`İzin reddedildi. Kilit simgesinden Kamera ve Mikrofon'a izin verip tekrar deneyin. [${lastErr}]`);
        setPhase("error"); return;
      }
      const hasVideo = !!stream && stream.getVideoTracks().length > 0;
      const hasAudio = !!stream && stream.getAudioTracks().length > 0;
      localStreamRef.current = stream;
      setCamOn(hasVideo);
      setMicOn(hasAudio);
      if (!hasVideo) setErrMsg(hasAudio ? "Kamera yok — sesli katıldınız; karşı tarafı görebilirsiniz." : `Kamera/mikrofon yok — yalnızca izleme. [${lastErr || "cihaz yok"}]`);
      if (stream && localVideoRef.current) { localVideoRef.current.srcObject = stream; localVideoRef.current.play().catch(() => {}); }

      // ICE sunucuları sunucudan (Metered ephemeral TURN) — cross-network için relay şart. Bkz. lib/ice.
      const iceServers = await getIceServers();
      const pc = new RTCPeerConnection({ iceServers });
      pcRef.current = pc;
      if (stream) stream.getTracks().forEach((t) => pc.addTrack(t, stream));
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
        else if (s === "failed") setErrMsg("Bağlantı kurulamadı (ağ/NAT). İki cihazı aynı Wi-Fi'ya alıp yenileyin.");
      };

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
  }, [joined, ended, roomId, selfRole]);

  function toggleCam() { const t = localStreamRef.current?.getVideoTracks()[0]; if (t) { t.enabled = !t.enabled; setCamOn(t.enabled); } }
  function toggleMic() { const t = localStreamRef.current?.getAudioTracks()[0]; if (t) { t.enabled = !t.enabled; setMicOn(t.enabled); } }

  async function hangUp() {
    try {
      await fetch(`/api/consultations/${roomId}/signal`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender: selfRole, kind: "bye", data: "null" }),
      });
    } catch {}
    pcRef.current?.close();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    setPhase("ended");
    router.push(`/second-opinion/vaka/${caseId}`);
  }

  if (phase === "ended" || ended) {
    return (
      <div dir={langDir(lang)} className="mx-auto max-w-md px-5 py-20 text-center">
        <PhoneOff className="mx-auto mb-3 text-slate-300" size={40} />
        <h1 className="text-xl font-bold text-[#101010]">{t(S.ended)}</h1>
        <p className="mt-2 text-sm text-slate-500">{t(S.endedSub)}</p>
        <button onClick={() => router.push(`/second-opinion/vaka/${caseId}`)} className="mt-5 rounded-xl bg-[#14C3D0] px-5 py-2.5 text-sm font-semibold text-[#101010] hover:bg-[#0EA5B2]">
          {t(S.backToCase)}
        </button>
      </div>
    );
  }

  // Görüşme Öncesi Oda (Faz B) — odaya girmeden cihaz testi + geri sayım. Katıl → joined.
  if (!joined) {
    return (
      <PreConsultLobby
        lang={lang}
        langSelector={<SoLangSelect lang={lang} onChange={setLang} />}
        scheduledAt={scheduledAt}
        earlyWindowMin={15}
        isDoctor={selfRole === "doctor"}
        remoteLabel={remoteName}
        branchLabel={branchLabel}
        storageKey={roomId}
        onJoin={() => { setJoined(true); setPhase("connecting"); }}
      />
    );
  }

  return (
    <div dir={langDir(lang)} className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#101010]">{t(S.title)}</h1>
          <p className="text-xs text-slate-500">{t(branchLabel)} · {remoteName}</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${phase === "connected" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
          {phase === "connected" ? <Wifi size={13} /> : <WifiOff size={13} />}
          {phase === "connected" ? t(S.connected) : phase === "waiting" ? t(S.waiting) : phase === "error" ? t(S.errorLbl) : t(S.connecting)}
        </span>
      </div>

      {errMsg && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">{t(errMsg)}</p>}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="relative aspect-video overflow-hidden rounded-2xl bg-slate-900">
          <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
          {!remoteOn && (
            <div className="absolute inset-0 grid place-items-center text-slate-400">
              <div className="text-center"><UserRound size={36} className="mx-auto" /><p className="mt-2 text-xs">{remoteName} {t(S.waitingFor)}</p></div>
            </div>
          )}
          <span className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-0.5 text-[11px] text-white">{remoteName}</span>
        </div>
        <div className="relative aspect-video overflow-hidden rounded-2xl bg-slate-800">
          <video ref={localVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
          <span className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-0.5 text-[11px] text-white">{t(S.you)}</span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-3">
        <button onClick={toggleMic} className={`grid h-12 w-12 place-items-center rounded-full ${micOn ? "bg-slate-200 text-slate-700" : "bg-red-100 text-red-600"}`}>
          {micOn ? <Mic size={20} /> : <MicOff size={20} />}
        </button>
        <button onClick={toggleCam} className={`grid h-12 w-12 place-items-center rounded-full ${camOn ? "bg-slate-200 text-slate-700" : "bg-red-100 text-red-600"}`}>
          {camOn ? <Video size={20} /> : <VideoOff size={20} />}
        </button>
        <button onClick={hangUp} className="grid h-12 w-12 place-items-center rounded-full bg-red-600 text-white hover:bg-red-700">
          <PhoneOff size={20} />
        </button>
      </div>
      {connState && <p className="mt-2 text-center text-[11px] text-slate-400">{t(S.connLbl)} {connState}</p>}
    </div>
  );
}
