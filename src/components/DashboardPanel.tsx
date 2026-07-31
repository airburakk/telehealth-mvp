import type { ReactNode } from "react";

// M5 — Doktor Ana Sayfası pencere kabuğu (tutarlı başlık + ikon + opsiyonel rozet/aksiyon + içerik).
export function DashboardPanel({
  icon,
  title,
  subtitle,
  badge,
  action,
  children,
  accent = "var(--c-accent)",
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  accent?: string;
}) {
  return (
    <section className="rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Yumuşak zemin + accent renkli ikon (2026-07-31): düz dolgu gece açık kulvar tonlarında
              ink ile düşük kontrast veriyordu; %14 zemin iki temada da güvenli (DutyConsole deseni). */}
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl"
            style={{ background: `color-mix(in srgb, ${accent} 14%, transparent)`, color: accent }}
          >
            {icon}
          </span>
          <div>
            {/* Aura kiti (Doz 1): pencere başlığı display — landing tipografi hiyerarşisi */}
            <h2 className="aura-display text-[17px] font-medium leading-tight tracking-tight text-[var(--c-ink)]">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-[var(--c-ink-2)]">{subtitle}</p>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {badge}
          {action}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
