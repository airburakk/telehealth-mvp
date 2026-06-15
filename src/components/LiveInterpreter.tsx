"use client";

// AI Canlı Tercüman (Gemini Live) — İSKELET.
// Bu aşamada: özellik durumu (anahtar var mı?) + bağlantı testi.
// SONRAKİ aşama (kullanıcı onayında): mic→Gemini(gemini-3.5-live-translate-preview)→hoparlör
// gerçek ses akışı + altyazı buraya eklenecek. Ephemeral token: /api/realtime/token.
import { useEffect, useState } from "react";
import { Languages, Loader2, Check, KeyRound } from "lucide-react";

type Status = "checking" | "disabled" | "ready" | "connecting" | "error";

export function LiveInterpreter({ patientLang }: { patientLang: string }) {
  const [status, setStatus] = useState<Status>("checking");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/realtime/token");
        if (!r.ok) { setStatus("disabled"); return; }
        const d = await r.json();
        setStatus(d.enabled ? "ready" : "disabled");
      } catch { setStatus("disabled"); }
    })();
  }, []);

  // İskelet: token'ı mint et + doğrula (ses akışı henüz yok)
  async function testConnection() {
    setStatus("connecting"); setMsg("");
    try {
      const r = await fetch("/api/realtime/token", { method: "POST" });
      const d = await r.json();
      if (!r.ok || !d.token) throw new Error(d.error || "Token alınamadı.");
      setStatus("ready");
      setMsg("Token alındı ✓ — ses akışı bir sonraki adımda eklenecek.");
    } catch (e) {
      setStatus("error");
      setMsg(e instanceof Error ? e.message : "Hata.");
    }
  }

  return (
    <div className="rounded-2xl border border-teal-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-teal-700">
          <Languages size={15} /> AI Canlı Tercüman
          <span className="rounded-full bg-teal-600 px-1.5 py-0.5 text-[9px] tracking-normal text-white">Gemini · önizleme</span>
        </div>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-slate-500">
        Hasta <strong className="text-slate-700">{patientLang}</strong> konuşur, doktor Türkçe sesli + altyazı duyar
        (ve tersi). Gerçek zamanlı ses→ses çeviri — <em>ses akışı sonraki adımda</em>.
      </p>

      {status === "checking" && (
        <div className="mt-3 inline-flex items-center gap-2 text-xs text-slate-400">
          <Loader2 size={13} className="animate-spin" /> durum kontrol ediliyor…
        </div>
      )}

      {status === "disabled" && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-[11px] leading-relaxed text-amber-700 ring-1 ring-amber-100">
          <KeyRound size={13} className="mt-0.5 shrink-0" />
          <span>Devre dışı — Vercel'e <code className="rounded bg-amber-100 px-1">GEMINI_API_KEY</code> eklenince aktifleşir.</span>
        </div>
      )}

      {(status === "ready" || status === "connecting" || status === "error") && (
        <div className="mt-3">
          <button
            onClick={testConnection}
            disabled={status === "connecting"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-teal-300 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-100 disabled:opacity-50"
          >
            {status === "connecting" ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Bağlantıyı test et
          </button>
          {msg && <p className={`mt-1.5 text-[11px] ${status === "error" ? "text-red-600" : "text-emerald-600"}`}>{msg}</p>}
        </div>
      )}
    </div>
  );
}
