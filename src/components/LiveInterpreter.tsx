"use client";

// AI Canlı Tercüman (Gemini Live · gemini-3.5-live-translate-preview) — gerçek zamanlı ses→ses.
// Mimari: her taraf KARŞI TARAFIN gelen sesini kendi diline çevirip yerel oynatır
//   • Doktor: hastanın sesini (patientLang) → Türkçe duyar
//   • Hasta : doktorun sesini (Türkçe) → kendi dilinde duyar
// Cihazlar arası ses yönlendirmesi YOK; her taraf bağımsız Gemini oturumu açar.
// Token: /api/realtime/token (ephemeral). Ses giriş PCM 16kHz, çıkış 24kHz.
// ⚠️ Hoparlörde yankı olabilir → kulaklık önerilir.
import { useEffect, useRef, useState } from "react";
import { Languages, Loader2, KeyRound, Mic, Square, Headphones, AlertTriangle } from "lucide-react";

type Status = "checking" | "disabled" | "idle" | "connecting" | "live" | "error";

export function LiveInterpreter({
  targetLang, targetLabel, otherLabel, getRemoteStream, onMuteRemote,
}: {
  targetLang: string;       // hedef BCP-47 kısa kod ("tr", "ru", …) — yerel dinleyicinin dili
  targetLabel: string;      // hedef dil etiketi (gösterim)
  otherLabel: string;       // karşı tarafın dili (gösterim)
  getRemoteStream: () => MediaStream | null;
  onMuteRemote: (muted: boolean) => void;
}) {
  const [status, setStatus] = useState<Status>("checking");
  const [err, setErr] = useState("");
  const [heard, setHeard] = useState("");   // kaynak (duyulan) — canlı
  const [trans, setTrans] = useState("");   // çeviri (oynatılan) — canlı

  const sessionRef = useRef<{ sendRealtimeInput: (x: unknown) => void; close: () => void } | null>(null);
  const capCtxRef = useRef<AudioContext | null>(null);
  const playCtxRef = useRef<AudioContext | null>(null);
  const nextPlayRef = useRef(0);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const srcRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const liveRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/realtime/token");
        if (!r.ok) return setStatus("disabled");
        const d = await r.json();
        setStatus(d.enabled ? "idle" : "disabled");
      } catch { setStatus("disabled"); }
    })();
    return () => { teardown(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // base64(Int16 PCM) → AudioBuffer(24kHz) oynat (sıralı, boşluksuz)
  function playChunk(b64: string) {
    const ctx = playCtxRef.current; if (!ctx) return;
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const usable = bytes.length - (bytes.length % 2);
    const int16 = new Int16Array(bytes.buffer, 0, usable / 2);
    const f32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) f32[i] = int16[i] / 0x8000;
    if (!f32.length) return;
    const buf = ctx.createBuffer(1, f32.length, 24000);
    buf.getChannelData(0).set(f32);
    const node = ctx.createBufferSource();
    node.buffer = buf; node.connect(ctx.destination);
    const t = Math.max(ctx.currentTime + 0.02, nextPlayRef.current);
    node.start(t);
    nextPlayRef.current = t + buf.duration;
  }

  function handleMessage(msg: { serverContent?: { inputTranscription?: { text?: string }; outputTranscription?: { text?: string }; turnComplete?: boolean; modelTurn?: { parts?: { inlineData?: { data?: string } }[] } }; data?: string }) {
    const sc = msg.serverContent;
    if (sc?.inputTranscription?.text) setHeard((p) => (p + sc.inputTranscription!.text).slice(-400));
    if (sc?.outputTranscription?.text) setTrans((p) => (p + sc.outputTranscription!.text).slice(-400));
    // Çevrilmiş ses parçaları
    if (typeof msg.data === "string") playChunk(msg.data);
    for (const part of sc?.modelTurn?.parts ?? []) {
      if (part.inlineData?.data) playChunk(part.inlineData.data);
    }
    if (sc?.turnComplete) { setHeard(""); /* bir sonraki cümle için */ }
  }

  async function start() {
    setErr(""); setStatus("connecting"); setHeard(""); setTrans("");
    const remote = getRemoteStream();
    if (!remote || remote.getAudioTracks().length === 0) {
      setStatus("idle"); setErr("Karşı taraf henüz bağlı değil (ses yok). Önce görüşmeye katılın.");
      return;
    }
    try {
      const tr = await fetch("/api/realtime/token", { method: "POST" });
      const td = await tr.json();
      if (!tr.ok || !td.token) throw new Error(td.error?.message || td.error || "Token alınamadı.");

      const { GoogleGenAI, Modality } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: td.token, httpOptions: { apiVersion: "v1alpha" } });

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

      // Oynatma bağlamı
      const playCtx = new AudioContext();
      playCtxRef.current = playCtx; nextPlayRef.current = playCtx.currentTime;

      // Karşı tarafın gelen sesini yakala → 16kHz PCM → Gemini'ye akıt
      const capCtx = new AudioContext({ sampleRate: 16000 });
      capCtxRef.current = capCtx;
      const inRate = capCtx.sampleRate; // 16000 onurlandırılmazsa gerçek değeri al
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
        for (let i = 0; i < outLen; i++) {
          const s = Math.max(-1, Math.min(1, input[Math.floor(i * ratio)]));
          int16[i] = s * 0x7fff;
        }
        const u8 = new Uint8Array(int16.buffer);
        let binStr = ""; for (let i = 0; i < u8.length; i++) binStr += String.fromCharCode(u8[i]);
        try {
          sessionRef.current?.sendRealtimeInput({ audio: { data: btoa(binStr), mimeType: "audio/pcm;rate=16000" } });
        } catch {}
      };
      const sink = capCtx.createGain(); sink.gain.value = 0; // sessiz: orijinali tekrar çalma
      srcNode.connect(proc); proc.connect(sink); sink.connect(capCtx.destination);

      onMuteRemote(true);   // orijinal yabancı sesi kıs; yalnız çeviri duyulsun
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

  function stop() {
    teardown();
    onMuteRemote(false);
    setStatus("idle");
  }

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
          <KeyRound size={13} className="mt-0.5 shrink-0" />
          <span>Devre dışı — <code className="rounded bg-amber-100 px-1">GEMINI_API_KEY</code> gerekli.</span>
        </div>
      )}

      {(status === "idle" || status === "error") && (
        <div className="mt-3">
          <button onClick={start} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">
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
          <button onClick={stop} disabled={status === "connecting"} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            {status === "connecting" ? <Loader2 size={14} className="animate-spin" /> : <Square size={14} />} Durdur
          </button>
        </div>
      )}
    </div>
  );
}
