import Link from "next/link";
import { AuraMark, DoctoriumBraille } from "@/components/AuraLogo";
import {
  DOCTORIUM_PALETTE,
  DoctoriumInline,
  DoctoriumWord,
  ByAura,
} from "@/components/aura/doctorium-brand";

// Doctorium alt bilgisi — Doctorium'un TÜM yüzeylerinde ortak (kullanıcı kararı 2026-08-18).
//
// Nerede: /doctorium (landing) · /doctorium/giris (kapı — daha önce hiç footer'ı yoktu) ·
// /doktor/doctorium/* (iç portalın 7 sayfası, segment layout'undan tek dokunuşla).
// Doktor Doctorium içindeyken her sayfada aynı imzayı görür; AURA sayfaları kendi
// footer'ında kalır (marka ayrımı — modül değil alt-marka konumlanması).
//
// Palet kökte: landing DIŞINDA --dl-* değişkenleri tanımlı değil (landing onları kendi kök
// div'ine veriyor). Footer bu yüzden DOCTORIUM_PALETTE'i kendi köküne uygular ve zeminini
// kendisi boyar — landing içinde aynı değerlerin üzerine yazar, görsel fark oluşmaz.
//
// İçerik kapsamı (kullanıcı kararı 2026-08-18): landing'deki hâli — Güven ve Gizlilik +
// AURA'ya git. ⚠️ "Onay Kanıtım"/"Erişim Kaydım" BİLİNÇLİ olarak yok; o iki bağlantı AURA
// tarafındaki SiteFooter'da yaşamayı sürdürür (doktor /doktor'a çıktığında görür).
export function DoctoriumFooter() {
  return (
    <footer
      style={DOCTORIUM_PALETTE}
      className="border-t border-[var(--dl-line)] bg-[var(--dl-bg)] py-10 text-[var(--dl-ink)] print:hidden"
    >
      <div className="mx-auto w-full max-w-6xl px-5">
        {/* Marka bloğu — AURA landing footer'ının alt-marka eşleniği (kullanıcı kararı
            2026-08-16): Braille "Doctorium" lockup'ının TAM ALTINDA ortalı. Lockup
            32px (≈154px) → Braille (146px) yazıdan taşmaz; üst bar bu yüzden
            braille'siz kalır (22px lockup 106px < 146px — AURA "nav'a konmaz" kuralı). */}
        <div className="flex items-center gap-3">
          <AuraMark size={34} tone="emerald" />
          <span className="inline-flex flex-col items-center">
            <DoctoriumWord className="text-[32px] leading-none" />
            <DoctoriumBraille height={12} className="mt-2 text-[var(--dl-muted)]" />
          </span>
        </div>
        <div className="mt-6 flex flex-col justify-between gap-4 text-xs text-[#777c82] sm:flex-row">
          <span>
            © 2026 <DoctoriumInline /> <ByAura />
          </span>
          <div className="flex flex-wrap gap-6">
            <Link href="/guven-ve-gizlilik" className="transition-colors hover:text-[var(--dl-ink)]">
              Güven ve Gizlilik
            </Link>
            <Link href="/" className="transition-colors hover:text-[var(--dl-ink)]">
              AURA&apos;ya git ↗
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
