"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { hidesGlobalChrome } from "@/lib/chrome-routes";

// Global alt bilgi — AURA landing rotalarında gizli (sayfa kendi footer'ını taşır)
export function SiteFooter() {
  const pathname = usePathname();
  // Gizleme listesi lib/chrome-routes.ts'te — Header ile TEK KAYNAK (2026-08-17: kopya liste
  // sürüklenmiş, /doctorium yalnız Header'a eklendiği için landing'de iki footer üst üste gelmişti).
  if (hidesGlobalChrome(pathname)) return null;
  return (
    /* Krom katmanı (2026-08-14): Header + Doctorium bandıyla aynı --c-chrome zemini — içerik alanından ayrışır. */
    <footer className="theme-dark border-t border-[var(--c-hairline)] bg-[var(--c-chrome)] print:hidden">
      <div className="mx-auto max-w-6xl px-5 py-5 text-xs text-[var(--c-ink-3)] flex flex-wrap items-center justify-between gap-2">
        <span>AURA · MVP · Demo amaçlıdır</span>
        <span className="flex items-center gap-3">
          <Link href="/onam/kanit" className="hover:text-[var(--c-accent)] hover:underline">Onay Kanıtım</Link>
          <Link href="/erisim-kaydi" className="hover:text-[var(--c-accent)] hover:underline">Erişim Kaydım</Link>
        </span>
        {/* "S1 Yazılım · S2 Operasyon · S3 Acenta" KALDIRILDI (2026-08-01, kullanıcı kararı):
            iç şirket yapısı kodlaması son kullanıcıya bir şey anlatmıyordu. Geri EKLEME. */}
      </div>
    </footer>
  );
}
