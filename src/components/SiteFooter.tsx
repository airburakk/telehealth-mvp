"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { isImmersiveCallPath } from "@/lib/immersive-routes";

// Global alt bilgi — AURA landing rotalarında gizli (sayfa kendi footer'ını taşır)
export function SiteFooter() {
  const pathname = usePathname();
  // Giriş kapıları da tam-ekran vitrin paneli (Header ile aynı liste; /e-posta formlarında krom durur).
  // Video görüşme rotaları immersive tam-ekran → footer gizlenir (Header ile simetrik).
  if (["/", "/how-it-works", "/giris", "/kurumsal-giris"].includes(pathname) || isImmersiveCallPath(pathname)) return null;
  return (
    <footer className="theme-dark border-t border-[var(--c-hairline)] bg-[var(--c-bg)] print:hidden">
      <div className="mx-auto max-w-6xl px-5 py-5 text-xs text-[var(--c-ink-3)] flex flex-wrap items-center justify-between gap-2">
        <span>AURA · MVP · Demo amaçlıdır</span>
        <span className="flex items-center gap-3">
          <Link href="/onam/kanit" className="hover:text-[var(--c-accent)] hover:underline">Onay Kanıtım</Link>
          <Link href="/erisim-kaydi" className="hover:text-[var(--c-accent)] hover:underline">Erişim Kaydım</Link>
        </span>
        <span>S1 Yazılım · S2 Operasyon · S3 Acenta</span>
      </div>
    </footer>
  );
}
