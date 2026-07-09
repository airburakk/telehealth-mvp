"use client";

// M5 Faz 3 — Konsültasyon görüntülü görüşme odası (partner ↔ sahiplenen doktor).
// SoVideoRoom WebRTC P2P çekirdeğinin konsültasyona uyarlaması: SO/case bağı yok, anonim.
// Sinyalleşme kanalı = ConsultationVideoAppointment.id (roomId). Bağlanılamazsa Faz 2 chat'e düşülür.
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Video, VideoOff, Mic, MicOff, PhoneOff, Wifi, WifiOff, UserRound, MessagesSquare } from "lucide-react";
import { getIceServers } from "@/lib/ice";
import { signalFetch, signalPollDelayMs } from "@/lib/signal-poll";
import { connectAblySignal } from "@/lib/ably-client";
import { useT } from "@/components/useT";
import { langDir } from "@/lib/constants";
import { ConsultationChat } from "@/components/ConsultationChat";

type Phase = "idle" | "connecting" | "waiting" | "connected" | "ended" | "error";

const S = {
  title: "Konsültasyon — Görüntülü Görüşme",
  ended: "Görüşme sona erdi",
  endedSub: "Görüntülü görüşme tamamlandı.",
  back: "Geri dön",
  permNote: "Kamera ve mikrofon izni istenecek. En iyi deneyim için Chrome veya Safari kullanın.",
  join: "Görüşmeye katıl",
  connected: "Bağlandı",
  waiting: "Karşı taraf bekleniyor…",
  errorLbl: "Hata",
  connecting: "Bağlanıyor…",
  waitingFor: "bekleniyor…",
  you: "Siz",
  connLbl: "Bağlantı:",
  fallbackNote: "Görüntülü bağlanamıyor musunuz? Yazılı görüşmeyle devam edebilirsiniz.",
  errNoCam: "Bu tarayıcı kamera erişimini desteklemiyor. Linki Chrome veya Safari'de açın.",
  errAudioOnly: "Kamera yok — sesli katıldınız; karşı tarafı görebilirsiniz.",
  errConnFail: "Bağlantı kurulamadı (ağ/NAT). Yazılı görüşmeyle devam edebilirsiniz.",
} as const;

export function ConsultVideoRoom({
  roomId, requestId, selfRole, lang, remoteName, branchLabel, ended, backHref,
}: {
  roomId: string; requestId: string; selfRole: "doctor" | "patient"; lang: string;
  remoteName: string; branchLabel: string; ended: boolean; backHref: string;
}) {
  const router = useRouter();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  // Sinyalleşme taraf-token'ı (P1) — ilk yetkiden sonra sunucu DB'siz doğrular; signalFetch yönetir.
  const sigTokRef = useRef<string | null>(null);

  const [joined, setJoined] = useState(false);
  const [phase, setPhase] = useState<Phase>(ended ? "ended" : "idle");
  const [errMsg, setErrMsg] = useState("");
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [remoteOn, setRemoteOn] = useState(false);
  const [connState, setConnState] = useState("");
  const [showChat, setShowChat] = useState(false);

  const texts = useMemo(() => [...Object.values(S), branchLabel], [branchLabel]);
  const { t } = useT(lang, texts);
  const dir = langDir(lang);

  useEffect(() => {
    if (!joined || ended) return;
    let polling = true;
    let lastId = 0;
    let remoteDescSet = false;
    const pendingIce: RTCIceCandidateInit[] = [];
    // Ably (birincil) + DB poll (yedek) aynı mesajı iletebilir → id ile dedup.
    const applied = new Set<number>();
    let ably: { close: () => void; live: () => boolean } | null = null;

    // Ortak yerel teardown — "bye" alınınca VE unmount cleanup'ında çağrılır (çift çağrı idempotent).
    // Sıra önemli: poll durur → PC kapanır → kamera/mikrofon bırakılır (ışık söner) → Ably en son.
    function shutdown() {
      polling = false;
      pcRef.current?.close();
      localStreamRef.current?.getTracks().forEach((tr) => tr.stop());
      localStreamRef.current = null;
      ably?.close();
    }

    async function send(kind: string, data: unknown) {
      try {
        await signalFetch(sigTokRef, `/api/consultations/${roomId}/signal`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sender: selfRole, kind, data: JSON.stringify(data) }),
        });
      } catch {}
    }

    // Tek sinyal mesajını uygula (Ably aboneliği + DB poll ORTAK çağırır; dedup id ile).
    // ConsultVideoRoom transkript RELAY ETMEZ (video-only) → yalnız offer/answer/ice/bye.
    async function handleSignal(m: { id: number; kind: string; data: string }, pc: RTCPeerConnection) {
      if (applied.has(m.id)) return;
      applied.add(m.id);
      // ⚠️ lastId'i BURADA İLERLETME (bkz. ConsultationRoom): Ably attach-öncesi mesajları teslim
      // etmez; poll imleci yalnız poll'ün fetch ettiğiyle ilerlemeli, yoksa aradaki satırlar atlanır.
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
          // Karşı taraf kapattı → kamera/mikrofonu hemen bırak (state set'lerinden önce).
          // "complete" POST YOK — randevuyu yalnız kapatan taraf (hangUp) tamamlar.
          shutdown();
          setRemoteOn(false); setPhase("ended");
        }
      } catch {}
    }

    async function poll(pc: RTCPeerConnection) {
      while (polling) {
        try {
          const res = await signalFetch(sigTokRef, `/api/consultations/${roomId}/signal?role=${selfRole}&after=${lastId}`);
          const msgs: { id: number; kind: string; data: string }[] = await res.json();
          for (const m of msgs) { await handleSignal(m, pc); lastId = Math.max(lastId, m.id); }
        } catch {}
        await new Promise((r) => setTimeout(r, signalPollDelayMs(pc, false, ably?.live() ?? false)));
      }
    }

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setErrMsg(S.errNoCam); setShowChat(true); setPhase("error"); return;
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
        setShowChat(true); setPhase("error"); return;
      }
      const hasVideo = !!stream && stream.getVideoTracks().length > 0;
      const hasAudio = !!stream && stream.getAudioTracks().length > 0;
      localStreamRef.current = stream;
      setCamOn(hasVideo);
      setMicOn(hasAudio);
      if (!hasVideo) setErrMsg(hasAudio ? S.errAudioOnly : `Kamera/mikrofon yok — yalnızca izleme. [${lastErr || "cihaz yok"}]`);
      if (stream && localVideoRef.current) { localVideoRef.current.srcObject = stream; localVideoRef.current.play().catch(() => {}); }

      const { iceServers, turnOk } = await getIceServers();
      const pc = new RTCPeerConnection({ iceServers });
      pcRef.current = pc;
      if (stream) stream.getTracks().forEach((tr) => pc.addTrack(tr, stream));
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
        // TURN yoksa doktora gerçek neden (eksik/geçersiz sağlayıcı anahtarı); partnere genel mesaj (S.errConnFail).
        else if (s === "failed") {
          setErrMsg(!turnOk && selfRole === "doctor"
            ? "Bağlantı kurulamadı — TURN relay yok (sağlayıcı anahtarı eksik/geçersiz/erişilemiyor). Farklı ağdaki hastalar için .env + Vercel'de CF_TURN_* / METERED_* anahtarlarını kontrol edin."
            : S.errConnFail);
          setShowChat(true);
        }
      };

      setPhase("waiting");
      // Ably realtime (birincil) — her iki taraf erkenden abone olur; DB poll (yedek) paralel sürer.
      ably = connectAblySignal(roomId, selfRole, (m) => { handleSignal(m, pc); });
      if (!polling) ably.close(); // unmount getIceServers askısındayken oldu → zombie WS bırakma

      if (selfRole === "doctor") {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await send("offer", offer);
      }
      poll(pc);
    })();

    return shutdown; // unmount'ta da aynı teardown (bye ile tekilleştirildi)
  }, [joined, ended, roomId, selfRole]);

  function toggleCam() { const tr = localStreamRef.current?.getVideoTracks()[0]; if (tr) { tr.enabled = !tr.enabled; setCamOn(tr.enabled); } }
  function toggleMic() { const tr = localStreamRef.current?.getAudioTracks()[0]; if (tr) { tr.enabled = !tr.enabled; setMicOn(tr.enabled); } }

  async function hangUp() {
    try {
      await signalFetch(sigTokRef, `/api/consultations/${roomId}/signal`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender: selfRole, kind: "bye", data: "null" }),
      });
      await fetch(`/api/consultation-requests/${requestId}/video`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", appointmentId: roomId }),
      });
    } catch {}
    pcRef.current?.close();
    localStreamRef.current?.getTracks().forEach((tr) => tr.stop());
    setPhase("ended");
    router.push(backHref);
  }

  const chatLang = selfRole === "patient" ? lang : "Türkçe";

  if (phase === "ended" || ended) {
    return (
      <div dir={dir} className="mx-auto max-w-md px-5 py-20 text-center">
        <PhoneOff className="mx-auto mb-3 text-slate-300" size={40} />
        <h1 className="text-xl font-bold text-[#101010]">{t(S.ended)}</h1>
        <p className="mt-2 text-sm text-slate-500">{t(S.endedSub)}</p>
        <button onClick={() => router.push(backHref)} className="mt-5 rounded-xl bg-[#14C3D0] px-5 py-2.5 text-sm font-semibold text-[#101010] hover:bg-[#0EA5B2]">{t(S.back)}</button>
      </div>
    );
  }

  if (!joined) {
    return (
      <div dir={dir} className="mx-auto max-w-md px-5 py-16 text-center">
        <Video className="mx-auto mb-3 text-[#14C3D0]" size={40} />
        <h1 className="text-xl font-bold text-[#101010]">{t(S.title)}</h1>
        <p className="mt-1 text-sm text-slate-500">{t(branchLabel)} · {remoteName}</p>
        <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">{t(S.permNote)}</p>
        <button onClick={() => { setJoined(true); setPhase("connecting"); }} className="mt-5 rounded-xl bg-[#14C3D0] px-6 py-2.5 text-sm font-semibold text-[#101010] hover:bg-[#0EA5B2]">{t(S.join)}</button>
      </div>
    );
  }

  return (
    <div dir={dir} className="mx-auto max-w-5xl px-4 py-6">
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
        <button onClick={toggleMic} className={`grid h-12 w-12 place-items-center rounded-full ${micOn ? "bg-slate-200 text-slate-700" : "bg-red-100 text-red-600"}`}>{micOn ? <Mic size={20} /> : <MicOff size={20} />}</button>
        <button onClick={toggleCam} className={`grid h-12 w-12 place-items-center rounded-full ${camOn ? "bg-slate-200 text-slate-700" : "bg-red-100 text-red-600"}`}>{camOn ? <Video size={20} /> : <VideoOff size={20} />}</button>
        <button onClick={() => setShowChat((v) => !v)} className="grid h-12 w-12 place-items-center rounded-full bg-slate-200 text-slate-700 hover:bg-slate-300" title={t(S.fallbackNote)}><MessagesSquare size={20} /></button>
        <button onClick={hangUp} className="grid h-12 w-12 place-items-center rounded-full bg-red-600 text-white hover:bg-red-700"><PhoneOff size={20} /></button>
      </div>
      {connState && <p className="mt-2 text-center text-[11px] text-slate-400">{t(S.connLbl)} {connState}</p>}

      {/* Fallback / yardımcı yazılı görüşme (Faz 2 chat) */}
      {showChat && (
        <div className="mx-auto mt-4 max-w-xl">
          <p className="mb-2 text-center text-xs text-slate-500">{t(S.fallbackNote)}</p>
          <ConsultationChat requestId={requestId} lang={chatLang} canSend compact />
        </div>
      )}
    </div>
  );
}
