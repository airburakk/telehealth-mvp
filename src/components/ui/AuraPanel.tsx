import type { ReactNode } from "react";

// Aura UI kiti — içerik paneli: hairline + panel zemini + (ops.) display başlık ve mono meta.
// DashboardPanel'in kit karşılığı; klinik veri içinde animasyon/ışıma YOK (DESIGN.md).
// `level`: başlık hiyerarşisi sayfaya göre (varsayılan h2).
export function AuraPanel({
  title,
  meta,
  action,
  level = "h2",
  children,
  className = "",
}: {
  title?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  level?: "h2" | "h3";
  children: ReactNode;
  className?: string;
}) {
  const H = level;
  const hasHeader = title || meta || action;
  return (
    <section className={`rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-6 sm:p-7 ${className}`}>
      {hasHeader && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-[var(--c-hairline)] pb-4">
          {title && (
            <H className="aura-display text-xl font-medium tracking-tight text-[var(--c-ink)]">{title}</H>
          )}
          {meta && <div className="aura-mono text-xs text-[var(--c-ink-3)]">{meta}</div>}
          {action && <div className="ms-auto shrink-0">{action}</div>}
        </div>
      )}
      <div className={hasHeader ? "mt-5" : ""}>{children}</div>
    </section>
  );
}
