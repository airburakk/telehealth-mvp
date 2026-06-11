"use client";

import { usePathname } from "next/navigation";

// Global alt bilgi — ana sayfada gizli (PortaMed landing kendi footer'ını taşır)
export function SiteFooter() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-5 py-5 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
        <span>portamed · MVP · Demo amaçlıdır</span>
        <span>S1 Yazılım · S2 Operasyon · S3 Acenta</span>
      </div>
    </footer>
  );
}
