"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Video, VideoOff, Mic, MicOff, PhoneOff, Wifi, WifiOff, UserRound, MessageSquareText } from "lucide-react";
import { getIceServers } from "@/lib/ice";
import { signalFetch, signalPollDelayMs } from "@/lib/signal-poll";
import { connectAblySignal } from "@/lib/ably-client";
import { useT } from "@/components/useT";
import { useSoLang, SoLangSelect } from "@/components/SoLocale";
import { langDir } from "@/lib/constants";
import { PreConsultLobby } from "@/components/PreConsultLobby";
import { PatientQuestionsPanel } from "@/components/PatientQuestionsPanel";
import { LiveInterpreter } from "@/components/LiveInterpreter";
import type { DoctorCardData } from "@/lib/doctor-card";

type Phase = "idle" | "connecting" | "waiting" | "connected" | "ended" | "error";

// Hasta kendi dilinde konuşur → tanıyıcıya BCP-47 kodu (M2 ConsultationRoom ile aynı tablo)
const SPEECH_LANG: Record<string, string> = {
  "Türkçe": "tr-TR", "Rusça": "ru-RU", "Arapça": "ar-SA", "Farsça": "fa-IR", "Azerice": "az-AZ",
  "İngilizce": "en-US", "Fransızca": "fr-FR", "Almanca": "de-DE", "Kazakça": "kk-KZ", "Kırgızca": "ky-KG",
};

// ── Canlı transkript (Web Speech API) ──
interface TLine { who: "doctor" | "patient"; text: string; ts: number }
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

// TR kanonik UI metinleri — useT ile hasta diline çevrilir
const S = {
  title: "İkinci Görüş — Video",
  ended: "Görüşme sona erdi",
  endedSub: "İkinci görüş video görüşmeniz tamamlandı.",
  backToCase: "Vakaya dön",
  patient: "Hasta",
  doctor: "Doktor",
  permNote: "Kamera ve mikrofon izni istenecek. En iyi deneyim için Chrome veya Safari kullanın.",
  join: "Görüşmeye katıl",
  connected: "Bağlandı",
  waiting: "Karşı taraf bekleniyor…",
  errorLbl: "Hata",
  connecting: "Bağlanıyor…",
  waitingFor: "bekleniyor…",
  you: "Siz",
  connLbl: "Bağlantı:",
  // Canlı transkript
  transcriptTitle: "Canlı Transkript",
  stop: "Durdur",
  auto: "Otomatik",
  transcriptEmpty: "Konuşma başlayınca otomatik yazıya dökülür; karşı tarafın konuşması da gelir.",
  notSupported: "Tarayıcı desteklemiyor — Chrome/Edge önerilir",
  micDenied: "Mikrofon izni reddedildi — konuşma tanıma kapatıldı.",
  // errMsg literalleri (setErrMsg'deki metinlerle birebir → t(errMsg) cache'ten çevirir; cihaz-kod ekli olanlar TR'ye düşer)
  errNoCam: "Bu tarayıcı kamera erişimini desteklemiyor. Linki Chrome veya Safari'de açın.",
  errAudioOnly: "Kamera yok — sesli katıldınız; karşı tarafı görebilirsiniz.",
  errConnFail: "Bağlantı kurulamadı (ağ/NAT). İki cihazı aynı Wi-Fi'ya alıp yenileyin.",
} as const;

// İzole SO video odası — WebRTC (P2P) + mevcut string-anahtarlı sinyalleşme API'si.
// Doktor 'offer', hasta 'answer' üretir; ICE adayları polling ile değişilir.
// M2 paritesi: AI canlı tercüman + canlı transkript + VAD ile otomatik başlatma (ilk konuşma sesinde).
export function SoVideoRoom({
  roomId, caseId, selfRole, ended, branchLabel, remoteName, scheduledAt, doctorCard, patientLang = "Türkçe",
}: {
  roomId: string; caseId: string; selfRole: "doctor" | "patient"; ended: boolean; branchLabel: string; remoteName: string; scheduledAt: string | null; doctorCard?: DoctorCardData | null; patientLang?: string;
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

  // Canlı transkript + AI tercüme (otomatik)
  const [transcript, setTranscript] = useState<TLine[]>([]);
  const [sttOn, setSttOn] = useState(false);
  const [interim, setInterim] = useState("");
  const [sttErr, setSttErr] = useState("");
  const [sttSupported, setSttSupported] = useState(true);
  const [interpAutoStart, setInterpAutoStart] = useState(false); // VAD ilk konuşmayı algılayınca tercüme auto-start (yalnız diller farklıysa)
  const recRef = useRef<AnySpeechRecognition | null>(null);
  const sttOnRef = useRef(false);
  const firstSoundRef = useRef(false); // VAD: ilk konuşma sesi tek seferlik tetik

  const [lang, setLang] = useSoLang();
  const texts = useMemo(() => [...Object.values(S), branchLabel], [branchLabel]);
  const { t } = useT(lang, texts);

  const isDoctor = selfRole === "doctor";
  // Hasta kendi dilinde (başvuru dili) konuşur; doktor Türkçe. Diller aynıysa tercüme gereksiz → otomatik kapalı.
  const myLang = isDoctor ? "tr-TR" : (SPEECH_LANG[patientLang] ?? "tr-TR");
  const langsDiffer = patientLang !== "Türkçe";

  useEffect(() => { setSttSupported(!!getSpeechRecognition()); }, []);

  // Sinyalleşme taraf-token'ı (P1) — ilk yetkiden sonra sunucu DB'siz doğrular; signalFetch yönetir.
  const sigTokRef = useRef<string | null>(null);

  // Transkript relay (WebRTC effect dışından da kullanılır)
  async function postSignal(kind: string, data: unknown) {
    try {
      await signalFetch(sigTokRef, `/api/consultations/${roomId}/signal`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender: selfRole, kind, data: JSON.stringify(data) }),
      });
    } catch {}
  }

  // Tanınan kesin (final) konuşmayı transkripte ekle + karşı tarafa ilet
  function routeFinal(text: string) {
    const tx = text.trim();
    if (!tx) return;
    const line: TLine = { who: selfRole, text: tx, ts: Date.now() };
    setTranscript((prev) => [...prev, line]);
    postSignal("transcript", line);
  }

  // Konuşma tanıma yaşam döngüsü (M2 ile aynı): açıkken çalışır; sessizlikte Chrome durdurursa yeniden başlar
  useEffect(() => {
    sttOnRef.current = sttOn;
    const want = sttOn && joined && phase !== "ended";
    if (want && !recRef.current) {
      const Ctor = getSpeechRecognition();
      if (!Ctor) { setSttSupported(false); setSttOn(false); return; }
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
        if (sttOnRef.current && recRef.current === rec) {
          // Tercüman başlarken ses giriş cihazı yeniden başlar → start() exception atabilir; kısa gecikmeyle dene.
          let tries = 0;
          const tryStart = () => {
            if (recRef.current !== rec || !sttOnRef.current) return;
            try { rec.start(); }
            catch { if (tries++ < 8) setTimeout(tryStart, 250); }
          };
          tryStart();
        }
      };
      rec.onerror = (e) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          setSttErr("Mikrofon izni reddedildi — konuşma tanıma kapatıldı.");
          setSttOn(false);
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
  }, [sttOn, joined, phase]);

  useEffect(() => () => { try { recRef.current?.stop(); } catch {} }, []);

  // ── VAD (ses aktivitesi algılama): herhangi bir taraftan İLK konuşma sesinde AI'ı otomatik başlat (M2 ile aynı) ──
  useEffect(() => {
    if (!joined || phase === "ended" || firstSoundRef.current) return;
    let cancelled = false;
    let raf = 0;
    let ctx: AudioContext | null = null;
    const attached = new WeakSet<MediaStream>();
    const metered: { an: AnalyserNode; buf: Uint8Array<ArrayBuffer> }[] = [];
    let hot = 0;
    const THRESH = 0.045;
    const NEED = 4;

    const ensureCtx = () => {
      if (!ctx) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ctx = new AC();
        ctx.resume().catch(() => {});
      }
      return ctx;
    };
    const attach = (stream: MediaStream | null) => {
      if (!stream || attached.has(stream) || stream.getAudioTracks().length === 0) return;
      try {
        const c = ensureCtx();
        const src = c.createMediaStreamSource(stream);
        const an = c.createAnalyser(); an.fftSize = 256;
        src.connect(an);
        metered.push({ an, buf: new Uint8Array(an.fftSize) });
        attached.add(stream);
      } catch {}
    };
    const tick = () => {
      if (cancelled) return;
      attach(localStreamRef.current);
      attach((remoteVideoRef.current?.srcObject as MediaStream | null) ?? null);
      let loud = false;
      for (const m of metered) {
        m.an.getByteTimeDomainData(m.buf);
        let sum = 0;
        for (let i = 0; i < m.buf.length; i++) { const v = (m.buf[i] - 128) / 128; sum += v * v; }
        if (Math.sqrt(sum / m.buf.length) > THRESH) { loud = true; break; }
      }
      hot = loud ? hot + 1 : 0;
      if (hot >= NEED) {
        firstSoundRef.current = true;
        setSttOn(true);
        if (langsDiffer) setInterpAutoStart(true);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      ctx?.close().catch(() => {});
    };
  }, [joined, phase, langsDiffer]);

  useEffect(() => {
    if (!joined || ended) return;
    let polling = true;
    let lastId = 0;
    let remoteDescSet = false;
    const pendingIce: RTCIceCandidateInit[] = [];
    // Ably (birincil) + DB poll (yedek) aynı mesajı iletebilir → id ile dedup.
    const applied = new Set<number>();
    let ably: { close: () => void; live: () => boolean } | null = null;

    async function send(kind: string, data: unknown) {
      try {
        await signalFetch(sigTokRef, `/api/consultations/${roomId}/signal`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sender: selfRole, kind, data: JSON.stringify(data) }),
        });
      } catch {}
    }

    // Tek sinyal mesajını uygula (Ably aboneliği + DB poll ORTAK çağırır; dedup id ile).
    // ⚠️ lastId'i BURADA İLERLETME (bkz. ConsultationRoom): Ably attach-öncesi DB satırlarını teslim
    // etmez; lastId'i Ably sıçratırsa poll aradaki satırları kalıcı atlar. Poll imleci poll'e ait.
    async function handleSignal(m: { id: number; kind: string; data: string }, pc: RTCPeerConnection) {
      if (applied.has(m.id)) return;
      applied.add(m.id);
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
        } else if (m.kind === "transcript") {
          if (data && typeof data.text === "string" && data.text.trim()) {
            const line: TLine = { who: data.who === "doctor" ? "doctor" : "patient", text: String(data.text), ts: Number(data.ts) || Date.now() };
            setTranscript((prev) => [...prev, line].sort((a, b) => a.ts - b.ts));
          }
        }
      } catch {}
    }

    async function poll(pc: RTCPeerConnection) {
      while (polling) {
        let hot = false; // bu turda transkript geldi mi → "sıcak" (hızlı poll) kal
        try {
          const res = await signalFetch(sigTokRef, `/api/consultations/${roomId}/signal?role=${selfRole}&after=${lastId}`);
          const msgs: { id: number; kind: string; data: string }[] = await res.json();
          hot = msgs.some((m) => m.kind === "transcript");
          for (const m of msgs) { await handleSignal(m, pc); lastId = Math.max(lastId, m.id); }
        } catch {}
        await new Promise((r) => setTimeout(r, signalPollDelayMs(pc, hot, ably?.live() ?? false)));
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

    return () => {
      polling = false;
      ably?.close();
      pcRef.current?.close();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [joined, ended, roomId, selfRole]);

  function toggleCam() { const t = localStreamRef.current?.getVideoTracks()[0]; if (t) { t.enabled = !t.enabled; setCamOn(t.enabled); } }
  function toggleMic() { const t = localStreamRef.current?.getAudioTracks()[0]; if (t) { t.enabled = !t.enabled; setMicOn(t.enabled); } }

  async function hangUp() {
    try {
      await signalFetch(sigTokRef, `/api/consultations/${roomId}/signal`, {
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
        doctorCard={doctorCard}
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

      {/* AI Canlı Tercüman (Gemini) — yalnız diller farklıysa (aynı dilde gereksiz + karşı sesi kısar);
          ilk konuşma sesinde otomatik başlar (başlat düğmesi yok). */}
      {langsDiffer && (
        <div className="mt-4">
          <LiveInterpreter
            lang={isDoctor ? "Türkçe" : lang}
            targetLang={isDoctor ? "tr" : (SPEECH_LANG[patientLang]?.split("-")[0] ?? "en")}
            targetLabel={isDoctor ? "Türkçe" : patientLang}
            otherLabel={isDoctor ? patientLang : "Türkçe"}
            autoMode={langsDiffer}
            autoStart={interpAutoStart}
            getRemoteStream={() => (remoteVideoRef.current?.srcObject as MediaStream | null) ?? null}
            onMuteRemote={(m) => { if (remoteVideoRef.current) remoteVideoRef.current.muted = m; }}
          />
        </div>
      )}

      {/* Canlı Transkript — iki taraf da kendi konuşmasını yazıya çevirir, karşı tarafa iletilir (otomatik/VAD) */}
      <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <MessageSquareText size={14} /> {t(S.transcriptTitle)}
            {sttOn && <span className="ms-1 inline-flex h-2 w-2 animate-pulse rounded-full bg-red-500" />}
          </div>
          {!sttSupported ? (
            <span className="text-[11px] text-slate-400">{t(S.notSupported)}</span>
          ) : sttOn ? (
            <button onClick={() => { setSttErr(""); setSttOn(false); }} className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-2.5 py-1.5 text-[12px] font-medium text-red-700 hover:bg-red-100">
              <Mic size={13} /> {t(S.stop)}
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[12px] font-medium text-slate-500" title={t(S.transcriptEmpty)}>
              <Mic size={13} /> {t(S.auto)}
            </span>
          )}
        </div>
        {sttErr && <div className="mt-1 text-[11px] text-red-600">{t(sttErr)}</div>}
        <div className="mt-2 max-h-44 space-y-1 overflow-y-auto">
          {transcript.length === 0 && !interim && (
            <p className="text-xs text-slate-400">{t(S.transcriptEmpty)}</p>
          )}
          {transcript.map((l, i) => (
            <p key={i} className="text-sm leading-snug text-slate-700">
              <span className={`font-semibold ${l.who === "doctor" ? "text-[#0EA5B2]" : "text-emerald-700"}`}>
                {l.who === "doctor" ? t(S.doctor) : t(S.patient)}:
              </span>{" "}
              {l.text}
            </p>
          ))}
          {interim && <p className="text-sm italic text-slate-400">{interim}…</p>}
        </div>
      </div>

      {/* Hasta "doktora sorularım" notu — bekleme odasıyla aynı localStorage anahtarından (talep #2) */}
      {selfRole === "patient" && (
        <div className="mt-4">
          <PatientQuestionsPanel storageKey={roomId} lang={lang} />
        </div>
      )}
    </div>
  );
}
