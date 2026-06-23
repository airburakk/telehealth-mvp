"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

// Global alt bilgi — ana sayfada gizli (AURA landing kendi footer'ını taşır)
export function SiteFooter() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return (
    <footer className="border-t border-slate-200 bg-white print:hidden">
      <div className="mx-auto max-w-6xl px-5 py-5 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
        <span>AURA · MVP · Demo amaçlıdır</span>
        <span className="flex items-center gap-3">
          <Link href="/onam/kanit" className="hover:text-[#0E8A95] hover:underline">Onay Kanıtım</Link>
          <Link href="/erisim-kaydi" className="hover:text-[#0E8A95] hover:underline">Erişim Kaydım</Link>
        </span>
        <span>S1 Yazılım · S2 Operasyon · S3 Acenta</span>
      </div>
    </footer>
  );
}
