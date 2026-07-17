import type { ReactNode } from "react";

// Aura UI kiti — sayfa başlığı: mono üst-etiket + Space Grotesk display başlık + açıklama.
// Landing'in tipografi hiyerarşisinin iç-yüzey karşılığı (Doz 1 — ışıma yok).
// `level`: sayfada başka h1 varsa "h2" verilir (tek-h1 disiplini bozulmasın).
export function PageHeader({
  eyebrow,
  title,
  sub,
  actions,
  level = "h1",
  className = "",
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  level?: "h1" | "h2";
  className?: string;
}) {
  const H = level;
  return (
    <header className={`border-b border-[var(--c-hairline)] pb-6 ${className}`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <div className="aura-mono text-[11px] uppercase tracking-[0.25em] text-[var(--c-accent)]">{eyebrow}</div>
          )}
          <H className="aura-display mt-2 text-3xl font-medium tracking-tight text-[var(--c-ink)] sm:text-4xl">
            {title}
          </H>
          {sub && <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-[var(--c-ink-2)]">{sub}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
