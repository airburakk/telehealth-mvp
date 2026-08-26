import Link from "next/link";
import { AuraMark } from "@/components/AuraLogo";
import { DoctoriumWordV3 } from "./brand";
import { V3_LIGHT } from "./palette";

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
        <div className="mt-6 text-xs text-[var(--dl-muted)]">
          <span>© 2026 Doctorium</span>
        </div>
      </div>
    </footer>
  );
}
