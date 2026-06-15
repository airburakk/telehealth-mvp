"use client";

// AI Canlı Tercüman (Gemini Live · gemini-3.5-live-translate-preview) — gerçek zamanlı ses→ses.
// Mimari: her taraf KARŞI TARAFIN gelen sesini kendi diline çevirip yerel oynatır.
// Token: /api/realtime/token (ephemeral, v1alpha). Ses giriş PCM 16kHz, çıkış 24kHz.
// ⚠️ Hoparlörde yankı olabilir → kulaklık önerilir.
//
// Düzeltme (test geri bildirimi): altyazı geliyordu ama ses gelmiyordu → oynatma AudioContext'i
// await'lerden sonra oluştuğu için ASKIDA başlıyordu. Çözüm: context'i tıklama anında oluştur +
// resume(); ses baytlarını her formatta sağlam çıkar; tanı sayaçları (chunk/altyazı).
import { useEffect, useRef, useState } from "react";
import { Languages, Loader2, KeyRound, Mic, Square, Headphones, AlertTriangle, Volume2, ShieldCheck } from "lucide-react";

type Status = "checking" | "disabled" | "idle" | "connecting" | "live" | "error";

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
  targetLang, targetLabel, otherLabel, getRemoteStream, onMuteRemote,
}: {
  targetLang: string; targetLabel: string; otherLabel: string;
  getRemoteStream: () => MediaStream | null;
  onMuteRemote: (muted: boolean) => void;
}) {
  const [status, setStatus] = useState<Status>("checking");
  const [err, setErr] = useState("");
  const [heard, setHeard] = useState("");
  const [trans, setTrans] = useState("");
  const [dbg, setDbg] = useState({ chunks: 0, subs: 0 }); // tanı: gelen ses parçası / altyazı sayısı
  const [consented, setConsented] = useState(false); // KVKK/GDPR açık rıza kapısı — ses Google'a aktarılmadan önce onay

  const sessionRef = useRef<{ sendRealtimeInput: (x: unknown) => void; close: () => void } | null>(null);
  const capCtxRef = useRef<AudioContext | null>(null);
  const playCtxRef = useRef<AudioContext | null>(null);
  const nextPlayRef = useRef(0);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const srcRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const liveRef = useRef(false);

  useEffect(() => {
    (async () => {
      try { const r = await fetch("/api/realtime/token"); if (!r.ok) return setStatus("disabled"); const d = await r.json(); setStatus(d.enabled ? "idle" : "disabled"); }
      catch { setStatus("disabled"); }
    })();
    return () => { teardown(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // PCM16 baytlarını 24kHz AudioBuffer olarak sıralı oynat
  function playChunk(bytes: Uint8Array) {
    const ctx = playCtxRef.current; if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const usable = bytes.length - (bytes.length % 2);
    if (usable <= 0) return;
    const int16 = new Int16Array(bytes.buffer, bytes.byteOffset, usable / 2);
    const f32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) f32[i] = int16[i] / 0x8000;
    const buf = ctx.createBuffer(1, f32.length, 24000);
    buf.getChannelData(0).set(f32);
    const node = ctx.createBufferSource();
    node.buffer = buf; node.connect(ctx.destination);
    const t = Math.max(ctx.currentTime + 0.03, nextPlayRef.current);
    node.start(t);
    nextPlayRef.current = t + buf.duration;
  }

  function handleMessage(msg: { data?: unknown; serverContent?: { inputTranscription?: { text?: string }; outputTranscription?: { text?: string }; turnComplete?: boolean; modelTurn?: { parts?: { inlineData?: { data?: unknown } }[] } } }) {
    const sc = msg.serverContent;
    if (sc?.inputTranscription?.text) setHeard((p) => (p + sc.inputTranscription!.text).slice(-400));
    if (sc?.outputTranscription?.text) { setTrans((p) => (p + sc.outputTranscription!.text).slice(-400)); setDbg((d) => ({ ...d, subs: d.subs + 1 })); }
    // Ses: önce parts'tan al; yoksa msg.data'dan (çift oynatmayı önle)
    let played = 0;
    for (const part of sc?.modelTurn?.parts ?? []) { const b = toBytes(part.inlineData?.data); if (b) { playChunk(b); played++; } }
    if (played === 0) { const b = toBytes(msg.data); if (b) { playChunk(b); played++; } }
    if (played) setDbg((d) => ({ ...d, chunks: d.chunks + played }));
    if (sc?.turnComplete) setHeard("");
  }

  async function start() {
    setErr(""); setHeard(""); setTrans(""); setDbg({ chunks: 0, subs: 0 });
    const remote = getRemoteStream();
    if (!remote || remote.getAudioTracks().length === 0) { setErr("Karşı taraf henüz bağlı değil (ses yok). Önce görüşmeye katılın."); return; }
    setStatus("connecting");

    // ÖNEMLİ: oynatma context'ini tıklama anında (gesture içinde, await ÖNCESİ) oluştur + resume →
    // aksi halde await'lerden sonra oluşunca askıda başlar ve ses çıkmaz.
    const playCtx = new AudioContext();
    playCtxRef.current = playCtx;
    try { await playCtx.resume(); } catch {}
    nextPlayRef.current = playCtx.currentTime;

    try {
      // Hedef dili token'a gönder → sunucu çeviri hedefini token'a kilitler (yoksa model "en"e düşer)
      const tr = await fetch("/api/realtime/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLang }),
      });
      const td = await tr.json();
      if (!tr.ok || !td.token) throw new Error(td.error?.message || td.error || "Token alınamadı.");

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
          onerror: (e: { message?: string }) => { setErr(e?.message || "Bağlantı hatası."); stop(); },
          onclose: () => { if (liveRef.current) stop(); },
        },
        config,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any;
      sessionRef.current = session;

      // Karşı tarafın gelen sesini yakala → 16kHz PCM → Gemini'ye akıt
      const capCtx = new AudioContext({ sampleRate: 16000 });
      capCtxRef.current = capCtx;
      const inRate = capCtx.sampleRate;
      const srcNode = capCtx.createMediaStreamSource(remote);
      srcRef.current = srcNode;
      const proc = capCtx.createScriptProcessor(4096, 1, 1);
      procRef.current = proc;
      proc.onaudioprocess = (e) => {
        if (!liveRef.current) return;
        const input = e.inputBuffer.getChannelData(0);
        const ratio = inRate / 16000;
        const outLen = Math.floor(input.length / ratio);
        const int16 = new Int16Array(outLen);
        for (let i = 0; i < outLen; i++) { const s = Math.max(-1, Math.min(1, input[Math.floor(i * ratio)])); int16[i] = s * 0x7fff; }
        const u8 = new Uint8Array(int16.buffer);
        let binStr = ""; for (let i = 0; i < u8.length; i++) binStr += String.fromCharCode(u8[i]);
        try { sessionRef.current?.sendRealtimeInput({ audio: { data: btoa(binStr), mimeType: "audio/pcm;rate=16000" } }); } catch {}
      };
      const sink = capCtx.createGain(); sink.gain.value = 0;
      srcNode.connect(proc); proc.connect(sink); sink.connect(capCtx.destination);

      onMuteRemote(true);
      liveRef.current = true;
      setStatus("live");
    } catch (e) {
      setStatus("error"); setErr(e instanceof Error ? e.message : "Başlatılamadı.");
      teardown();
    }
  }

  function teardown() {
    liveRef.current = false;
    try { procRef.current?.disconnect(); } catch {}
    try { srcRef.current?.disconnect(); } catch {}
    try { capCtxRef.current?.close(); } catch {}
    try { playCtxRef.current?.close(); } catch {}
    try { sessionRef.current?.close(); } catch {}
    procRef.current = null; srcRef.current = null; capCtxRef.current = null; playCtxRef.current = null; sessionRef.current = null;
  }

  function stop() { teardown(); onMuteRemote(false); setStatus("idle"); }

  return (
    <div className="rounded-2xl border border-teal-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-teal-700">
          <Languages size={15} /> AI Canlı Tercüman
          <span className="rounded-full bg-teal-600 px-1.5 py-0.5 text-[9px] tracking-normal text-white">Gemini</span>
        </div>
        {status === "live" && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600"><span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> canlı</span>}
      </div>

      <p className="mt-2 text-xs leading-relaxed text-slate-500">
        Karşı tarafın <strong className="text-slate-700">{otherLabel}</strong> konuşması anında <strong className="text-slate-700">{targetLabel}</strong> sesli + altyazı.
      </p>

      {status === "checking" && <div className="mt-3 inline-flex items-center gap-2 text-xs text-slate-400"><Loader2 size={13} className="animate-spin" /> kontrol ediliyor…</div>}

      {status === "disabled" && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-[11px] leading-relaxed text-amber-700 ring-1 ring-amber-100">
          <KeyRound size={13} className="mt-0.5 shrink-0" /> <span>Devre dışı — <code className="rounded bg-amber-100 px-1">GEMINI_API_KEY</code> gerekli.</span>
        </div>
      )}

      {(status === "idle" || status === "error") && (
        <div className="mt-3">
          {/* Aydınlatma + açık rıza kapısı — ses (özel nitelikli veri) sınır ötesi işlenir.
              ⚖️ Aşağıdaki metin HUKUKİ TASLAKTIR; veri sorumlusu/hukuk müşaviri nihai hâli vermeli.
              Bkz. wiki/kavramlar/ai-ceviri-veri-uyumlulugu. */}
          <div className="rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600 ring-1 ring-slate-200">
            <div className="flex items-center gap-1.5 font-semibold text-slate-700">
              <ShieldCheck size={13} className="text-teal-600" /> Veri işleme bilgilendirmesi (KVKK / GDPR)
            </div>
            <p className="mt-1">
              AI Canlı Tercüman, görüşmedeki sesi gerçek zamanlı çeviri amacıyla Google (Gemini) altyapısına
              aktarır ve ses yalnızca çeviri için işlenir. Devam etmek için bu aktarıma <strong>açık rıza</strong> gerekir.
            </p>
            <label className="mt-2 flex items-start gap-2 font-medium text-slate-700">
              <input type="checkbox" checked={consented} onChange={(e) => setConsented(e.target.checked)} className="mt-0.5 accent-teal-600" />
              <span>Bilgilendirmeyi okudum; sesin çeviri için Google'a aktarılmasına <strong>açık rıza</strong> alındı.</span>
            </label>
          </div>
          <button
            onClick={start}
            disabled={!consented}
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Mic size={15} /> Tercümeyi başlat
          </button>
          <p className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-slate-400"><Headphones size={11} /> kulaklık önerilir (hoparlörde yankı olabilir)</p>
          {err && <p className="mt-1 flex items-start gap-1 text-[11px] text-red-600"><AlertTriangle size={12} className="mt-0.5 shrink-0" /> {err}</p>}
        </div>
      )}

      {(status === "connecting" || status === "live") && (
        <div className="mt-3">
          <div className="min-h-[3.5rem] rounded-lg bg-slate-50 p-2.5 ring-1 ring-slate-100">
            {heard && <p className="text-[11px] text-slate-400">🎙 {otherLabel}: {heard}</p>}
            <p className="mt-0.5 text-sm font-medium text-slate-800">{trans || (status === "connecting" ? "bağlanılıyor…" : "dinleniyor…")}</p>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <button onClick={stop} disabled={status === "connecting"} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              {status === "connecting" ? <Loader2 size={14} className="animate-spin" /> : <Square size={14} />} Durdur
            </button>
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-400" title="tanı: gelen ses parçası · altyazı">
              <Volume2 size={11} /> {dbg.chunks} · 📝 {dbg.subs}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
