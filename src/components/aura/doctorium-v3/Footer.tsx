import Link from "next/link";
import { AuraMark } from "@/components/AuraLogo";
import { DoctoriumWordV3 } from "./brand";
import { V3_LIGHT } from "./palette";
import { LEGAL_LINKS } from "@/lib/doctorium-legal";
import { DoctoriumSocialLinks } from "@/components/aura/doctorium-social-links";

// V3 landing footer'ı — AÇIK zeminde aynı marka lockup'ı (kullanıcı: zebra tamamen kalksın →
// sayfa dibi de açık; tek koyu blok hero). İçerik ortak DoctoriumFooter ile birebir (lockup +
// telif) ama paylaşılan bileşene light-prop EKLEMEDİK: o bileşen portal + giriş kapılarında da
// yaşıyor, oralar bu turun kapsamı dışında — v3 kesinleşince ortak bileşenle birleştirilir.
export function LandingFooterV3() {
  return (
    <footer style={V3_LIGHT} className="border-t border-[var(--dl-line)] bg-[var(--dl-bg)] text-[var(--dl-ink)] print:hidden">
      <div className="mx-auto w-full max-w-6xl px-5 py-10">
        <Link href="/doctorium" className="inline-flex items-center gap-3">
          <AuraMark size={34} tone="emerald" />
          <DoctoriumWordV3 className="text-[32px] leading-none" />
        </Link>
        {/* Hukuki belgeler (v6.210, 2026-09-03) — tek kaynak lib/doctorium-legal LEGAL_LINKS (ortak
            DoctoriumFooter ile aynı satır; 2026-08-24'te kalkan AURA "Güven ve Gizlilik" bağlantısının
            Doctorium'a özgü karşılığı). */}
        <nav aria-label="Hukuki belgeler" className="mt-6 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[var(--dl-muted)]">
          {LEGAL_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="transition-colors hover:text-[var(--dl-emerald)]">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-5 gap-y-3 text-xs text-[var(--dl-muted)]">
          <span>© 2026 Doctorium</span>
          <DoctoriumSocialLinks className="text-[var(--dl-muted)]" />
        </div>
      </div>
    </footer>
  );
}
