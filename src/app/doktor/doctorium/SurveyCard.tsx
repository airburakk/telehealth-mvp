"use client";

import { useState } from "react";
import { BarChart2, Check, Loader2 } from "lucide-react";

// Doctorium akış içi anket kartı (v6.69 Faz 2) — tek soru, kapalı şıklar, yanıt sonrası TOPLU
// sonuç barları (Doximity poll deneyimi). Rejim görsel dili: COMMUNITY nötr/sky "Topluluk
// anketi" · SPONSORED amber "Sponsorlu · <sponsor>" (kampanya kartıyla aynı ayrım disiplini).
// Tekil yanıt asla gösterilmez/gönderilmez — yalnız kendi seçimin işareti + agregat dağılım.

interface Results {
  counts: number[];
  total: number;
}

interface Props {
  surveyId: string;
  kind: string; // COMMUNITY | SPONSORED
  sponsor: string | null;
  question: string;
  options: string[];
  /** Doktorun mevcut yanıtı (server'dan; null = henüz yanıtlamadı). */
  myIndex: number | null;
  /** Yanıtlamışsa server-render'da hazır sonuç; yanıtlamamışsa null (sonuç önden sızdırılmaz). */
  initialResults: Results | null;
}

export function SurveyCardView(p: Props) {
  const [picked, setPicked] = useState<number | null>(null);
  const [myIndex, setMyIndex] = useState<number | null>(p.myIndex);
  const [results, setResults] = useState<Results | null>(p.initialResults);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const sponsored = p.kind === "SPONSORED";
  const accent = sponsored ? "#f59e0b" : "#38bdf8";

  async function submit() {
    if (picked == null || saving) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/survey/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surveyId: p.surveyId, optionIndex: picked }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Gönderilemedi.");
      setMyIndex(j.myIndex);
      setResults({ counts: j.counts, total: j.total });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gönderilemedi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className={`overflow-hidden rounded-2xl border bg-[var(--c-surface)] ${sponsored ? "border-dashed border-amber-400/40" : "border-[var(--c-hairline)]"}`}>
      <div className="flex">
        <div
          aria-hidden
          className="relative hidden w-[112px] shrink-0 items-center justify-center overflow-hidden bg-[var(--c-surface-2)] sm:flex"
          style={{ borderRight: `3px solid ${accent}` }}
        >
          <span className="absolute inset-0 opacity-[0.07]" style={{ background: accent }} />
          <BarChart2 size={26} style={{ color: accent }} strokeWidth={1.8} />
        </div>
        <div className="min-w-0 flex-1 px-4 py-3.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {sponsored ? (
              <span className="aura-mono rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                Sponsorlu · {p.sponsor}
              </span>
            ) : (
              <span className="aura-mono rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
                Topluluk anketi
              </span>
            )}
            {results && (
              <span className="text-[11px] text-[var(--c-ink-3)]">{results.total} yanıt</span>
            )}
          </div>

          <p className="mt-1.5 text-sm font-semibold leading-snug text-[var(--c-ink)]">{p.question}</p>

          {myIndex == null || !results ? (
            <>
              <div className="mt-2 grid gap-1.5">
                {p.options.map((o, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-pressed={picked === i}
                    onClick={() => setPicked(i)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-left text-xs transition ${
                      picked === i
                        ? "border-emerald-400/40 bg-emerald-500/10 text-[var(--c-ink)]"
                        : "border-[var(--c-hairline)] text-[var(--c-ink-2)] hover:bg-[var(--c-surface-2)]"
                    }`}
                  >
                    <span className={`h-3 w-3 shrink-0 rounded-full border ${picked === i ? "border-emerald-300 bg-emerald-400" : "border-[var(--c-ink-3)]"}`} />
                    {o}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={submit}
                  disabled={picked == null || saving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/90 px-3.5 py-1.5 text-xs font-semibold text-[#062a20] hover:bg-emerald-400 disabled:opacity-50"
                >
                  {saving && <Loader2 size={12} className="animate-spin" />} Yanıtla
                </button>
                <span className="text-[10px] text-[var(--c-ink-3)]">Yanıtınız yalnız toplu sonuçta görünür.</span>
                {err && <span className="text-[11px] text-red-300">{err}</span>}
              </div>
            </>
          ) : (
            <div className="mt-2 grid gap-1.5">
              {p.options.map((o, i) => {
                const n = results.counts[i] ?? 0;
                const pct = results.total > 0 ? Math.round((n / results.total) * 100) : 0;
                const mine = i === myIndex;
                return (
                  <div key={i} className="relative overflow-hidden rounded-lg border border-[var(--c-hairline)] px-3 py-1.5">
                    <span
                      aria-hidden
                      className="absolute inset-y-0 left-0"
                      style={{ width: `${pct}%`, background: accent, opacity: 0.14 }}
                    />
                    <span className="relative flex items-center justify-between gap-2 text-xs">
                      <span className={`flex items-center gap-1.5 ${mine ? "font-semibold text-[var(--c-ink)]" : "text-[var(--c-ink-2)]"}`}>
                        {mine && <Check size={12} className="text-emerald-300" strokeWidth={3} />}
                        {o}
                      </span>
                      <span className="aura-mono shrink-0 text-[10px] text-[var(--c-ink-3)]">%{pct}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
