"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

// Global alt bilgi — AURA landing rotalarında gizli (sayfa kendi footer'ını taşır)
export function SiteFooter() {
  const pathname = usePathname();
  if (pathname === "/" || pathname === "/how-it-works") return null;
  return (
    <footer className="border-t border-white/10 bg-[#0D0E10] print:hidden">
      <div className="mx-auto max-w-6xl px-5 py-5 text-xs text-white/45 flex flex-wrap items-center justify-between gap-2">
        <span>AURA · MVP · Demo amaçlıdır</span>
        <span className="flex items-center gap-3">
          <Link href="/onam/kanit" className="hover:text-[#28C8D8] hover:underline">Onay Kanıtım</Link>
          <Link href="/erisim-kaydi" className="hover:text-[#28C8D8] hover:underline">Erişim Kaydım</Link>
        </span>
        <span>S1 Yazılım · S2 Operasyon · S3 Acenta</span>
      </div>
    </footer>
  );
}
