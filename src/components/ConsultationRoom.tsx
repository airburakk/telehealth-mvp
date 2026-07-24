"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { urgencyStyle, langDir, LANG_BCP47 } from "@/lib/constants";
import { useT } from "@/components/useT";
import { TranslateButton } from "@/components/TranslateButton";
import { LiveInterpreter } from "@/components/LiveInterpreter";
import { ConsultationTimer } from "@/components/ConsultationTimer";
import DicomViewer from "@/components/DicomViewer";
import ClinicalDecisionPanel from "@/components/ClinicalDecisionPanel";
import { PatientQuestionsPanel } from "@/components/PatientQuestionsPanel";
import { VideoCallShell } from "@/components/VideoCallShell";
import { getIceServers } from "@/lib/ice";
import { signalFetch, signalPollDelayMs } from "@/lib/signal-poll";
import { connectAblySignal } from "@/lib/ably-client";
import {
  Video, VideoOff, Mic, MicOff, PhoneOff, Camera, Sparkles, FileText,
  Save, Check, Pill, FlaskConical, Stethoscope, AlertTriangle, Languages, Loader2,
  Copy, Wifi, WifiOff, UserRound, MessageSquareText, FileImage, Volume2,
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

// Birleşik Klinik Kodlama + Tedavi Kararı verisi (yalnız doktor görünümü) — FAZ 2 (2026-07-10).
// AI Epikriz görüşme ekranından POST-OP ekranına taşındı (/takip/[caseId], yalnız personel görünümü).
interface ClinicalData {
  icd10Code: string | null;
  patientIdentifier: string | null;
  patientIdentifierType: string | null;
  icd10Options: { code: string; label: string }[];
  icdProcedures: Record<string, { code: string; name: string; price: number | null }[]>; // ICD → katalog-çözümlü eşlenmiş işlemler (çapraz-branş dahil)
  treatmentDaysMin: number | null;
  treatmentDaysMax: number | null;
  hospitalRegistryId: number | null;
  hospitalName: string | null;
  agencySentAt: string | null;
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
  "Türkçe": "tr-TR", "Rusça": "ru-RU", "Arapça": "ar-SA", "Farsça": "fa-IR", "Azerice": "az-AZ",
  "İngilizce": "en-US", "Fransızca": "fr-FR", "Almanca": "de-DE", "Kazakça": "kk-KZ", "Kırgızca": "ky-KG",
  "Bulgarca": "bg-BG",
};

// Hasta-yüzü + paylaşılan UI metinleri (TR kanonik). Doktor araçları (notlar/SOAP/tedavi) çevrilmez:
// uiLang=Türkçe'de t() kimlik döndürür; ayrıca o bölümler zaten isDoctor ile koşullu.
const UI = [
  "Katılmaya hazır", "Bağlandı", "Karşı taraf bekleniyor…", "Kamera açılıyor…", "Görüşme sona erdi", "Hata",
  "Doktor görünümü", "Hasta görünümü", "Gerçek WebRTC (P2P)",
  "Karşı tarafın sesini aç", "Görüşmeye katılın", "Bağlanmak için kamera ve mikrofon izni vermeniz gerekir.", "Kamera & mikrofonla katıl",
  "Kamera/mikrofona erişilemedi.",
  "Adres çubuğundaki kilit/kamera simgesine dokunup Kamera ve Mikrofon'a \"İzin ver\" deyin, sonra tekrar deneyin.",
  "Tekrar dene", "karşı taraf bekleniyor…", "kamera açılıyor…", "Canlı çeviri", "demo",
  "Kamera kapalı", "Siz", "Bitir",
  // Ekran okuyucu etiketleri — ikon-tek toggle'lar (WCAG 4.1.2)
  "Mikrofonu kapat", "Mikrofonu aç", "Kamerayı kapat", "Kamerayı aç",
  "Canlı Transkript", "Durdur", "Başlat", "Tarayıcı desteklemiyor — Chrome/Edge önerilir",
  "Başlat'a basın; söyledikleriniz yazıya çevrilir, karşı tarafın konuşması da otomatik gelir.",
  "Otomatik", "Konuşma başlayınca otomatik yazıya dökülür; karşı tarafın konuşması da gelir.",
  "Doktor", "Hasta", "Mikrofon izni reddedildi — konuşma tanıma kapatıldı.",
  "Şikayet", "ile görüşüyorsunuz",
  // errMsg sabitleri (cihaz-kodlu interpolasyonlu olanlar TR'ye düşer)
  "Bu tarayıcı kamera erişimini desteklemiyor. Linki uygulama içinde değil, Chrome veya Safari'de açın. [desteksiz]",
  "Bu cihazda kamera yok — sesli katıldınız; karşı tarafı görebilirsiniz.",
  "Bağlantı kurulamadı (ağ/NAT). Sayfayı yenileyin; sorun sürerse internet bağlantınızı kontrol edin.",
];

export function ConsultationRoom({
  consultationId, selfRole, status, initialNotes, doctor, caseData, recommend, clinical, autoJoin = false, storageKey,
}: {
  consultationId: string; selfRole: "doctor" | "patient"; status: string;
  initialNotes: string; doctor: DoctorData; caseData: CaseData; recommend?: RecommendData; clinical?: ClinicalData;
  autoJoin?: boolean; // Görüşme Öncesi Oda (lobi) sonrası: kendi "katıl" ekranını atla → doğrudan bağlan
  storageKey?: string; // Hasta "doktora sorular" notu localStorage anahtarı (lobi ile aynı) — bkz. PatientQuestionsPanel
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
  const [remoteAudioBlocked, setRemoteAudioBlocked] = useState(false); // uzak ses autoplay ile engellendi → "Sesi aç" göster
  const [hasMicAudio, setHasMicAudio] = useState(false); // mikrofon track'i var → tercüman kartı render edilebilir (tek-sıçrama: kaynak KENDİ mikrofonu)
  const [notes, setNotes] = useState(initialNotes);
  const [saved, setSaved] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ending, setEnding] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDicom, setShowDicom] = useState(false);
  const [joined, setJoined] = useState(autoJoin);
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
  const [interpAutoStart, setInterpAutoStart] = useState(false); // VAD ilk konuşmayı algılayınca tercüme auto-start (yalnız diller farklıysa)

  const recRef = useRef<AnySpeechRecognition | null>(null);
  const sttOnRef = useRef(false);
  const dictatingRef = useRef(false);
  const firstSoundRef = useRef(false); // VAD: HERHANGİ taraftan ilk konuşma → transkript tetiği
  const firstLocalSoundRef = useRef(false); // VAD: YEREL ilk konuşma → tercüman tetiği (tek-sıçrama: oturum KENDİ sesini çevirir)
  const translationTrackRef = useRef<MediaStreamTrack | null>(null); // tercümanın çeviri track'i (pc yeniden kurulunca yeniden uygulanır)

  const isDoctor = selfRole === "doctor";
  const u = urgencyStyle(caseData.urgency);
  const remoteName = isDoctor ? caseData.patientName : `${doctor.title} ${doctor.name}`;
  const myLang = isDoctor ? "tr-TR" : (SPEECH_LANG[caseData.language] ?? "tr-TR");
  // Doktor TR konuşur; hasta dili Türkçe ise tercüme gereksiz (kendi sesini kısar) → otomatik tercüme kapalı.
  const langsDiffer = caseData.language !== "Türkçe";

  // Hasta arayüzü kendi dilinde; doktor TR (klinik araçlar). Yalnız sunum metinleri çevrilir; veri TR kanonik.
  const uiLang = isDoctor ? "Türkçe" : caseData.language;
  const texts = useMemo(() => [...UI, caseData.branch], [caseData.branch]);
  const { t } = useT(uiLang, texts);

  useEffect(() => { setSttSupported(!!getSpeechRecognition()); }, []);

  // Süre tüpü: doktor görüşmeye girer girmez başlar (karşı tarafın bağlanmasını beklemez).
  // Bir kez set edilir; ağ kopup yeniden bağlansa/yenilense bile aynı oturumda sıfırlanmaz.
  useEffect(() => {
    if (isDoctor && joined && startTime === null) setStartTime(Date.now());
  }, [isDoctor, joined, startTime]);

  // Sinyalleşme taraf-token'ı (P1) — ilk yetkiden sonra sunucu DB'siz doğrular; signalFetch yönetir.
  const sigTokRef = useRef<string | null>(null);

  // Sinyal gönder (transkript relay) — effect dışından da kullanılabilir
  async function postSignal(kind: string, data: unknown) {
    try {
      await signalFetch(sigTokRef, `/api/consultations/${consultationId}/signal`, {
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
          // Tercüman başlarken ses giriş cihazı yeniden başlar → start() o an exception atabilir.
          // Yutma yerine kısa gecikmeyle birkaç kez dene (transkript tercümanla birlikte ayakta kalsın).
          let tries = 0;
          const tryStart = () => {
            if (recRef.current !== rec || !(sttOnRef.current || dictatingRef.current)) return;
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

  // ── VAD (ses aktivitesi algılama): İLK konuşma sesinde AI'ları otomatik başlat ──
  // Hem kendi mikrofonumuz (local) hem karşı tarafın akışı (remote) izlenir; RMS eşiği kısa süre aşılınca
  // tetik. İKİ AYRI tek-atım: transkript HERHANGİ taraftan tetiklenir (davranış birebir eski); tercüman
  // YALNIZ YEREL sesten tetiklenir — tek-sıçrama mimarisinde oturum KENDİ konuşmamı çevirir, karşının
  // sesi benim Gemini oturumumu açmamalı. Sessizken Gemini bağlanmaz.
  useEffect(() => {
    // Tercüman tetiği yalnız kart render edilebiliyorken anlamlı (diller farklı + mikrofon var);
    // değilse yalnız transkript tetiği beklenir — döngü onunla kapanır (sonsuz rAF/Analyser kalmaz).
    const interpNeeded = langsDiffer && hasMicAudio;
    const done = () => firstSoundRef.current && (firstLocalSoundRef.current || !interpNeeded);
    if (!joined || phase === "ended" || done()) return;
    let cancelled = false;
    let raf = 0;
    let ctx: AudioContext | null = null;
    const attached = new WeakSet<MediaStream>();
    const metered: { an: AnalyserNode; buf: Uint8Array<ArrayBuffer>; isLocal: boolean }[] = [];
    let hotAny = 0;   // ardışık "ses var" frame sayısı — herhangi kaynak (anlık tıkırtıyı elemek için)
    let hotLocal = 0; // ardışık "ses var" frame sayısı — yalnız yerel mikrofon
    const THRESH = 0.045; // PreConsultLobby ses metresiyle uyumlu RMS ölçeği
    const NEED = 4;       // ~4 ardışık frame ≈ gerçek konuşma başlangıcı

    const ensureCtx = () => {
      if (!ctx) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ctx = new AC();
        ctx.resume().catch(() => {});
      }
      return ctx;
    };
    const attach = (stream: MediaStream | null, isLocal: boolean) => {
      if (!stream || attached.has(stream) || stream.getAudioTracks().length === 0) return;
      try {
        const c = ensureCtx();
        const src = c.createMediaStreamSource(stream);
        const an = c.createAnalyser(); an.fftSize = 256;
        src.connect(an);
        metered.push({ an, buf: new Uint8Array(an.fftSize), isLocal });
        attached.add(stream);
      } catch {}
    };

    const tick = () => {
      if (cancelled) return;
      // Akışlar geç gelebilir (remote ontrack sonrası) → her frame lazy bağla
      attach(localStreamRef.current, true);
      attach((remoteVideoRef.current?.srcObject as MediaStream | null) ?? null, false);
      let loudAny = false, loudLocal = false;
      for (const m of metered) {
        m.an.getByteTimeDomainData(m.buf);
        let sum = 0;
        for (let i = 0; i < m.buf.length; i++) { const v = (m.buf[i] - 128) / 128; sum += v * v; }
        if (Math.sqrt(sum / m.buf.length) > THRESH) { loudAny = true; if (m.isLocal) loudLocal = true; }
      }
      hotAny = loudAny ? hotAny + 1 : 0;
      hotLocal = loudLocal ? hotLocal + 1 : 0;
      if (hotAny >= NEED && !firstSoundRef.current) {
        firstSoundRef.current = true;
        setSttOn(true); // transkript — Web Speech kendi VAD'iyle sessizde yazmaz
      }
      if (hotLocal >= NEED && !firstLocalSoundRef.current) {
        firstLocalSoundRef.current = true;
        if (langsDiffer) setInterpAutoStart(true); // tercüme — yalnız diller farklıysa + YEREL ses
      }
      if (done()) return; // gereken tetikler tamamlandı → döngüyü bırak
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      ctx?.close().catch(() => {});
    };
  }, [joined, phase, langsDiffer, hasMicAudio]);

  useEffect(() => {
    if (status === "ENDED" || !joined) return;
    let polling = true;
    let lastId = 0;
    let remoteDescSet = false;
    const pendingIce: RTCIceCandidateInit[] = [];
    // Ably (birincil) + DB poll (yedek) aynı mesajı iletebilir → id ile dedup, iki kez uygulanmaz.
    const applied = new Set<number>();
    let ably: { close: () => void; live: () => boolean } | null = null;

    // Ortak yerel teardown — unmount cleanup'ında çağrılır (çift çağrı idempotent).
    // Sıra önemli: poll durur → PC kapanır → kamera/mikrofon bırakılır (ışık söner) → Ably en son.
    let byeDrainTimer: ReturnType<typeof setTimeout> | null = null;
    function shutdown() {
      if (byeDrainTimer) { clearTimeout(byeDrainTimer); byeDrainTimer = null; }
      polling = false;
      pcRef.current?.close();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      ably?.close();
    }
    // "bye" alınınca: medya HEMEN bırakılır (kamera ışığı söner) ama poll 5 sn daha yaşar —
    // transkript PHI gereği yalnız DB-poll ile taşınır; Ably bye'ı anlık ilettiğinden son
    // transkript satırları henüz çekilmemiş olabilir (drain penceresi, sonra poll durur).
    function shutdownAfterDrain() {
      pcRef.current?.close();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      ably?.close();
      if (!byeDrainTimer) byeDrainTimer = setTimeout(() => { polling = false; }, 5000);
    }

    async function send(kind: string, data: unknown) {
      try {
        await signalFetch(sigTokRef, `/api/consultations/${consultationId}/signal`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sender: selfRole, kind, data: JSON.stringify(data) }),
        });
      } catch {}
    }

    // Tek sinyal mesajını uygula (Ably aboneliği + DB poll ORTAK çağırır; dedup id ile).
    // ⚠️ lastId'i BURADA İLERLETME: poll imleci yalnız poll'ün fetch ettiğiyle ilerlemeli. Ably (rewind
    // yok) attach-ÖNCESİ DB satırlarını teslim etmez; Ably yüksek bir id ile lastId'i sıçratırsa poll
    // aradaki (attach penceresinde yazılan) satırları `id>lastId` ile KALICI atlar → ICE/offer kaybı.
    async function handleSignal(m: { id: number; kind: string; data: string }, pc: RTCPeerConnection) {
      if (applied.has(m.id)) return;
      applied.add(m.id);
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
          shutdownAfterDrain(); // karşı taraf kapattı → kamera/mikrofon hemen; poll 5 sn drain (transkript kuyruğu)
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
          const res = await signalFetch(sigTokRef, `/api/consultations/${consultationId}/signal?role=${selfRole}&after=${lastId}`);
          const msgs: { id: number; kind: string; data: string }[] = await res.json();
          hot = msgs.some((m) => m.kind === "transcript");
          // lastId YALNIZ poll'ün fetch ettiğiyle ilerler (kesintisiz DB süpürme → atlama yok).
          for (const m of msgs) { await handleSignal(m, pc); lastId = Math.max(lastId, m.id); }
        } catch {}
        await new Promise((r) => setTimeout(r, signalPollDelayMs(pc, hot, ably?.live() ?? false)));
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
      setHasMicAudio(hasAudio); // tercüman kartı yalnız mikrofon varken (tek-sıçrama: kaynak kendi sesi)
      if (!hasVideo) {
        setErrMsg(hasAudio
          ? "Bu cihazda kamera yok — sesli katıldınız; karşı tarafı görebilirsiniz."
          : `Kamera/mikrofon yok — yalnızca izleme modundasınız. [${lastErr || "cihaz yok"}]`);
      }
      if (stream && localVideoRef.current) { localVideoRef.current.srcObject = stream; localVideoRef.current.play().catch(() => {}); }

      // ICE sunucuları sunucudan (yönetilen TURN — Cloudflare birincil, Metered yedek). Cross-network
      // (farklı WiFi/mobil) bağlantı için TURN relay şart; sağlayıcısızsa STUN+OpenRelay'e düşer. Bkz. lib/ice + /api/realtime/ice.
      const { iceServers, turnOk } = await getIceServers();
      const pc = new RTCPeerConnection({ iceServers });
      pcRef.current = pc;
      if (stream) stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      // Tercüman canlıyken pc yeniden kurulduysa ("Tekrar dene") çeviri track'ini yeni sender'a
      // yeniden uygula — aksi halde UI "canlı" derken karşıya sessizce ham ses gider.
      if (translationTrackRef.current) applyTranslationTrack(translationTrackRef.current);
      // Kamera/mik yoksa karşı tarafın yayınını alabilmek için alıcı kanal ekle
      if (!hasVideo) { try { pc.addTransceiver("video", { direction: "recvonly" }); } catch {} }
      if (!hasAudio) { try { pc.addTransceiver("audio", { direction: "recvonly" }); } catch {} }
      pc.ontrack = (e) => {
        if (remoteVideoRef.current) {
          const el = remoteVideoRef.current;
          el.srcObject = e.streams[0];
          // Uzak sesi duyulur kıl. Autoplay politikası sesli oynatmayı taze bir jest olmadan engelleyebilir
          // (özellikle mobil) → reddedilirse "Sesi aç" butonu göster. (Tek-sıçrama mimarisinde karşının
          // ÇEVİRİSİ de bu elementten gelir → AEC referansına girer; ayrı çalma yolu yok.)
          el.play().then(() => setRemoteAudioBlocked(false)).catch(() => setRemoteAudioBlocked(true));
        }
        setRemoteOn(true);
      };
      pc.onicecandidate = (e) => { if (e.candidate) send("ice", e.candidate.toJSON()); };
      pc.onconnectionstatechange = () => {
        const s = pc.connectionState;
        setConnState(s);
        if (s === "connected") { setPhase("connected"); setErrMsg(""); }
        // Bağlantı koptu: TURN yoksa (turnOk=false) doktora GERÇEK nedeni söyle (eksik/geçersiz
        // sağlayıcı anahtarı ya da ICE ucu hatası); hasta yüzüne teknik detay yok → genel mesaj (UI[]
        // içinde, errMsg banner'ı t() ile çevirir; doktor metni texts'te yok → t() kimlik döndürür).
        else if (s === "failed") setErrMsg(!turnOk && isDoctor
          ? "Bağlantı kurulamadı — TURN relay yok (sağlayıcı anahtarı eksik/geçersiz/erişilemiyor). Farklı ağdaki hastalar için .env + Vercel'de CF_TURN_* / METERED_* anahtarlarını kontrol edin."
          : "Bağlantı kurulamadı (ağ/NAT). Sayfayı yenileyin; sorun sürerse internet bağlantınızı kontrol edin.");
      };
      pc.oniceconnectionstatechange = () => setConnState(pc.iceConnectionState);

      setPhase("waiting");
      // Ably realtime (birincil) — her iki taraf erkenden abone olur; DB poll (yedek) paralel sürer.
      ably = connectAblySignal(consultationId, selfRole, (m) => { handleSignal(m, pc); });
      if (!polling) ably.close(); // unmount getIceServers askısındayken oldu → zombie WS bırakma

      if (selfRole === "doctor") {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await send("offer", offer);
      }
      poll(pc);
    })();

    return shutdown; // unmount'ta da aynı teardown (bye ile tekilleştirildi)
  }, [consultationId, selfRole, status, joined, retry]);

  function toggleCam() { const t = localStreamRef.current?.getVideoTracks()[0]; if (t) { t.enabled = !t.enabled; setCamOn(t.enabled); } }
  // Not: toggleMic yalnız enabled bayrağını çevirir → tercüman canlıyken Gemini'ye de sessizlik gider
  // (çeviri durur; kuyruktaki ≤~0.6 sn boşalır) — istenen davranış (klon yok, tek mikrofon track'i).
  function toggleMic() { const t = localStreamRef.current?.getAudioTracks()[0]; if (t) { t.enabled = !t.enabled; setMicOn(t.enabled); } }

  // DEĞİŞMEZ (tek-sıçrama): audio sender'da her an ya micTrack ya translationTrack vardır; tercüman
  // "live" dışındaki HER duruma girişte micTrack'e dönülmüş olmalı (FAIL-OPEN). track=null → mikrofona dön.
  // Kapalı pc'de sessiz no-op (görüşme bitmiş olabilir — idempotent); hata yutulur, ham ses zaten m-line'da.
  function applyTranslationTrack(track: MediaStreamTrack | null) {
    translationTrackRef.current = track;
    const pc = pcRef.current;
    if (!pc || pc.connectionState === "closed") return;
    const sender = pc.getSenders().find((s) => s.track?.kind === "audio"); // çeviri track'i de audio → her iki durumda bulunur
    const mic = localStreamRef.current?.getAudioTracks()[0] ?? null;
    try { sender?.replaceTrack(track ?? mic)?.catch(() => {}); } catch {}
  }

  // Uzak sesi kullanıcı jestiyle aç (autoplay reddini aşar). Tek-sıçrama mimarisinde karşının çevirisi de
  // aynı elementten gelir → bu buton çeviri sesi için de tek kurtarma yoludur.
  function enableRemoteAudio() {
    const el = remoteVideoRef.current; if (!el) return;
    el.muted = false;
    el.play().then(() => setRemoteAudioBlocked(false)).catch(() => setRemoteAudioBlocked(true));
  }

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

  async function copyPatientLink() {
    const url = `${window.location.origin}/gorusme/${consultationId}?role=patient`;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  }

  async function endCall() {
    setEnding(true);
    try {
      await signalFetch(sigTokRef, `/api/consultations/${consultationId}/signal`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sender: selfRole, kind: "bye", data: "null" }) });
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
    ? t("Katılmaya hazır")
    : phase === "connected" ? t("Bağlandı")
    : phase === "waiting" ? t("Karşı taraf bekleniyor…")
    : phase === "connecting" ? t("Kamera açılıyor…")
    : phase === "ended" ? t("Görüşme sona erdi") : t("Hata");

  // ── Panel parçaları (immersive VideoCallShell düzeni, 2026-07-13) ──
  // Hasta: video full + [görüşme notları] · Doktor: video full + [ÜST script+hasta bilgi · ALT tanı+tedavi]
  const caseInfoCard = (
    <div className="rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="aura-display text-lg font-medium tracking-tight text-[var(--c-ink)]">{caseData.patientName}</h2>
        {/* Aciliyet yalnız doktora (2026-07-13, kullanıcı isteği) — hasta video odasında görmez */}
        {isDoctor && (
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${u.badge}`}>
            <span className={`h-2 w-2 rounded-full ${u.dot}`} /> {caseData.urgency}/5
          </span>
        )}
      </div>
      <div className="mt-1 flex items-center gap-2 text-sm">
        <Stethoscope size={14} className="text-[var(--c-accent-strong)]" />
        <span className="font-medium text-[var(--c-accent-strong)]">{t(caseData.branch)}</span>
      </div>
      <div className="mt-3">
        <div className="aura-mono text-[11px] uppercase tracking-[0.2em] text-[var(--c-ink-3)]">{t("Şikayet")}</div>
        <p className="mt-1 text-sm text-[var(--c-ink)]">{caseData.symptoms}</p>
        {isDoctor && <TranslateButton text={caseData.symptoms} defaultTarget="Türkçe" />}
      </div>
      {/* AI özeti kartı kaldırıldı (2026-07-14, kullanıcı isteği) — doktor triyaj gerekçesini görmez. */}
      {!isDoctor && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-200 ring-1 ring-emerald-400/20">
          <UserRound size={15} /> {doctor.title} {doctor.name} {t("ile görüşüyorsunuz")}
        </div>
      )}
      {caseData.files.length > 0 && isDoctor && (
        <div className="mt-3">
          <div className="aura-mono text-[11px] uppercase tracking-[0.2em] text-[var(--c-ink-3)]">Belgeler</div>
          <ul className="mt-1.5 space-y-1">
            {caseData.files.map((f) => <li key={f} className="flex items-center gap-1.5 text-xs text-[var(--c-ink-2)]"><FileText size={13} className="text-[var(--c-accent)]" /> {f}</li>)}
          </ul>
        </div>
      )}
    </div>
  );

  const inviteEl = isDoctor ? (
    <div className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--c-accent)]/25 bg-[var(--c-accent)]/10 p-3 landscape:border-white/15 landscape:bg-white/10">
      <div className="text-sm text-[var(--c-ink-2)] landscape:text-white/85">
        <span className="font-semibold text-[var(--c-accent)] landscape:text-[#5dd6e2]">Hastayı davet et:</span> bu görüşme bağlantısını hastayla paylaş.
      </div>
      <button onClick={copyPatientLink} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--c-panel)] px-3 py-2 text-sm font-medium text-[var(--c-accent)] ring-1 ring-[var(--c-accent)]/25 hover:bg-[var(--c-accent)]/15 landscape:bg-white/15 landscape:text-[#5dd6e2]">
        {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Kopyalandı" : "Hasta linkini kopyala"}
      </button>
    </div>
  ) : null;

  // Tek-sıçrama: konuşan KENDİ mikrofonunu KARŞININ diline çevirtir (targetLang eski mimarinin TERSİ);
  // kart yalnız mikrofon varken (hasMicAudio) — kaynak kendi sesi, mikrofonsuz izleme modunda anlamsız.
  const interpreterEl = joined && langsDiffer && hasMicAudio && phase !== "ended" ? (
    <LiveInterpreter
      lang={uiLang}
      targetLang={isDoctor ? (SPEECH_LANG[caseData.language]?.split("-")[0] ?? "en") : "tr"}
      targetLabel={isDoctor ? caseData.language : "Türkçe"}
      autoMode={langsDiffer}
      autoStart={interpAutoStart}
      getLocalStream={() => localStreamRef.current}
      onTranslationTrack={applyTranslationTrack}
      patientConsentNote={!isDoctor}
    />
  ) : null;

  const transcriptEl = (joined || transcript.length > 0) ? (
    <div className="rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 aura-mono text-[11px] uppercase tracking-[0.2em] text-[var(--c-ink-2)]">
          <MessageSquareText size={14} /> {t("Canlı Transkript")}
          {sttOn && <span className="ms-1 inline-flex h-2 w-2 animate-pulse rounded-full bg-red-500" />}
        </div>
        {!sttSupported ? (
          <span className="text-[11px] text-[var(--c-ink-3)]">{t("Tarayıcı desteklemiyor — Chrome/Edge önerilir")}</span>
        ) : sttOn ? (
          <button
            onClick={() => { setSttErr(""); setSttOn(false); }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-400/30 bg-red-500/10 px-2.5 py-1.5 text-[12px] font-medium text-red-300 hover:bg-red-500/15"
          >
            <Mic size={13} /> {t("Durdur")}
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--c-ink)]/10 px-2.5 py-1.5 text-[12px] font-medium text-[var(--c-ink-2)]" title={t("Konuşma başlayınca otomatik yazıya dökülür; karşı tarafın konuşması da gelir.")}>
            <Mic size={13} /> {t("Otomatik")}
          </span>
        )}
      </div>
      {sttErr && <div className="mt-1 text-[11px] text-red-300">{t(sttErr)}</div>}
      <div className="mt-2 max-h-44 space-y-1 overflow-y-auto">
        {transcript.length === 0 && !interim && (
          <p className="text-xs text-[var(--c-ink-3)]">
            {t("Konuşma başlayınca otomatik yazıya dökülür; karşı tarafın konuşması da gelir.")}
            {isDoctor ? " Görüşme sonunda transkriptten tek tıkla SOAP taslağı oluşturabilirsiniz." : ""}
          </p>
        )}
        {transcript.map((l, i) => (
          <p key={i} className="text-sm leading-snug text-[var(--c-ink)]">
            <span className={`font-semibold ${l.who === "doctor" ? "text-[var(--c-accent-strong)]" : "text-emerald-300"}`}>
              {l.who === "doctor" ? t("Doktor") : t("Hasta")}:
            </span>{" "}
            {l.text}
          </p>
        ))}
        {interim && !dictating && <p className="text-sm italic text-[var(--c-ink-3)]">{interim}…</p>}
      </div>
    </div>
  ) : null;

  const notesEl = isDoctor ? (
    <div className="rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="aura-mono text-[11px] uppercase tracking-[0.2em] text-[var(--c-ink-2)]">Görüşme Notları</div>
        {saved ? <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300"><Check size={13} /> kaydedildi</span> : <span className="text-[11px] text-amber-300">kaydedilmedi</span>}
      </div>
      <textarea value={notes} onChange={(e) => { setNotes(e.target.value); setSaved(false); }} rows={6} placeholder="Görüşme sırasında dağınık not alın; AI ile SOAP'a dönüştürün…" className="mt-2 w-full resize-none rounded-lg border border-[var(--c-hairline)] p-2.5 text-sm outline-none focus:border-[var(--c-accent)]" />

      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          onClick={generateSoapFromTranscript}
          disabled={txBusy || !transcript.length}
          title={!transcript.length ? "Önce Canlı Transkript'i başlatın" : "Görüşme transkriptinden SOAP taslağı"}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-violet-400/30 bg-violet-500/10 px-2 py-2 text-[12px] font-semibold text-violet-300 hover:bg-violet-500/15 disabled:opacity-50"
        >
          {txBusy ? <Loader2 size={13} className="animate-spin" /> : <MessageSquareText size={13} />} Transkriptten taslak
        </button>
        <button
          onClick={() => { setSttErr(""); setDictating((v) => !v); }}
          disabled={!sttSupported}
          title="Konuşarak nota ekleyin"
          className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[12px] font-semibold disabled:opacity-50 ${dictating ? "border-red-400/30 bg-red-500/10 text-red-300 hover:bg-red-500/15" : "border-[var(--c-hairline)] bg-[var(--c-panel)] text-white/65 hover:bg-[var(--c-surface)]"}`}
        >
          <Mic size={13} /> {dictating ? "Dikteyi kapat" : "Sesli not"}
        </button>
      </div>
      {dictating && (
        <p className="mt-1 text-[11px] font-medium text-amber-300">
          🎤 Dikte açık — konuştuklarınız nota eklenir{interim ? `: "${interim}…"` : "."}
        </p>
      )}

      <button onClick={generateSoap} disabled={soapBusy || !notes.trim()} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--c-accent)]/30 bg-[var(--c-accent)]/10 px-3 py-2 text-sm font-semibold text-[var(--c-accent)] hover:bg-[var(--c-accent)]/15 disabled:opacity-50">
        {soapBusy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} AI · SOAP&apos;a dönüştür
      </button>
      {soapErr && <div className="mt-1 text-[11px] text-red-300">{soapErr}</div>}
      <button onClick={saveNotes} disabled={saving || saved} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--c-accent)] px-3 py-2 text-sm font-semibold text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)] disabled:opacity-50">
        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Notu kaydet
      </button>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <QuickAction icon={<Pill size={14} />}>Reçete</QuickAction>
        <QuickAction icon={<FlaskConical size={14} />}>Lab iste</QuickAction>
      </div>
      <button onClick={() => setShowDicom(true)} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--c-hairline)] bg-[var(--c-panel)] px-3 py-2 text-sm font-semibold text-[var(--c-ink)] hover:bg-[var(--c-surface)]">
        <FileImage size={15} /> Radyoloji (DICOM) görüntüleyici
      </button>
    </div>
  ) : null;

  const clinicalEl = isDoctor && clinical && recommend ? (
    <ClinicalDecisionPanel
      caseId={caseData.id}
      branchLabel={recommend.branchLabel}
      branchProcedures={recommend.branchProcedures}
      doctorPrices={recommend.doctorPrices}
      initial={recommend.initial}
      rate={recommend.rate}
      icd10Code={clinical.icd10Code}
      patientIdentifier={clinical.patientIdentifier}
      patientIdentifierType={clinical.patientIdentifierType}
      icd10Options={clinical.icd10Options}
      icdProcedures={clinical.icdProcedures}
      initialDaysMin={clinical.treatmentDaysMin}
      initialDaysMax={clinical.treatmentDaysMax}
      initialHospitalId={clinical.hospitalRegistryId}
      initialHospitalName={clinical.hospitalName}
      agencySentAt={clinical.agencySentAt}
      getNotes={() => notes}
    />
  ) : null;

  const patientQuestionsEl = !isDoctor && storageKey ? (
    <PatientQuestionsPanel storageKey={storageKey} lang={uiLang} />
  ) : null;

  return (
    <>
      <VideoCallShell
        dir={langDir(uiLang)}
        lang={LANG_BCP47[uiLang]}
        panelLabel={isDoctor ? t("Doktor görünümü") : t("Hasta görünümü")}
        statusBar={
          <div className="flex items-center justify-between gap-2 text-xs font-medium text-white/90">
            <span className="inline-flex items-center gap-2">
              <span className={`inline-flex h-2.5 w-2.5 rounded-full ${phase === "connected" ? "bg-emerald-400" : phase === "ended" || phase === "error" ? "bg-white/40" : "bg-amber-400 animate-pulse"}`} />
              {statusLabel} · {isDoctor ? t("Doktor görünümü") : t("Hasta görünümü")}{connState ? ` · ${connState}` : ""}
            </span>
            <span className="hidden items-center gap-1.5 rounded-full bg-black/35 px-3 py-1 sm:inline-flex">
              {phase === "connected" ? <Wifi size={13} /> : <WifiOff size={13} />} {t("Gerçek WebRTC (P2P)")}
            </span>
          </div>
        }
        video={
          <div className="absolute inset-0 bg-[var(--c-bg-deep)]">
            {/* Uzak taraf (gerçek video) — tüm alanı doldurur */}
            <video ref={remoteVideoRef} autoPlay playsInline className={`h-full w-full object-cover ${remoteOn ? "" : "hidden"}`} />
            {/* Uzak ses autoplay ile engellendiyse kullanıcı jestiyle aç — tek-sıçrama mimarisinde
                karşının ÇEVİRİSİ de bu elementten gelir, bu buton çeviri için de tek kurtarma yolu */}
            {remoteOn && remoteAudioBlocked && (
              <button onClick={enableRemoteAudio} className="absolute left-1/2 top-14 z-20 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-[var(--c-ink)]/90 px-3 py-1.5 text-xs font-semibold text-[var(--c-bg)] shadow-lg ring-1 ring-black/5 hover:bg-white">
                <Volume2 size={14} /> {t("Karşı tarafın sesini aç")}
              </button>
            )}
            {!remoteOn && (
              <div className="absolute inset-0 grid place-items-center p-4 text-center">
                {!joined ? (
                  <div>
                    <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[var(--c-ink)]/10 text-[var(--c-ink)]"><Camera size={28} /></span>
                    <h3 className="mt-3 text-lg font-semibold text-[var(--c-ink)]">{t("Görüşmeye katılın")}</h3>
                    <p className="mx-auto mt-1 max-w-xs text-sm text-[var(--c-ink-2)]">{t("Bağlanmak için kamera ve mikrofon izni vermeniz gerekir.")}</p>
                    <button onClick={() => { setErrMsg(""); setPhase("connecting"); setJoined(true); }} className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
                      <Video size={17} /> {t("Kamera & mikrofonla katıl")}
                    </button>
                  </div>
                ) : phase === "error" ? (
                  <div>
                    <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-amber-500/20 text-amber-300"><AlertTriangle size={28} /></span>
                    <p className="mx-auto mt-3 max-w-xs text-sm text-[var(--c-ink)]">{errMsg ? t(errMsg) : t("Kamera/mikrofona erişilemedi.")}</p>
                    <p className="mx-auto mt-1 max-w-xs text-xs text-[var(--c-ink-2)]">{t("Adres çubuğundaki kilit/kamera simgesine dokunup Kamera ve Mikrofon'a \"İzin ver\" deyin, sonra tekrar deneyin.")}</p>
                    <button onClick={() => { setErrMsg(""); setPhase("connecting"); setRetry((r) => r + 1); }} className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--c-ink)]/10 px-5 py-2.5 text-sm font-semibold text-[var(--c-ink)] ring-1 ring-white/15 hover:bg-[var(--c-ink)]/20">
                      {t("Tekrar dene")}
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[var(--c-ink)]/10 text-2xl font-bold text-[var(--c-ink)]">{remoteName.slice(0, 1)}</div>
                    <div className="mt-3 font-medium text-[var(--c-ink)]">{remoteName}</div>
                    <div className="text-xs text-[var(--c-ink-2)]">{phase === "waiting" ? t("karşı taraf bekleniyor…") : t("kamera açılıyor…")}</div>
                    <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--c-ink)]/10 px-3 py-1 text-xs text-[var(--c-ink-2)]"><Languages size={13} /> {t("Canlı çeviri")}: {caseData.language} ⇄ Türkçe ({t("demo")})</div>
                  </div>
                )}
              </div>
            )}

            {/* Yerel self-view — dikey: sağ üst · yatay: sol üst (sağdaki cam panelin arkasında kalmasın) */}
            {joined && (
              <div className="absolute top-14 right-3 h-24 w-36 overflow-hidden rounded-2xl border border-[var(--c-hairline)] bg-black/60 shadow-lg sm:h-28 sm:w-44 landscape:right-auto landscape:left-3">
                <video ref={localVideoRef} autoPlay muted playsInline className={`h-full w-full object-cover ${camOn ? "" : "hidden"}`} />
                {!camOn && <div className="grid h-full place-items-center text-center text-[11px] text-[var(--c-ink-2)]"><div><Camera size={18} className="mx-auto mb-1" /> {t("Kamera kapalı")}</div></div>}
                <span className="absolute left-1.5 top-1.5 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-[var(--c-ink)]">{t("Siz")}</span>
              </div>
            )}

            {/* Kontroller — video altında ortada */}
            {joined && (
              <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2">
                <button onClick={toggleCam} aria-label={camOn ? t("Kamerayı kapat") : t("Kamerayı aç")} aria-pressed={camOn} className={`grid h-11 w-11 place-items-center rounded-full backdrop-blur ${camOn ? "bg-white/15 text-white hover:bg-white/25" : "bg-[var(--c-panel)] text-[var(--c-ink)]"}`}>
                  {camOn ? <Video size={18} /> : <VideoOff size={18} />}
                </button>
                <button onClick={toggleMic} aria-label={micOn ? t("Mikrofonu kapat") : t("Mikrofonu aç")} aria-pressed={micOn} className={`grid h-11 w-11 place-items-center rounded-full backdrop-blur ${micOn ? "bg-white/15 text-white hover:bg-white/25" : "bg-[var(--c-panel)] text-[var(--c-ink)]"}`}>
                  {micOn ? <Mic size={18} /> : <MicOff size={18} />}
                </button>
                <button onClick={endCall} disabled={ending} className="inline-flex h-11 items-center gap-2 rounded-full bg-red-600 px-5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                  {ending ? <Loader2 size={17} className="animate-spin" /> : <PhoneOff size={17} />} {t("Bitir")}
                </button>
              </div>
            )}

            {/* Hata mesajı — video üzerinde toast (kontrollerin üstünde) */}
            {errMsg && <div className="absolute inset-x-4 bottom-20 z-20 mx-auto max-w-md rounded-lg bg-amber-500/15 px-3 py-2 text-center text-sm text-amber-200 ring-1 ring-amber-400/25 backdrop-blur">{t(errMsg)}</div>}
          </div>
        }
        panel={
          isDoctor ? (
            <>
              {/* ── ÜST: Hasta bilgileri + script (transkript) ── */}
              {startTime !== null && <ConsultationTimer startTime={startTime} active={phase !== "ended"} />}
              {caseInfoCard}
              {inviteEl}
              {interpreterEl}
              {transcriptEl}
              {/* ── ALT: Tanı & Tedavi ── (yatayda koyu cam zemin → açık başlık) */}
              <div className="mt-1 flex items-center gap-1.5 border-t border-[var(--c-hairline)] pt-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--c-ink-3)] landscape:border-white/15 landscape:text-white/80">
                <Stethoscope size={12} /> {t("Tanı & Tedavi")}
              </div>
              {notesEl}
              {clinicalEl}
            </>
          ) : (
            <>
              {/* Hasta: görüşme notları — bilgi + çeviri + transkript + doktora sorular */}
              {caseInfoCard}
              {interpreterEl}
              {transcriptEl}
              {patientQuestionsEl}
            </>
          )
        }
      />
      <DicomViewer open={showDicom} onClose={() => setShowDicom(false)} />
    </>
  );
}

function QuickAction({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--c-hairline)] px-3 py-2 text-xs text-[var(--c-ink-3)]" title="Yakında">
      {icon} {children}
    </button>
  );
}
