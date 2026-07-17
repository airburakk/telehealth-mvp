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
import { ConsultationTimer } from "@/components/ConsultationTimer";
import { VideoCallShell } from "@/components/VideoCallShell";

type Phase = "idle" | "connecting" | "waiting" | "connected" | "ended" | "error";

// FAZ 7 (2026-07-10): partner↔konsültasyon doktoru görüşmesi 10 dk ile sınırlıdır (kullanıcı kararı:
// otomatik kesme YOK — yalnız görsel sınır + uyarı). 0–7 dk yeşil · 7 dk+ kırmızı · 9. dk'da iki
// tarafa da süre-sonu uyarısı. Timer her iki tarafta kendi bağlantı anından sayar (sinyal gerekmez).
const LIMIT_MIN = 10;
const RED_MIN = 7;
const WARN_MIN = 9;

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
  // 10 dk süre sınırı (FAZ 7)
  limitNote: "Konsültasyon görüşmesi 10 dakika ile sınırlıdır.",
  warn9: "Süre sonu uyarısı: 10 dakikalık görüşme süresi dolmak üzere — lütfen görüşmeyi toparlayın.",
  zoneOk: "Süre uygun",
  zoneOver: "Süre doluyor",
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
  // 10 dk sınırı (FAZ 7): timer bağlantı kurulunca başlar; 9. dk'da uyarı bandı (otomatik kesme YOK)
  const [startTime, setStartTime] = useState<number | null>(null);
  const [warn, setWarn] = useState(false);

  const texts = useMemo(() => [...Object.values(S), branchLabel], [branchLabel]);
  const { t } = useT(lang, texts);
  const dir = langDir(lang);

  useEffect(() => {
    if (phase === "connected" && startTime === null) setStartTime(Date.now()); // aynı oturumda sıfırlanmaz
  }, [phase, startTime]);

  useEffect(() => {
    if (startTime === null || phase === "ended") return;
    const id = setInterval(() => {
      if (Date.now() - startTime >= WARN_MIN * 60_000) setWarn(true);
    }, 1000);
    return () => clearInterval(id);
  }, [startTime, phase]);

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
        <PhoneOff className="mx-auto mb-3 text-[var(--c-ink-3)]" size={40} />
        <h1 className="text-xl font-bold text-[var(--c-ink)]">{t(S.ended)}</h1>
        <p className="mt-2 text-sm text-[var(--c-ink-2)]">{t(S.endedSub)}</p>
        <button onClick={() => router.push(backHref)} className="mt-5 rounded-xl bg-[var(--c-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)]">{t(S.back)}</button>
      </div>
    );
  }

  if (!joined) {
    return (
      <div dir={dir} className="mx-auto max-w-md px-5 py-16 text-center">
        <Video className="mx-auto mb-3 text-[var(--c-accent)]" size={40} />
        <h1 className="text-xl font-bold text-[var(--c-ink)]">{t(S.title)}</h1>
        <p className="mt-1 text-sm text-[var(--c-ink-2)]">{t(branchLabel)} · {remoteName}</p>
        <p className="mt-4 rounded-xl bg-[var(--c-surface)] px-4 py-3 text-xs text-[var(--c-ink-2)]">{t(S.permNote)}</p>
        <button onClick={() => { setJoined(true); setPhase("connecting"); }} className="mt-5 rounded-xl bg-[var(--c-accent)] px-6 py-2.5 text-sm font-semibold text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)]">{t(S.join)}</button>
      </div>
    );
  }

  return (
    <VideoCallShell
      dir={dir}
      panelLabel={t(S.title)}
      statusBar={
        <div className="flex items-center justify-between gap-2 text-xs font-medium text-white/90">
          <span className="min-w-0 truncate">{t(S.title)} · {t(branchLabel)} · {remoteName}{connState ? ` · ${connState}` : ""}</span>
          <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 ${phase === "connected" ? "bg-emerald-500/20 text-emerald-200" : "bg-black/35 text-amber-200"}`}>
            {phase === "connected" ? <Wifi size={13} /> : <WifiOff size={13} />}
            {phase === "connected" ? t(S.connected) : phase === "waiting" ? t(S.waiting) : phase === "error" ? t(S.errorLbl) : t(S.connecting)}
          </span>
        </div>
      }
      video={
        <div className="absolute inset-0 bg-[var(--c-bg-deep)]">
          {/* Uzak taraf (gerçek video) — tüm alanı doldurur */}
          <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
          {!remoteOn && (
            <div className="absolute inset-0 grid place-items-center text-[var(--c-ink-3)]">
              <div className="text-center"><UserRound size={40} className="mx-auto" /><p className="mt-2 text-xs">{remoteName} {t(S.waitingFor)}</p></div>
            </div>
          )}
          <span className="absolute bottom-20 left-3 rounded bg-black/50 px-2 py-0.5 text-[11px] text-[var(--c-ink)]">{remoteName}</span>

          {/* Yerel self-view — dikey: sağ üst · yatay: sol üst (sağdaki cam panelin arkasında kalmasın) */}
          <div className="absolute top-14 right-3 h-24 w-36 overflow-hidden rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface-2)] shadow-lg sm:h-28 sm:w-44 landscape:right-auto landscape:left-3">
            <video ref={localVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
            <span className="absolute bottom-1.5 left-1.5 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-[var(--c-ink)]">{t(S.you)}</span>
          </div>

          {/* Kontroller — video altında ortada (chat toggle dahil) */}
          <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-3">
            <button onClick={toggleMic} className={`grid h-12 w-12 place-items-center rounded-full backdrop-blur ${micOn ? "bg-white/15 text-white/90" : "bg-red-500/20 text-red-200"}`}>{micOn ? <Mic size={20} /> : <MicOff size={20} />}</button>
            <button onClick={toggleCam} className={`grid h-12 w-12 place-items-center rounded-full backdrop-blur ${camOn ? "bg-white/15 text-white/90" : "bg-red-500/20 text-red-200"}`}>{camOn ? <Video size={20} /> : <VideoOff size={20} />}</button>
            <button onClick={() => setShowChat((v) => !v)} className={`grid h-12 w-12 place-items-center rounded-full backdrop-blur ${showChat ? "bg-[var(--c-accent)]/30 text-[var(--c-accent)]" : "bg-white/15 text-white/90 hover:bg-white/25"}`} title={t(S.fallbackNote)}><MessagesSquare size={20} /></button>
            <button onClick={hangUp} className="grid h-12 w-12 place-items-center rounded-full bg-red-600 text-white hover:bg-red-700"><PhoneOff size={20} /></button>
          </div>

          {errMsg && <div className="absolute inset-x-4 bottom-20 z-20 mx-auto max-w-md rounded-lg bg-amber-500/15 px-3 py-2 text-center text-sm text-amber-200 ring-1 ring-amber-400/25 backdrop-blur">{t(errMsg)}</div>}
        </div>
      }
      panel={
        <>
          {/* 10 dk süre tüpü (FAZ 7) — iki taraf da görür; 7'de kırmızı, 9'da uyarı bandı, kesme yok */}
          {startTime !== null && (
            <div className="space-y-2">
              <ConsultationTimer
                startTime={startTime}
                active // görüşme bitince bu dal zaten render edilmez (erken return) → hep canlı
                maxMin={LIMIT_MIN}
                greenMin={RED_MIN}
                orangeMin={RED_MIN}
                labels={{ green: t(S.zoneOk), orange: t(S.zoneOver), red: t(S.zoneOver) }}
              />
              {warn ? (
                <p className="animate-pulse rounded-xl bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-300 ring-1 ring-red-400/25">⏰ {t(S.warn9)}</p>
              ) : (
                <p className="text-center text-[11px] text-[var(--c-ink-3)] landscape:text-white/70">{t(S.limitNote)}</p>
              )}
            </div>
          )}

          {/* Karşı taraf (uzman) bilgisi */}
          <div className="rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-4 shadow-sm">
            <h2 className="aura-display text-lg font-medium tracking-tight text-[var(--c-ink)]">{remoteName}</h2>
            <p className="mt-1 text-sm font-medium text-[var(--c-accent-strong)]">{t(branchLabel)}</p>
            <p className="mt-2 text-xs text-[var(--c-ink-3)]">{t(S.title)}</p>
          </div>

          {/* Yardımcı yazılı görüşme (Faz 2 chat) — chat düğmesiyle açılır */}
          {showChat && (
            <div>
              <p className="mb-2 text-center text-xs text-[var(--c-ink-2)]">{t(S.fallbackNote)}</p>
              <ConsultationChat requestId={requestId} lang={chatLang} canSend compact />
            </div>
          )}
        </>
      }
    />
  );
}
