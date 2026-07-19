"use client";

// AI Canlı Tercüman (Gemini Live · gemini-3.5-live-translate-preview) — gerçek zamanlı ses→ses.
// MİMARİ (tek-sıçrama, feat/tercuman-tek-sicrama): her taraf KENDİ mikrofonunu Gemini'ye çevirtir
// (WebRTC sıkıştırması/jitter'ı çeviri yolundan çıkar; modele temiz 16 kHz PCM gider). Çeviri 24 kHz
// PCM, hoparlöre DEĞİL MediaStreamAudioDestinationNode'a yazılır; üretilen track odaya
// onTranslationTrack(track) ile verilir → oda, audio sender'ında replaceTrack yapar (renegotiation
// YOK). Dinleyen çeviriyi normal remote <video> elementinden duyar (tarayıcı AEC referansına girer).
// DEĞİŞMEZ: audio sender'da her an ya micTrack ya translationTrack vardır; "live" dışındaki HER
// duruma girişte onTranslationTrack(null) ile mikrofona dönülmüş olmalı (FAIL-OPEN — iletişim asla kopmaz).
// Token: /api/realtime/token (ephemeral, v1alpha; hedef dil token'a kilitli).
// replaceTrack ÇİFT KAPI ile yapılır: ilk çeviri ses parçası FİİLEN planlandı VE playCtx "running"
// (aksi halde karşıya sessiz track gitme riski — fail-open ihlali olurdu; ilk cümlenin başının ham
// gitmesi kabul edilen yan etkidir).
import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/useT";
import { langDir } from "@/lib/constants";
import { Languages, Loader2, KeyRound, Mic, Square, Headphones, AlertTriangle, Volume2, ShieldCheck } from "lucide-react";

type Status = "checking" | "disabled" | "idle" | "connecting" | "live" | "error";

// Çevrilen UI metinleri (TR kanonik). lang prop odadan gelir (hasta=kendi dili, doktor=Türkçe).
const UI = [
  "AI Canlı Tercüman", "canlı",
  "Konuşmanız karşı tarafa anında", "olarak sesli iletilir; çevirinin yazılı halini burada görürsünüz.",
  "kontrol ediliyor…", "Devre dışı —", "gerekli.",
  "Tercümeyi başlat", "kulaklık önerilir (hoparlör sesi çeviriye karışabilir)",
  "Ses, girişte verdiğiniz KVKK açık onamı kapsamında yalnızca gerçek zamanlı çeviri için işlenir.",
  "Ses yalnızca gerçek zamanlı çeviri için işlenir.",
  "bağlanılıyor…", "sizi dinliyor…", "Durdur", "Siz",
  "Siz konuşmaya başlayınca otomatik devreye girer…",
  // sabit hata mesajları (dinamik olanlar TR'ye düşer)
  "Mikrofon bulunamadı — tercüman başlatılamadı.",
  "Tercüman durdu — sesiniz karşıya çevrilmeden iletiliyor. Yeniden başlatabilirsiniz.",
  "Token alınamadı.", "Bağlantı hatası.", "Başlatılamadı.",
];

// Gemini'den gelen ses verisini (base64 string VEYA binary) Uint8Array'e çevir
function toBytes(data: unknown): Uint8Array | null {
  if (!data) return null;
  if (typeof data === "string") {
    try { const bin = atob(data); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; } catch { return null; }
  }
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) { const v = data as ArrayBufferView; return new Uint8Array(v.buffer, v.byteOffset, v.byteLength); }
  return null;
}

export function LiveInterpreter({
  targetLang, targetLabel, getLocalStream, onTranslationTrack, lang = "Türkçe",
  autoStart = false, autoMode = false, patientConsentNote = true,
}: {
  /** KARŞININ dili (BCP-47 kısa kod) — kendi konuşman bu dile çevrilip karşıya gider. */
  targetLang: string;
  /** Karşının dil adı (UI gösterimi). */
  targetLabel: string;
  /** Mikrofon kaynağı — odanın localStream'i (yeni getUserMedia YAPILMAZ). */
  getLocalStream: () => MediaStream | null;
  /** Çeviri track'i hazır → oda sender.replaceTrack yapar; null → mikrofona dön (FAIL-OPEN). */
  onTranslationTrack: (track: MediaStreamTrack | null) => void;
  lang?: string;
  /** Diller farklı → otomatik tercüme modu (manuel "başlat" düğmesi gizlenir, gösterge görünür). */
  autoMode?: boolean;
  /** İlk YEREL konuşma sesi algılandı → bir kez otomatik start() (VAD tetiği; oda yalnız yerel seste verir). */
  autoStart?: boolean;
  /** HASTA görünümü: onam-atıflı KVKK satırı (hasta AI_INTERPRET onamını girişte verir). Doktor
   *  görünümünde false → nötr metin (doktor onamın öznesi değil; personel işlemesi hizmet gereği —
   *  kullanıcı/avukat kararı, 2026-07-19). */
  patientConsentNote?: boolean;
}) {
  const { t } = useT(lang, UI);
  const [status, setStatus] = useState<Status>("checking");
  const [err, setErr] = useState("");
  const [heard, setHeard] = useState("");
  const [trans, setTrans] = useState("");
  const [attached, setAttached] = useState(false); // çeviri track'i sender'da — "canlı" rozeti ancak o zaman (UI iletimi doğrulasın)
  const [dbg, setDbg] = useState({ chunks: 0, subs: 0 }); // tanı: üretilen çeviri ses parçası / altyazı sayısı
  // KVKK açık onam girişte bir kez alınır (lib/consent + /onam) → her video başında tekrar sorulmaz.

  const sessionRef = useRef<{ sendRealtimeInput: (x: unknown) => void; close: () => void } | null>(null);
  const capCtxRef = useRef<AudioContext | null>(null);
  const playCtxRef = useRef<AudioContext | null>(null);
  const destRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const nextPlayRef = useRef(0);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const srcRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const liveRef = useRef(false);
  const switchedRef = useRef(false); // çeviri track'i sender'a uygulandı mı (çift kapı geçildi mi)
  const autoStartedRef = useRef(false);
  // NESİL SAYACI: her start() yeni nesil açar; teardown aktif nesli geçersiz kılar. Hızlı
  // Durdur→Başlat'ta iptal edilmiş start'ın await-sonrası hayata dönmesini (çift oturum, ref
  // ezilmesi, bayat onclose'un taze oturumu öldürmesi) kökten engeller.
  const genRef = useRef(0);
  const resumeCleanupRef = useRef<(() => void) | null>(null); // askıda-context kurtarma dinleyicileri
  // SESSİZ-ÖLÜM BEKÇİSİ: attach sonrası Gemini WS yarı-açık ölürse (mobil ağ geçişi) ya da model
  // üretimi durursa onerror/onclose GELMEZ → sender sessiz çeviri track'inde kalırdı (fail-open
  // ihlali). Bekçi: yerel konuşma sürerken son çeviri parçası 10 sn'den eskiyse failOpen.
  const lastChunkAtRef = useRef(0); // son çeviri ses parçasının planlandığı an (performance.now)
  const lastLoudAtRef = useRef(0);  // mikrofonda son "ses var" anı (sendPcm ucuz RMS)
  const watchdogRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    (async () => {
      try { const r = await fetch("/api/realtime/token"); if (!r.ok) return setStatus("disabled"); const d = await r.json(); setStatus(d.enabled ? "idle" : "disabled"); }
      catch { setStatus("disabled"); }
    })();
    return () => { teardown(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // VAD tetiği: oda ilk YEREL konuşmayı algılayınca autoStart=true → bir kez otomatik başlat.
  // (status idle değilse/disabled ise dokunma; hata sonrası tekrar otomatik başlatma yapılmaz.)
  useEffect(() => {
    if (autoStart && status === "idle" && !autoStartedRef.current) {
      autoStartedRef.current = true;
      start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, status]);

  // ÇİFT KAPI: çeviri track'i sender'a ancak (1) ilk ses parçası FİİLEN planlandığında VE
  // (2) playCtx "running" iken takılır. Yalnız-live kapısı Gemini ses üretmezken karşıyı sessiz
  // bırakırdı; yalnız-ilk-chunk kapısı askıda context'te sessiz track gönderirdi. Askıdaysa ham
  // ses akmaya devam eder (fail-open) ve resume dinleyicileri/sonraki chunk yeniden dener.
  function maybeAttachTrack() {
    const ctx = playCtxRef.current, dest = destRef.current;
    if (!liveRef.current || switchedRef.current || !ctx || !dest) return;
    if (ctx.state !== "running") { ctx.resume().catch(() => {}); return; }
    switchedRef.current = true;
    setAttached(true);
    onTranslationTrack(dest.stream.getAudioTracks()[0] ?? null);
  }

  // PCM16 baytlarını 24kHz AudioBuffer olarak sıralı biçimde ÇEVİRİ HATTINA yaz (hoparlöre değil —
  // konuşan kendi çevirisini duymaz; dest track'i WebRTC sender'ına gider).
  function playChunk(bytes: Uint8Array) {
    const ctx = playCtxRef.current, dest = destRef.current; if (!ctx || !dest) return;
    // Context askıdaysa chunk PLANLAMA — donmuş currentTime üzerine yığılan parçalar resume anında
    // üst üste patlardı. Atla (karşıya ham ses zaten akıyor — attach çift kapısı geçilmemiştir ya da
    // askı sürerse bekçi mikrofona döndürür); resume denenir, sonraki chunk'lar düzgün planlanır.
    if (ctx.state !== "running") { ctx.resume().catch(() => {}); return; }
    const usable = bytes.length - (bytes.length % 2);
    if (usable <= 0) return;
    const int16 = new Int16Array(bytes.buffer, bytes.byteOffset, usable / 2);
    const f32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) f32[i] = int16[i] / 0x8000;
    const buf = ctx.createBuffer(1, f32.length, 24000);
    buf.getChannelData(0).set(f32);
    const node = ctx.createBufferSource();
    node.buffer = buf; node.connect(dest);
    // Kuyruk kayma sınırı: çeviri gerçek-zamandan MAX_DRIFT'ten fazla geri kaldıysa biriken gecikmeyi
    // at, "şimdi"ye hizala. Gecikme artık DİNLEYEN tarafta birikeceğinden bu sınırın önemi arttı.
    const MAX_DRIFT = 0.6; // sn
    if (nextPlayRef.current - ctx.currentTime > MAX_DRIFT) nextPlayRef.current = ctx.currentTime + 0.03;
    const ts = Math.max(ctx.currentTime + 0.03, nextPlayRef.current);
    node.start(ts);
    nextPlayRef.current = ts + buf.duration;
    lastChunkAtRef.current = performance.now(); // bekçi: çeviri üretimi canlı
    maybeAttachTrack(); // ilk chunk planlandı → (running ise) sender'ı çeviri track'ine geçir
  }

  function handleMessage(msg: { data?: unknown; serverContent?: { inputTranscription?: { text?: string }; outputTranscription?: { text?: string }; turnComplete?: boolean; modelTurn?: { parts?: { inlineData?: { data?: unknown } }[] } } }) {
    const sc = msg.serverContent;
    if (sc?.inputTranscription?.text) setHeard((p) => (p + sc.inputTranscription!.text).slice(-400));
    if (sc?.outputTranscription?.text) { setTrans((p) => (p + sc.outputTranscription!.text).slice(-400)); setDbg((d) => ({ ...d, subs: d.subs + 1 })); }
    // Ses: önce parts'tan al; yoksa msg.data'dan (çift yazmayı önle)
    let played = 0;
    for (const part of sc?.modelTurn?.parts ?? []) { const b = toBytes(part.inlineData?.data); if (b) { playChunk(b); played++; } }
    if (played === 0) { const b = toBytes(msg.data); if (b) { playChunk(b); played++; } }
    if (played) setDbg((d) => ({ ...d, chunks: d.chunks + played }));
    if (sc?.turnComplete) setHeard("");
  }

  async function start() {
    setErr(""); setHeard(""); setTrans(""); setDbg({ chunks: 0, subs: 0 });
    const gen = ++genRef.current; // bu start'ın nesli — teardown/yeni start gen'i ilerletir, bayat start ölür
    switchedRef.current = false;
    setStatus("connecting");

    // Mikrofon guard'ı: kaynak odanın localStream'i — odaya katılım anında hazırdır (remote-bekleme
    // YOK; eski "karşı-sesi-çevir" mimarisinin bekleme döngüsü bu mimaride kökten gereksiz).
    const micTrack = getLocalStream()?.getAudioTracks()[0];
    if (!micTrack) {
      setErr("Mikrofon bulunamadı — tercüman başlatılamadı.");
      setStatus("error");
      return;
    }

    // ÖNEMLİ: çıkış context'ini jest anında (await ÖNCESİ) oluştur + resume — aksi halde askıda
    // başlar. VARSAYILAN cihaz örnekleme oranı (24 kHz çıkışın 16 kHz'e ezilmemesi için sabit oran YOK).
    const playCtx = new AudioContext();
    playCtxRef.current = playCtx;
    try { await playCtx.resume(); } catch {}
    nextPlayRef.current = playCtx.currentTime;
    destRef.current = playCtx.createMediaStreamDestination();

    // Askıda-context kurtarma (iOS/Safari — VAD jestsiz auto-start'ta resume reddedilebilir):
    // ilk kullanıcı jestinde / sekme öne gelince İKİ context'i de resume et + track'i takmayı dene.
    const tryResume = () => { playCtx.resume().catch(() => {}); capCtxRef.current?.resume().catch(() => {}); maybeAttachTrack(); };
    window.addEventListener("pointerdown", tryResume);
    window.addEventListener("keydown", tryResume);
    document.addEventListener("visibilitychange", tryResume);
    resumeCleanupRef.current = () => {
      window.removeEventListener("pointerdown", tryResume);
      window.removeEventListener("keydown", tryResume);
      document.removeEventListener("visibilitychange", tryResume);
    };

    // Bayat-nesil çıkışı: bu start iptal edildiyse KENDİ kurduğu yerel kaynakları kapat (ref'ler
    // yeni neslin kaynaklarıyla ezilmiş olabilir — global teardown'a dokunmak yeni nesli bozar).
    let localSession: { close: () => void } | null = null;
    let localCapCtx: AudioContext | null = null;
    const bailIfStale = (): boolean => {
      if (gen === genRef.current) return false;
      try { localSession?.close(); } catch {}
      try { localCapCtx?.close(); } catch {}
      try { playCtx.close(); } catch {}
      return true;
    };

    try {
      // Hedef dili token'a gönder → sunucu çeviri hedefini token'a kilitler (yoksa model "en"e düşer)
      const tr = await fetch("/api/realtime/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLang }),
      });
      const td = await tr.json();
      if (!tr.ok || !td.token) throw new Error(td.error?.message || td.error || "Token alınamadı.");
      if (bailIfStale()) return;

      const { GoogleGenAI, Modality } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: td.token, httpOptions: { apiVersion: "v1alpha" } });

      // ⚖️ ZDR/KVKK: SessionResumptionConfig EKLENMEZ → oturum durumu (ses dahil) saklanmaz
      // (aksi halde Gemini Live oturumu 24 saate kadar saklar). Grounding (Search/Maps) ve
      // context caching de yok → ek saklama yok. Bkz. wiki/kavramlar/ai-ceviri-veri-uyumlulugu.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const config: any = {
        responseModalities: [Modality.AUDIO],
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        translationConfig: { targetLanguageCode: targetLang, echoTargetLanguage: false },
      };
      const session = await ai.live.connect({
        model: td.model || "gemini-3.5-live-translate-preview",
        callbacks: {
          onopen: () => {},
          onmessage: handleMessage,
          // Kopma = FAIL-OPEN: teardown İLK işi onTranslationTrack(null) → karşıya anında ham ses;
          // "error" durumu manuel düğme + bilgi metni gösterir (oto-yeniden-bağlanma bilinçli YOK).
          // Bayat neslin (ezilmiş/eski oturum) callback'i taze oturumu YIKMASIN — gen kontrolü.
          onerror: (e: { message?: string }) => { if (gen === genRef.current) failOpen(e?.message); },
          onclose: () => { if (gen === genRef.current && liveRef.current) failOpen(); },
        },
        config,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any;
      localSession = session;
      if (bailIfStale()) return;
      sessionRef.current = session;

      // KENDİ mikrofonunu yakala → 16kHz PCM → Gemini'ye akıt. 16 kHz context'i iOS/Safari'de
      // reddedilebilir → varsayılan orana düş (worklet _ratio zaten telafi eder).
      let capCtx: AudioContext;
      try { capCtx = new AudioContext({ sampleRate: 16000 }); } catch { capCtx = new AudioContext(); }
      localCapCtx = capCtx;
      capCtxRef.current = capCtx;
      const inRate = capCtx.sampleRate;
      // KLON YOK: odanın mikrofon toggle'ı (enabled=false) Gemini'ye de sessizlik göndersin (istenen).
      const srcNode = capCtx.createMediaStreamSource(new MediaStream([micTrack]));
      srcRef.current = srcNode;

      // 16kHz Int16 PCM parçasını Gemini'ye gönder (worklet + ScriptProcessor yedeği ORTAK yol).
      // Ucuz RMS (her 8. örnek): bekçinin "yerel konuşma var mı" sinyali — konuşma yokken chunk
      // gelmemesi normaldir, bekçi ancak KONUŞURKEN üretim kesilirse tetiklenmeli.
      const sendPcm = (int16: Int16Array) => {
        if (!liveRef.current) return;
        let sum = 0, n = 0;
        for (let i = 0; i < int16.length; i += 8) { const v = int16[i] / 0x8000; sum += v * v; n++; }
        if (n > 0 && Math.sqrt(sum / n) > 0.02) lastLoudAtRef.current = performance.now();
        const u8 = new Uint8Array(int16.buffer, int16.byteOffset, int16.byteLength);
        let binStr = ""; for (let i = 0; i < u8.length; i++) binStr += String.fromCharCode(u8[i]);
        try { sessionRef.current?.sendRealtimeInput({ audio: { data: btoa(binStr), mimeType: "audio/pcm;rate=16000" } }); } catch {}
      };

      // AudioWorklet (modern, düşük-gecikmeli, AYRI iş parçacığı, ~20 ms gruplar). addModule await'i
      // sırasında Durdur'a basılırsa iptal. Kurulamazsa (eski tarayıcı) ScriptProcessor yedeğine düş.
      let usedWorklet = false;
      try {
        await capCtx.audioWorklet.addModule("/worklets/pcm-capture.js");
        if (bailIfStale()) return;
        const node = new AudioWorkletNode(capCtx, "pcm-capture");
        workletRef.current = node;
        node.port.onmessage = (ev) => sendPcm(new Int16Array(ev.data as ArrayBuffer));
        const sink = capCtx.createGain(); sink.gain.value = 0;
        srcNode.connect(node); node.connect(sink); sink.connect(capCtx.destination);
        usedWorklet = true;
      } catch { usedWorklet = false; }

      if (!usedWorklet) {
        // Yedek: ScriptProcessorNode (deprecated; ~256 ms tampon + ana-iş-parçacığı ama geniş uyum).
        const proc = capCtx.createScriptProcessor(4096, 1, 1);
        procRef.current = proc;
        proc.onaudioprocess = (e) => {
          if (!liveRef.current) return;
          const input = e.inputBuffer.getChannelData(0);
          const ratio = inRate / 16000;
          const outLen = Math.floor(input.length / ratio);
          const int16 = new Int16Array(outLen);
          for (let i = 0; i < outLen; i++) { const s = Math.max(-1, Math.min(1, input[Math.floor(i * ratio)])); int16[i] = s * 0x7fff; }
          sendPcm(int16);
        };
        const sink = capCtx.createGain(); sink.gain.value = 0;
        srcNode.connect(proc); proc.connect(sink); sink.connect(capCtx.destination);
      }

      liveRef.current = true;
      // SESSİZ-ÖLÜM BEKÇİSİ: attach edilmişken, yerel konuşma son 10 sn içinde sürüyor ama son
      // çeviri parçası 10 sn'den eskiyse Gemini sessizce ölmüş demektir → failOpen (mikrofona dön).
      lastLoudAtRef.current = 0; lastChunkAtRef.current = 0;
      watchdogRef.current = setInterval(() => {
        if (!liveRef.current || !switchedRef.current) return;
        const now = performance.now();
        if (lastLoudAtRef.current > 0 && now - lastLoudAtRef.current < 10_000 &&
            lastChunkAtRef.current > 0 && now - lastChunkAtRef.current > 10_000) failOpen();
      }, 2500);
      setStatus("live");
      // replaceTrack BURADA YAPILMAZ — çift kapı (ilk chunk + running) maybeAttachTrack'te.
    } catch (e) {
      if (bailIfStale()) return; // iptal edilmiş neslin hatası taze durumu kirletmesin
      setStatus("error"); setErr(e instanceof Error ? e.message : "Başlatılamadı.");
      teardown();
    }
  }

  // Beklenmedik kopma (Gemini onerror/onclose): mikrofona dön + görünür fail-open bilgisi + manuel düğme.
  function failOpen(detail?: string) {
    teardown();
    setErr(detail || "Tercüman durdu — sesiniz karşıya çevrilmeden iletiliyor. Yeniden başlatabilirsiniz.");
    setStatus("error");
  }

  function teardown() {
    genRef.current++; // aktif nesli geçersiz kıl — await'te bekleyen start bailIfStale ile ölür
    liveRef.current = false;
    if (watchdogRef.current) { clearInterval(watchdogRef.current); watchdogRef.current = null; }
    // DEĞİŞMEZ gereği İLK İŞ: oda mikrofona dönsün — context'ler kapanmadan ÖNCE, aksi halde
    // sender'da sonlanmış track kalır → görüşmenin kalanında karşıya kalıcı sessizlik.
    try { onTranslationTrack(null); } catch {}
    switchedRef.current = false;
    setAttached(false);
    try { resumeCleanupRef.current?.(); } catch {}
    resumeCleanupRef.current = null;
    try { workletRef.current?.disconnect(); } catch {}
    try { procRef.current?.disconnect(); } catch {}
    try { srcRef.current?.disconnect(); } catch {}
    try { capCtxRef.current?.close(); } catch {}
    try { playCtxRef.current?.close(); } catch {}
    try { sessionRef.current?.close(); } catch {}
    workletRef.current = null; procRef.current = null; srcRef.current = null; capCtxRef.current = null; playCtxRef.current = null; destRef.current = null; sessionRef.current = null;
  }

  function stop() { teardown(); setStatus("idle"); }

  return (
    <div dir={langDir(lang)} className="rounded-3xl border border-[var(--c-accent)]/25 bg-[var(--c-panel)] p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 aura-mono text-[11px] uppercase tracking-[0.2em] text-[var(--c-accent)]">
          <Languages size={15} /> {t("AI Canlı Tercüman")}
          <span className="rounded-full bg-teal-600 px-1.5 py-0.5 text-[9px] tracking-normal text-white">Gemini</span>
        </div>
        {/* "canlı" rozeti ancak çeviri track'i FİİLEN sender'dayken (attached) — UI iletimi doğrulasın,
            çift kapı geçilmeden "canlı" gösterip kullanıcıyı yanıltmasın */}
        {status === "live" && attached && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-300"><span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> {t("canlı")}</span>}
      </div>

      <p className="mt-2 text-xs leading-relaxed text-[var(--c-ink-2)]">
        {t("Konuşmanız karşı tarafa anında")} <strong className="text-[var(--c-ink)]">{targetLabel}</strong> {t("olarak sesli iletilir; çevirinin yazılı halini burada görürsünüz.")}
      </p>

      {status === "checking" && <div className="mt-3 inline-flex items-center gap-2 text-xs text-[var(--c-ink-3)]"><Loader2 size={13} className="animate-spin" /> {t("kontrol ediliyor…")}</div>}

      {status === "disabled" && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-500/10 p-2.5 text-[11px] leading-relaxed text-amber-300 ring-1 ring-amber-400/20">
          <KeyRound size={13} className="mt-0.5 shrink-0" /> <span>{t("Devre dışı —")} <code className="rounded bg-amber-500/15 px-1">GEMINI_API_KEY</code> {t("gerekli.")}</span>
        </div>
      )}

      {(status === "idle" || status === "error") && (
        <div className="mt-3">
          {/* KVKK açık onam giriş sırasında bir kez alınır (/onam) → burada tekrar kapı yok. */}
          {/* Otomatik mod (diller farklı): ilk YEREL konuşmada otomatik başlar → manuel düğme yerine gösterge.
              Hata durumunda (status==="error") manuel düğme kalır (otomatik kurtarma yapılmaz).
              Tek atımlık tetik TÜKETİLDİYSE (başladı/denendi/Durdur'uldu) göstergede kilitlenme — düğmeye düş. */}
          {autoMode && status === "idle" && !autoStartedRef.current ? (
            <div className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--c-accent)]/10 px-3 py-2 text-sm font-medium text-[var(--c-accent)] ring-1 ring-[var(--c-accent)]/20">
              <Mic size={15} className="text-[var(--c-accent)]" /> {t("Siz konuşmaya başlayınca otomatik devreye girer…")}
            </div>
          ) : (
            <button
              onClick={start}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
            >
              <Mic size={15} /> {t("Tercümeyi başlat")}
            </button>
          )}
          <p className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-[var(--c-ink-3)]"><Headphones size={11} /> {t("kulaklık önerilir (hoparlör sesi çeviriye karışabilir)")}</p>
          <p className="mt-1 flex items-start gap-1 text-[10px] leading-relaxed text-[var(--c-ink-3)]"><ShieldCheck size={11} className="mt-0.5 shrink-0 text-[var(--c-accent)]" /> {t(patientConsentNote ? "Ses, girişte verdiğiniz KVKK açık onamı kapsamında yalnızca gerçek zamanlı çeviri için işlenir." : "Ses yalnızca gerçek zamanlı çeviri için işlenir.")}</p>
          {err && <p className="mt-1 flex items-start gap-1 text-[11px] text-red-300"><AlertTriangle size={12} className="mt-0.5 shrink-0" /> {t(err)}</p>}
        </div>
      )}

      {(status === "connecting" || status === "live") && (
        <div className="mt-3">
          <div className="min-h-[3.5rem] rounded-lg bg-[var(--c-surface)] p-2.5 ring-1 ring-[var(--c-hairline)]">
            {heard && <p className="text-[11px] text-[var(--c-ink-3)]">🎙 {t("Siz")}: {heard}</p>}
            <p className="mt-0.5 text-sm font-medium text-[var(--c-ink)]">{trans || (status === "connecting" ? t("bağlanılıyor…") : t("sizi dinliyor…"))}</p>
          </div>
          <div className="mt-2 flex items-center justify-between">
            {/* Durdur "connecting"de de aktif — bağlanma kullanıcı tarafından iptal edilebilmeli */}
            <button onClick={stop} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--c-hairline)] bg-[var(--c-panel)] px-3 py-1.5 text-sm font-medium text-[var(--c-ink-2)] hover:bg-[var(--c-surface)]">
              {status === "connecting" ? <Loader2 size={14} className="animate-spin" /> : <Square size={14} />} {t("Durdur")}
            </button>
            <span className="inline-flex items-center gap-1 text-[10px] text-[var(--c-ink-3)]" title="tanı: çeviri ses parçası · altyazı">
              <Volume2 size={11} /> {dbg.chunks} · 📝 {dbg.subs}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
