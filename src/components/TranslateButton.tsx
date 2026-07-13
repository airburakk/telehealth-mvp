"use client";

import { useState } from "react";
import { Languages, Loader2 } from "lucide-react";

const LANGS = ["Türkçe", "Rusça", "Arapça", "Azerice", "İngilizce"];

// Yeniden kullanılabilir medikal çeviri butonu (dil seçici + sonuç).
export function TranslateButton({ text, defaultTarget = "Türkçe", compact }: { text: string; defaultTarget?: string; compact?: boolean }) {
  const [target, setTarget] = useState(defaultTarget);
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function go() {
    setBusy(true);
    setErr("");
    setOut("");
    try {
      const r = await fetch("/api/ai/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, target }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Çeviri başarısız.");
      setOut(d.translated);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Hata.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={compact ? "" : "mt-1.5"}>
      <div className="flex items-center gap-1.5">
        <select value={target} onChange={(e) => setTarget(e.target.value)} className="rounded border border-[var(--c-hairline)] bg-[var(--c-panel)] px-1.5 py-1 text-[11px] text-[var(--c-ink-2)] outline-none">
          {LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <button onClick={go} disabled={busy || !text} className="inline-flex items-center gap-1 rounded border border-[var(--c-hairline)] bg-[var(--c-panel)] px-2 py-1 text-[11px] font-medium text-[var(--c-ink-2)] hover:bg-[var(--c-surface)] disabled:opacity-50">
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Languages size={12} />} {target} çevir
        </button>
      </div>
      {err && <div className="mt-1 text-[11px] text-red-300">{err}</div>}
      {out && (
        <div className="mt-1.5 rounded-lg bg-[var(--c-accent)]/10 p-2 ring-1 ring-[var(--c-accent)]/20">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--c-accent)]">{target} çeviri</div>
          <p className="mt-0.5 whitespace-pre-line text-sm text-[var(--c-ink)]">{out}</p>
        </div>
      )}
    </div>
  );
}
