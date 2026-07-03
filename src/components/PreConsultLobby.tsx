"use client";

// Görüşme Öncesi Oda (Pre-Consultation Lobby) — Dijital Bekleme Odası Faz B.
// İki video akışının ÖNÜNE gelen paylaşılan hazırlık arayüzü (cross-cutting bileşen):
//   • B1 Cihaz testi: kamera ön-izleme + kamera/mik/hoparlör seçimi (enumerateDevices) + canlı ses düzeyi
//   • B2 Geri sayım + 3 alt-durum: saatten önce (Katıl kilitli + neden) / saat geldi (aktif) / katıldıktan sonra (oda devralır)
//   • B3 Hazırlık ipucu + soru-notu + sakin ton
// Kullanım: (a) children ile sarmalanır (Talk → ConsultationRoom), (b) onJoin callback'i ile (SO → SoVideoRoom).
// ConsultationRoom'a DOKUNULMAZ; lobi onun ÖNÜNE konur. Tasarım: [[dijital-bekleme-odasi]].

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Video, VideoOff, Mic, MicOff, Volume2, Camera, Clock, Lock,
  AlertTriangle, NotebookPen, Headphones, Sun, FileText, CheckCircle2,
  HelpCircle, ShieldCheck, ALargeSmall,
  Star, BadgeCheck, ChevronDown, ChevronUp, ExternalLink, GraduationCap,
  Award, Heart, Zap, Activity, Stethoscope, MapPin, type LucideIcon,
} from "lucide-react";
import { useT } from "@/components/useT";
import { langDir, LANG_BCP47, VIDEO_CARD_SCRIPT } from "@/lib/constants";
import { AuraSpinner } from "@/components/PortamedLogo";
import { DoctorArt } from "@/components/PortamedArt";
import { DoctorVideoCard } from "@/components/DoctorVideoCard";
import type { DoctorCardData } from "@/lib/doctor-card";

// TR kanonik UI metinleri — useT ile hasta diline çevrilir (çeviri gelene kadar TR).
const TX = {
  title: "Görüşmeye hazırlanın",
  subtitle: "Görüşme öncesi cihazlarınızı kontrol edin; hazır olduğunuzda katılın.",
  appt: "Randevu",
  remaining: "Görüşmeye kalan süre",
  day: "gün", hour: "saat", min: "dakika", sec: "saniye",
  join: "Görüşmeye katıl",
  lockPre: "Randevudan",
  lockPost: "önce “Katıl” düğmesi etkinleşir. Bu sırada cihazlarınızı test edebilirsiniz.",
  waitingDoctor: "Doktorunuz sizi bekliyor.",
  almost: "Görüşmenize az kaldı — şimdi katılabilirsiniz.",
  readyNow: "Görüşmeniz hazır. Bağlanmak için katılın.",
  doctorNote: "Hasta randevu için bekleniyor. Hazır olduğunuzda katılabilirsiniz.",
  deviceTest: "Cihaz testi",
  preview: "Kamera ön-izleme",
  camera: "Kamera", microphone: "Mikrofon", speaker: "Hoparlör",
  micLevel: "Mikrofon düzeyi",
  micHint: "Konuşun; çubuğun hareket ettiğini görmelisiniz.",
  testTone: "Test sesi çal",
  camOff: "Kamera kapalı",
  noCam: "Kamera bulunamadı — sesli katılabilirsiniz.",
  prompting: "Kamera ve mikrofon izni isteniyor…",
  denied: "Kamera/mikrofon izni reddedildi. Adres çubuğundaki kilit simgesinden izin verip yeniden deneyin.",
  retry: "Yeniden dene",
  permNote: "İzin verdiğinizde ön-izleme görünür. En iyi deneyim için Chrome veya Safari kullanın.",
  prep: "Görüşmeye hazırlık",
  tip1: "Tıbbi raporlarınızı ve ilaç listenizi yanınızda bulundurun.",
  tip2: "Sessiz, aydınlık ve internet bağlantısı güçlü bir yer seçin.",
  tip3: "Kulaklık kullanmak ses kalitesini artırır, yankıyı önler.",
  notesLabel: "Doktora sormak istedikleriniz",
  notesPh: "Görüşmede sormak istediğiniz soruları buraya not edin…",
  notesSaved: "Notlarınız bu cihaza kaydedildi.",
  you: "Siz",
  // Faz C — erişilebilirlik + dürüst güven
  bigText: "Büyük yazı",
  help: "Yardım",
  helpTitle: "Sorun mu yaşıyorsunuz?",
  helpBody: "Görüntü veya ses gelmiyorsa: sayfayı yenileyin, internet bağlantınızı kontrol edin ve Chrome ya da Safari kullanın. Cihaz izinlerini adres çubuğundaki kilit simgesinden açabilirsiniz.",
  secure: "Görüşme bağlantınız şifrelidir; bilgileriniz KVKK kapsamında, açık onayınızla işlenir.",
  // Atanan doktor kartı (yalnız hasta görünümü)
  yourDoctor: "Doktorunuz",
  verified: "Doğrulanmış",
  reviews: "yorum",
  tapForDetails: "Profil özeti için dokunun",
  about: "Hakkında",
  stExperience: "Deneyim",
  stSuccess: "Başarı oranı",
  stYears: "yıl",
  trustBadges: "Güven rozetleri",
  academicTitle: "Akademik & Eğitim",
  videoCard: "Video Kartvizit",
  videoAria: "tanıtım videosu",
  credentialsTitle: "Akreditasyon",
  diploma: "Tıp Diploması",
  speciality: "Uzmanlık Belgesi",
  fullProfile: "Tam profili gör",
} as const;

type Props = {
  /** Geçerli arayüz dili ("Türkçe", "Arapça"…) — useT/langDir kaynağı. */
  lang: string;
  /** Opsiyonel dil seçici (SO: <SoLangSelect/>; Talk: vaka diline sabit → geçilmez). */
  langSelector?: React.ReactNode;
  /** SO randevu zamanı (ISO). null/undefined → Talk (anlık, geri sayım yok). */
  scheduledAt?: string | null;
  /** "Katıl" randevudan kaç dk önce açılır (kullanıcı kararı: 15). */
  earlyWindowMin?: number;
  /** Doktor görünümü → geri sayım kilidi uygulanmaz (doktor hazır beklemeli). */
  isDoctor?: boolean;
  /** Karşı tarafın adı (hasta doktoru, doktor hastayı görür). */
  remoteLabel?: string;
  /** Branş etiketi (gösterim). */
  branchLabel?: string;
  /** Soru-notu localStorage anahtarı (SO: appointmentId, Talk: consultationId). */
  storageKey?: string;
  /** Atanan doktor özeti — yalnız hasta görünümünde tıklanabilir kart olarak gösterilir. */
  doctorCard?: DoctorCardData | null;
  /** SO entegrasyonu: Katıl'a basınca çağrılır (oda kendi joined state'ini açar). */
  onJoin?: () => void;
  /** Talk entegrasyonu: Katıl sonrası render edilen oda (ConsultationRoom). */
  children?: React.ReactNode;
};

export function PreConsultLobby({
  lang, langSelector, scheduledAt = null, earlyWindowMin = 15,
  isDoctor = false, remoteLabel, branchLabel, storageKey, doctorCard, onJoin, children,
}: Props) {
  // texts referansı SABİT olmalı: lobi ses metresi/geri sayım ile sık re-render eder; memoize edilmezse
  // useT'nin effect'i her render yeniden kurulur → uçuştaki çeviri fetch'i cleanup ile iptal olur (çeviri hiç gelmez).
  const texts = useMemo(() => [...Object.values(TX), ...VIDEO_CARD_SCRIPT, ...(branchLabel ? [branchLabel] : [])], [branchLabel]);
  const { t } = useT(lang, texts);
  const dir = langDir(lang);

  const [entered, setEntered] = useState(false);

  // ── Cihaz / ön-izleme ──
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const mounted = useRef(true);

  const [perm, setPerm] = useState<"prompting" | "granted" | "denied">("prompting");
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [spks, setSpks] = useState<MediaDeviceInfo[]>([]);
  const [selCam, setSelCam] = useState("");
  const [selMic, setSelMic] = useState("");
  const [selSpk, setSelSpk] = useState("");
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [hasCam, setHasCam] = useState(true);
  const [level, setLevel] = useState(0);

  // ── Erişilebilirlik (Faz C): büyük yazı (cihaz-yerel) + yardım paneli ──
  const [bigText, setBigText] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  // ── Atanan doktor kartı (hasta görünümü) satır-içi genişleme ──
  const [docOpen, setDocOpen] = useState(false);
  const showDoctorCard = !isDoctor && !!doctorCard;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tercih yalnız istemcide (SSR'de localStorage yok)
    try { if (localStorage.getItem("air_preconsult_bigtext") === "1") setBigText(true); } catch {}
  }, []);
  const toggleBigText = () => setBigText((v) => {
    const n = !v;
    try { localStorage.setItem("air_preconsult_bigtext", n ? "1" : "0"); } catch {}
    return n;
  });

  // ── Soru-notu (cihaz-yerel) ──
  const [note, setNote] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kalıcı not yalnız istemcide (SSR'de localStorage yok)
    try { const v = localStorage.getItem(`air_preconsult_note_${storageKey ?? "x"}`); if (v) setNote(v); } catch {}
  }, [storageKey]);
  const onNote = (v: string) => {
    setNote(v);
    try { localStorage.setItem(`air_preconsult_note_${storageKey ?? "x"}`, v); } catch {}
  };

  // ── Geri sayım (hidrasyon-güvenli: now yalnız mount sonrası) ──
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- saat yalnız istemcide başlar (hidrasyon uyuşmazlığını önler)
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Ses düzeyi metresi (Web Audio) ──
  const stopMeter = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }, []);
  const startMeter = useCallback((stream: MediaStream) => {
    stopMeter();
    if (stream.getAudioTracks().length === 0) return;
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 256;
      src.connect(an);
      const buf = new Uint8Array(an.fftSize);
      const tick = () => {
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
        const rms = Math.sqrt(sum / buf.length);
        if (mounted.current) setLevel(Math.min(1, rms * 3));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {}
  }, [stopMeter]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
  }, []);
  const stopAll = useCallback(() => { stopMeter(); stopStream(); }, [stopMeter, stopStream]);

  // ── Cihaz akışını al (ilk yükleme + cihaz değişiminde) ──
  const acquire = useCallback(async (camId?: string, micId?: string) => {
    setPerm((p) => (p === "granted" ? p : "prompting"));
    stopMeter();
    stopStream();
    if (!navigator.mediaDevices?.getUserMedia) { setPerm("denied"); setHasCam(false); return; }
    const vc: MediaTrackConstraints | boolean = camId ? { deviceId: { exact: camId } } : true;
    const ac: MediaTrackConstraints | boolean = micId ? { deviceId: { exact: micId } } : true;
    let stream: MediaStream | null = null;
    let lastErr = "";
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: vc, audio: ac });
    } catch (e) {
      lastErr = (e as DOMException)?.name || "";
      if (["NotFoundError", "OverconstrainedError", "NotReadableError", "DevicesNotFoundError"].includes(lastErr)) {
        // Kamera yok/erişilemiyor → sesle dene (kullanıcı yine de katılabilsin)
        try { stream = await navigator.mediaDevices.getUserMedia({ audio: ac }); lastErr = ""; }
        catch (e2) { lastErr = (e2 as DOMException)?.name || lastErr; }
      }
    }
    if (!mounted.current) { stream?.getTracks().forEach((tr) => tr.stop()); return; }
    if (!stream) {
      if (lastErr === "NotAllowedError" || lastErr === "SecurityError") setPerm("denied");
      else { setPerm("granted"); setHasCam(false); } // cihaz yok ama izin reddi değil → sesli katılıma izin ver
      return;
    }
    streamRef.current = stream;
    const vtrack = stream.getVideoTracks()[0];
    const atrack = stream.getAudioTracks()[0];
    setHasCam(!!vtrack);
    setCamOn(!!vtrack && vtrack.enabled);
    setMicOn(!!atrack && atrack.enabled);
    setPerm("granted");
    if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); }
    if (vtrack) setSelCam(vtrack.getSettings().deviceId ?? camId ?? "");
    if (atrack) setSelMic(atrack.getSettings().deviceId ?? micId ?? "");
    // Etiketler ancak izin sonrası gelir → şimdi numaralandır
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      if (!mounted.current) return;
      setCams(list.filter((d) => d.kind === "videoinput"));
      setMics(list.filter((d) => d.kind === "audioinput"));
      const outs = list.filter((d) => d.kind === "audiooutput");
      setSpks(outs);
      setSelSpk((cur) => cur || (outs[0]?.deviceId ?? ""));
    } catch {}
    startMeter(stream);
  }, [startMeter, stopMeter, stopStream]);

  useEffect(() => {
    mounted.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- medya cihazı senkronu (getUserMedia) = harici sistem; etki için doğru yer
    acquire();
    return () => { mounted.current = false; stopAll(); };
  }, [acquire, stopAll]);

  function toggleCam() { const tr = streamRef.current?.getVideoTracks()[0]; if (tr) { tr.enabled = !tr.enabled; setCamOn(tr.enabled); } }
  function toggleMic() { const tr = streamRef.current?.getAudioTracks()[0]; if (tr) { tr.enabled = !tr.enabled; setMicOn(tr.enabled); } }

  async function playTestTone() {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      const osc = ctx.createOscillator(); osc.type = "sine"; osc.frequency.value = 600;
      const gain = ctx.createGain(); gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      const dest = ctx.createMediaStreamDestination();
      osc.connect(gain); gain.connect(dest);
      const a = new Audio(); a.srcObject = dest.stream;
      const anyA = a as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
      if (selSpk && anyA.setSinkId) { try { await anyA.setSinkId(selSpk); } catch {} }
      await a.play().catch(() => {});
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
      osc.stop(ctx.currentTime + 0.62);
      setTimeout(() => { try { a.pause(); } catch {} ctx.close().catch(() => {}); }, 800);
    } catch {}
  }

  const sinkSupported = typeof window !== "undefined" && typeof (HTMLMediaElement.prototype as unknown as { setSinkId?: unknown }).setSinkId === "function";

  function doJoin() { stopAll(); onJoin?.(); setEntered(true); }

  // ── Katıldıktan sonra: oda devralır (3. alt-durum = "doktorunuz birazdan katılacak" odada) ──
  if (entered) return <>{children ?? null}</>;

  // ── Geri sayım / alt-durum hesabı ──
  const schedMs = scheduledAt ? new Date(scheduledAt).getTime() : null;
  const windowMs = earlyWindowMin * 60_000;
  let subState: "before" | "within" | "time" | "now" = "now"; // 'now' = randevusuz (Talk)
  let canJoin = true;
  let remainMs = 0;
  if (schedMs !== null) {
    if (nowMs === null) { subState = "before"; canJoin = isDoctor; } // ilk tick öncesi: kilitle (yanıp sönmesin)
    else {
      remainMs = schedMs - nowMs;
      if (remainMs > windowMs) { subState = "before"; canJoin = isDoctor; }
      else if (remainMs > 0) { subState = "within"; canJoin = true; }
      else { subState = "time"; canJoin = true; }
    }
  }

  const locale = LANG_BCP47[lang] ?? "tr-TR";
  const nf = new Intl.NumberFormat(locale);
  const seg = (n: number, unit: string) => `${nf.format(n)} ${t(unit)}`;
  function fmtCountdown(ms: number): string {
    const s = Math.max(0, Math.floor(ms / 1000));
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (d > 0) return `${seg(d, TX.day)} ${seg(h, TX.hour)}`;
    if (h > 0) return `${seg(h, TX.hour)} ${seg(m, TX.min)}`;
    return `${seg(m, TX.min)} ${seg(sec, TX.sec)}`;
  }
  const apptStr = schedMs !== null
    ? new Intl.DateTimeFormat(locale, { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }).format(new Date(schedMs))
    : "";

  const statusLine = isDoctor && schedMs !== null ? t(TX.doctorNote)
    : subState === "time" ? t(TX.waitingDoctor)
    : subState === "within" ? t(TX.almost)
    : subState === "now" ? t(TX.readyNow)
    : "";

  return (
    <div dir={dir} style={bigText ? { zoom: 1.18 } : undefined} className="mx-auto max-w-3xl px-5 py-10">
      {/* Başlık + erişilebilirlik kontrolleri */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#101010]">{t(TX.title)}</h1>
          <p className="mt-1 text-sm text-slate-500">{t(TX.subtitle)}</p>
          {!showDoctorCard && (remoteLabel || branchLabel) && (
            <p className="mt-1 text-xs text-slate-400">
              {branchLabel ? t(branchLabel) : ""}{branchLabel && remoteLabel ? " · " : ""}{remoteLabel ?? ""}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {langSelector}
          <div className="flex items-center gap-1.5">
            <button onClick={toggleBigText} aria-pressed={bigText}
              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium ${bigText ? "border-[#14C3D0] bg-cyan-50 text-[#0EA5B2]" : "border-slate-300 text-slate-500 hover:bg-slate-50"}`}>
              <ALargeSmall size={14} /> {t(TX.bigText)}
            </button>
            <button onClick={() => setShowHelp((v) => !v)} aria-expanded={showHelp}
              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium ${showHelp ? "border-[#14C3D0] bg-cyan-50 text-[#0EA5B2]" : "border-slate-300 text-slate-500 hover:bg-slate-50"}`}>
              <HelpCircle size={14} /> {t(TX.help)}
            </button>
          </div>
        </div>
      </div>

      {/* Yardım paneli (Faz C) — pratik sorun giderme (insan çıpası: dürüst, gerçek adımlar) */}
      {showHelp && (
        <div className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50/60 p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-[#0EA5B2]"><HelpCircle size={15} /> {t(TX.helpTitle)}</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{t(TX.helpBody)}</p>
        </div>
      )}

      {/* Atanan doktor kartı (yalnız hasta) — tıklayınca public profil ÖZETİ satır-içi genişler */}
      {showDoctorCard && doctorCard && (
        <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <button
            onClick={() => setDocOpen((o) => !o)}
            aria-expanded={docOpen}
            className="flex w-full items-center gap-3 p-4 text-start hover:bg-slate-50"
          >
            <span className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl ring-1 ring-slate-200">
              <DoctorArt i={doctorCard.avatarVariant} female={doctorCard.female} photo={doctorCard.photo} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-slate-400">{t(TX.yourDoctor)}</span>
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="font-bold text-[#101010]">{doctorCard.title} {doctorCard.name}</span>
                {doctorCard.verified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-700"><BadgeCheck size={11} /> {t(TX.verified)}</span>
                )}
              </span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1 font-medium text-[#0EA5B2]"><Stethoscope size={12} /> {branchLabel ? t(branchLabel) : doctorCard.branch}</span>
                <span className="inline-flex items-center gap-1"><MapPin size={12} /> {doctorCard.city}</span>
                {/* rating null = veri yok → yıldız bloğu tamamen gizlenir (0.0 gösterilmez) */}
                {doctorCard.rating != null && (
                  <span className="inline-flex items-center gap-1"><Star size={12} className="fill-amber-400 text-amber-400" /> {doctorCard.rating.toFixed(1)}{doctorCard.reviewCount > 0 ? ` · ${doctorCard.reviewCount} ${t(TX.reviews)}` : ""}</span>
                )}
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-center text-slate-400">
              {docOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              {!docOpen && <span className="mt-0.5 hidden text-[9px] sm:block">{t(TX.tapForDetails)}</span>}
            </span>
          </button>

          {docOpen && (
            <div className="space-y-4 border-t border-slate-100 px-4 pb-4 pt-4">
              {/* Hakkında (doktor bio kanonik metin) */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t(TX.about)}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{doctorCard.bio}</p>
              </div>

              {/* İstatistik çubukları — null = veri yok → o metrik gizlenir (reviewCount>0 deseniyle aynı) */}
              {(doctorCard.experienceYears != null || doctorCard.successRate != null) && (
                <div className="grid grid-cols-2 gap-3">
                  {doctorCard.experienceYears != null && (
                    <MiniStat label={t(TX.stExperience)} valueText={`${doctorCard.experienceYears} ${t(TX.stYears)}`} pct={(doctorCard.experienceYears / 30) * 100} />
                  )}
                  {doctorCard.successRate != null && (
                    <MiniStat label={t(TX.stSuccess)} valueText={`%${doctorCard.successRate}`} pct={doctorCard.successRate} />
                  )}
                </div>
              )}

              {/* Güven rozetleri */}
              {doctorCard.badges.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t(TX.trustBadges)}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {doctorCard.badges.map((b) => {
                      const Icon = BADGE_ICON[b.key] ?? CheckCircle2;
                      return (
                        <span key={b.key} title={b.desc} className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200">
                          <Icon size={12} /> {b.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Akreditasyon özeti */}
              <div>
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400"><ShieldCheck size={12} /> {t(TX.credentialsTitle)}</p>
                <ul className="mt-1.5 space-y-1.5 text-[13px] text-slate-600">
                  {/* yıl null (veri yok) → sarkık " · " ayracı bırakma (v4.19) */}
                  <li className="flex items-start gap-1.5"><BadgeCheck size={14} className="mt-0.5 shrink-0 text-emerald-600" /><span><span className="font-medium text-slate-700">{t(TX.diploma)}:</span> {doctorCard.credentials.diplomaSchool}{doctorCard.credentials.diplomaYear != null ? ` · ${doctorCard.credentials.diplomaYear}` : ""}</span></li>
                  <li className="flex items-start gap-1.5"><BadgeCheck size={14} className="mt-0.5 shrink-0 text-emerald-600" /><span><span className="font-medium text-slate-700">{t(TX.speciality)}:</span> {doctorCard.credentials.specBoard}{doctorCard.credentials.specYear != null ? ` · ${doctorCard.credentials.specYear}` : ""}</span></li>
                </ul>
              </div>

              {/* Akademik */}
              <div>
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400"><GraduationCap size={12} /> {t(TX.academicTitle)}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{doctorCard.academic}</p>
              </div>

              {/* Video kartvizit — hasta dilinde: varsa dil-bazlı video varyantı, her durumda çevrilmiş altyazı */}
              <div>
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400"><Video size={12} /> {t(TX.videoCard)}</p>
                <div className="mt-1.5">
                  <DoctorVideoCard
                    name={doctorCard.name}
                    title={doctorCard.title}
                    female={doctorCard.female}
                    lang={lang}
                    subtitles={VIDEO_CARD_SCRIPT.map((s) => t(s))}
                    ariaLabel={`${doctorCard.title} ${doctorCard.name} ${t(TX.videoAria)}`}
                  />
                </div>
              </div>

              {/* public profil verified-kapılı (v4.19) — doğrulanmamış doktorda 404'e götüren link gösterme */}
              {doctorCard.verified && (
                <a href={`/hekim/${doctorCard.id}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                  <ExternalLink size={13} /> {t(TX.fullProfile)}
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {/* Geri sayım + Katıl (en görünür öğe) */}
      <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        {schedMs !== null && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Clock size={15} className="text-[#0EA5B2]" /> {t(TX.appt)}: <span className="font-semibold text-[#101010]">{apptStr}</span>
          </div>
        )}

        {schedMs !== null && (subState === "before" || subState === "within") && (
          <div className="mt-4 text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{t(TX.remaining)}</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-[#101010]">
              {nowMs === null ? "—" : fmtCountdown(remainMs)}
            </p>
          </div>
        )}

        {statusLine && (
          <p className={`mt-4 text-center text-[15px] font-medium ${subState === "time" ? "text-emerald-700" : "text-[#0EA5B2]"}`}>
            {subState === "time" && <CheckCircle2 size={16} className="me-1 inline align-[-2px]" />}
            {statusLine}
          </p>
        )}

        {/* Katıl düğmesi — geri sayımın hemen altında */}
        <div className="mt-5 flex flex-col items-center">
          <button
            onClick={doJoin}
            disabled={!canJoin}
            className={`inline-flex items-center gap-2 rounded-2xl px-8 py-3.5 text-[15px] font-semibold transition ${
              canJoin
                ? "bg-[#14C3D0] text-[#101010] hover:bg-[#0EA5B2]"
                : "cursor-not-allowed bg-slate-100 text-slate-400"
            }`}
          >
            {canJoin ? <Video size={18} /> : <Lock size={16} />} {t(TX.join)}
          </button>
          {!canJoin && (
            <p className="mt-2.5 max-w-sm text-center text-[13px] text-slate-500">
              {t(TX.lockPre)} {seg(earlyWindowMin, TX.min)} {t(TX.lockPost)}
            </p>
          )}
        </div>
      </div>

      {/* Cihaz testi + Hazırlık */}
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        {/* B1 — Cihaz testi */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-[#101010]">
            <Camera size={16} className="text-[#0EA5B2]" /> {t(TX.deviceTest)}
          </h2>

          {/* Ön-izleme */}
          <div className="relative mt-3 aspect-video overflow-hidden rounded-2xl bg-slate-900">
            <video ref={videoRef} autoPlay playsInline muted className={`h-full w-full object-cover ${hasCam && camOn ? "" : "hidden"}`} />
            {perm === "prompting" && (
              <div className="absolute inset-0 grid place-items-center text-center text-white/80">
                <div><AuraSpinner size={40} className="mx-auto" /><p className="mt-2 text-xs">{t(TX.prompting)}</p></div>
              </div>
            )}
            {perm === "denied" && (
              <div className="absolute inset-0 grid place-items-center p-4 text-center">
                <div>
                  <AlertTriangle size={28} className="mx-auto text-amber-300" />
                  <p className="mx-auto mt-2 max-w-xs text-xs text-white/85">{t(TX.denied)}</p>
                  <button onClick={() => acquire(selCam || undefined, selMic || undefined)} className="mt-3 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100">
                    {t(TX.retry)}
                  </button>
                </div>
              </div>
            )}
            {perm === "granted" && !hasCam && (
              <div className="absolute inset-0 grid place-items-center p-4 text-center text-white/70">
                <div><VideoOff size={26} className="mx-auto" /><p className="mt-2 text-xs">{t(TX.noCam)}</p></div>
              </div>
            )}
            {perm === "granted" && hasCam && !camOn && (
              <div className="absolute inset-0 grid place-items-center text-center text-white/70">
                <div><VideoOff size={26} className="mx-auto" /><p className="mt-2 text-xs">{t(TX.camOff)}</p></div>
              </div>
            )}
            <span className="absolute bottom-2 start-2 rounded bg-black/50 px-2 py-0.5 text-[11px] text-white">{t(TX.you)}</span>
          </div>

          {/* Kamera/mik aç-kapa */}
          <div className="mt-3 flex items-center justify-center gap-3">
            <button onClick={toggleMic} disabled={perm !== "granted"} className={`grid h-11 w-11 place-items-center rounded-full disabled:opacity-40 ${micOn ? "bg-slate-200 text-slate-700" : "bg-red-100 text-red-600"}`}>
              {micOn ? <Mic size={18} /> : <MicOff size={18} />}
            </button>
            <button onClick={toggleCam} disabled={perm !== "granted" || !hasCam} className={`grid h-11 w-11 place-items-center rounded-full disabled:opacity-40 ${camOn && hasCam ? "bg-slate-200 text-slate-700" : "bg-red-100 text-red-600"}`}>
              {camOn && hasCam ? <Video size={18} /> : <VideoOff size={18} />}
            </button>
          </div>

          {/* Mik düzeyi */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-slate-400">
              <span>{t(TX.micLevel)}</span>
            </div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-[#14C3D0] transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-slate-400">{t(TX.micHint)}</p>
          </div>

          {/* Cihaz seçimi */}
          <div className="mt-4 space-y-2.5">
            {cams.length > 0 && (
              <DeviceSelect icon={<Video size={13} />} label={t(TX.camera)} value={selCam} options={cams} fallback={t(TX.camera)}
                onChange={(id) => { setSelCam(id); acquire(id, selMic || undefined); }} />
            )}
            {mics.length > 0 && (
              <DeviceSelect icon={<Mic size={13} />} label={t(TX.microphone)} value={selMic} options={mics} fallback={t(TX.microphone)}
                onChange={(id) => { setSelMic(id); acquire(selCam || undefined, id); }} />
            )}
            {sinkSupported && spks.length > 0 && (
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <DeviceSelect icon={<Volume2 size={13} />} label={t(TX.speaker)} value={selSpk} options={spks} fallback={t(TX.speaker)}
                    onChange={(id) => setSelSpk(id)} />
                </div>
                <button onClick={playTestTone} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                  <Headphones size={13} /> {t(TX.testTone)}
                </button>
              </div>
            )}
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-slate-400">{t(TX.permNote)}</p>
        </div>

        {/* B3 — Hazırlık ipucu + soru-notu */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-[#101010]">
            <FileText size={16} className="text-[#0EA5B2]" /> {t(TX.prep)}
          </h2>
          <ul className="mt-3 space-y-2.5 text-[13px] text-slate-600">
            <li className="flex gap-2"><FileText size={15} className="mt-0.5 shrink-0 text-[#0EA5B2]" /><span>{t(TX.tip1)}</span></li>
            <li className="flex gap-2"><Sun size={15} className="mt-0.5 shrink-0 text-[#0EA5B2]" /><span>{t(TX.tip2)}</span></li>
            <li className="flex gap-2"><Headphones size={15} className="mt-0.5 shrink-0 text-[#0EA5B2]" /><span>{t(TX.tip3)}</span></li>
          </ul>

          <div className="mt-4">
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <NotebookPen size={14} /> {t(TX.notesLabel)}
            </label>
            <textarea
              value={note}
              onChange={(e) => onNote(e.target.value)}
              rows={5}
              placeholder={t(TX.notesPh)}
              className="mt-1.5 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-[#101010] outline-none placeholder:text-slate-400 focus:border-[#14C3D0] focus:bg-white"
            />
            {note.trim() && <p className="mt-1 text-[11px] text-slate-400">{t(TX.notesSaved)}</p>}
          </div>
        </div>
      </div>

      {/* Güven şeridi (Faz C) — yalnız DOĞRU iddialar: WebRTC bağlantı şifrelemesi + KVKK onam. E2EE/RFC 3161 = Faz 8 (henüz yok) → iddia EDİLMEZ. */}
      <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-400">
        <ShieldCheck size={13} className="text-emerald-500" /> {t(TX.secure)}
      </p>
    </div>
  );
}

// Doktor kartı güven rozeti ikonları (match-score MetricKey ile hizalı; /hekim/[id] ile aynı semantik).
const BADGE_ICON: Record<string, LucideIcon> = {
  rating: Star, volume: Award, freeCare: Heart, responsiveness: Zap, reliability: ShieldCheck, recency: Activity,
};

// Doktor kartı satır-içi istatistik çubuğu (değere göre amber→teal renk geçişi).
// pct <= 0 (veri yok/sıfır) → çubuk hiç çizilmez (min %6 kırpması "boş"u dolu göstermesin).
function MiniStat({ label, valueText, pct }: { label: string; valueText: string; pct: number }) {
  const hasBar = Number.isFinite(pct) && pct > 0;
  const p = hasBar ? Math.max(6, Math.min(100, Math.round(pct))) : 0;
  const hue = Math.round(40 + (p / 100) * 120);
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] text-slate-500">{label}</span>
        <span className="text-base font-bold text-[#101010]">{valueText}</span>
      </div>
      {hasBar && (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200/70">
          <div className="h-full rounded-full" style={{ width: `${p}%`, background: `hsl(${hue} 65% 45%)` }} />
        </div>
      )}
    </div>
  );
}

// Tek cihaz seçici (kamera/mik/hoparlör) — etiketsiz cihazlara güvenli geri-düşüş.
function DeviceSelect({
  icon, label, value, options, onChange, fallback,
}: {
  icon: React.ReactNode; label: string; value: string;
  options: MediaDeviceInfo[]; onChange: (id: string) => void; fallback: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">{icon} {label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 outline-none focus:border-[#14C3D0]"
      >
        {options.map((d, i) => (
          <option key={d.deviceId || i} value={d.deviceId}>{d.label || `${fallback} ${i + 1}`}</option>
        ))}
      </select>
    </label>
  );
}
