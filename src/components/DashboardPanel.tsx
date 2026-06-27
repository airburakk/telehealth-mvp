import type { ReactNode } from "react";

// M5 — Doktor Ana Sayfası pencere kabuğu (tutarlı başlık + ikon + opsiyonel rozet/aksiyon + içerik).
export function DashboardPanel({
  icon,
  title,
  subtitle,
  badge,
  action,
  children,
  accent = "#14C3D0",
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
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-[#101010]" style={{ background: accent }}>
            {icon}
          </span>
          <div>
            <h2 className="text-sm font-semibold text-[#101010]">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
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
