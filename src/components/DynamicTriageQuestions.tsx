"use client";

import { questionsForBranch, type TQuestion } from "@/lib/triage-questions";

const EXCLUSIVE = /^(yok|hiçbiri)/i; // "Yok" / "Hiçbiri" seçilince diğerlerini temizle

// Branşa özel dinamik triyaj soruları — yanıtları soru etiketiyle (label) Record<string,string> olarak toplar.
// t: arayüz çeviri fonksiyonu (yalnız GÖRÜNTÜ; yanıtlar TR kanonik saklanır → doktor/AI etkilenmez).
export function DynamicTriageQuestions({
  branchKey, value, onChange, t = (s) => s,
}: {
  branchKey: string;
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  t?: (s: string) => string;
}) {
  const { intro, questions } = questionsForBranch(branchKey);

  function set(label: string, v: string) {
    const next = { ...value };
    if (v === "") delete next[label];
    else next[label] = v;
    onChange(next);
  }

  function toggleMulti(q: TQuestion, opt: string) {
    const cur = value[q.label] ? value[q.label].split(",").map((s) => s.trim()).filter(Boolean) : [];
    let next: string[];
    if (cur.includes(opt)) next = cur.filter((o) => o !== opt);
    else if (EXCLUSIVE.test(opt)) next = [opt];
    else next = [...cur.filter((o) => !EXCLUSIVE.test(o)), opt];
    set(q.label, next.join(", "));
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-[var(--c-ink-2)]">{t(intro)}</p>

      {questions.map((q) => {
        const val = value[q.label] ?? "";
        const multiSel = q.type === "multi" ? val.split(",").map((s) => s.trim()).filter(Boolean) : [];
        return (
          <div key={q.id}>
            <div className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-[var(--c-ink)]">
              {t(q.label)}
              {q.recommended && <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--c-accent)]">{t("önerilen")}</span>}
            </div>
            {q.help && <p className="-mt-1 mb-1.5 text-xs text-[var(--c-ink-3)]">{t(q.help)}</p>}

            {/* text */}
            {q.type === "text" && (
              <input value={val} onChange={(e) => set(q.label, e.target.value)} placeholder={q.placeholder ? t(q.placeholder) : undefined}
                className="w-full rounded-lg border border-[var(--c-hairline)] px-3 py-2 text-sm outline-none focus:border-[var(--c-accent)]" />
            )}

            {/* number */}
            {q.type === "number" && (
              <div className="flex items-center gap-2">
                <input type="number" inputMode="numeric" value={val} onChange={(e) => set(q.label, e.target.value)} placeholder={q.placeholder ? t(q.placeholder) : undefined}
                  className="w-32 rounded-lg border border-[var(--c-hairline)] px-3 py-2 text-sm outline-none focus:border-[var(--c-accent)]" />
                {q.unit && <span className="text-sm text-[var(--c-ink-3)]">{t(q.unit)}</span>}
              </div>
            )}

            {/* select (tekli chip) — görüntü çevrilir, değer TR kanonik saklanır */}
            {q.type === "select" && (
              <div className="flex flex-wrap gap-1.5">
                {q.options?.map((o) => (
                  <Chip key={o} active={val === o} onClick={() => set(q.label, val === o ? "" : o)}>{t(o)}</Chip>
                ))}
              </div>
            )}

            {/* multi (çoklu chip) */}
            {q.type === "multi" && (
              <div className="flex flex-wrap gap-1.5">
                {q.options?.map((o) => (
                  <Chip key={o} active={multiSel.includes(o)} onClick={() => toggleMulti(q, o)}>{t(o)}</Chip>
                ))}
              </div>
            )}

            {/* bool (Evet/Hayır) */}
            {q.type === "bool" && (
              <div className="flex gap-1.5">
                {["Evet", "Hayır"].map((o) => (
                  <Chip key={o} active={val === o} onClick={() => set(q.label, val === o ? "" : o)}>{t(o)}</Chip>
                ))}
              </div>
            )}

            {/* scale 0-10 */}
            {q.type === "scale" && (
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: 11 }, (_, i) => String(i)).map((n) => (
                  <button key={n} type="button" onClick={() => set(q.label, val === n ? "" : n)}
                    className={`h-8 w-8 rounded-md text-sm font-medium transition ${val === n ? "bg-[var(--c-accent)] text-[var(--c-bg)]" : "bg-[var(--c-ink)]/10 text-[var(--c-ink-2)] hover:bg-[var(--c-ink)]/15"}`}>
                    {n}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm transition ${active ? "border-[var(--c-accent)] bg-[var(--c-accent)] text-[var(--c-bg)]" : "border-[var(--c-hairline)] bg-[var(--c-panel)] text-[var(--c-ink-2)] hover:border-[var(--c-accent)]/40 hover:bg-[var(--c-surface)]"}`}>
      {children}
    </button>
  );
}
