import Link from "next/link";
import { AuraMark } from "@/components/AuraLogo";
import {
  DOCTORIUM_PALETTE,
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
//
// `portal` varyantı (2026-08-19, kullanıcı bildirimi "footer çok kalın"): iç portalda
// (/doktor/doctorium/*) sabit koyu palet yerine TEMA-DUYARLI krom — globals.css
// `.doctorium-footer-portal` --dl-* token'larını --c-* kromuna remap eder (gece sayfa
// zemini #0d0e10 ile footer #0d0e10 AYNI çıkıyor, footer sınırsız "koyu blok" gibi
// okunuyordu; gündüzde ise açık zeminde simsiyah bant duruyordu). py-10→py-7 inceltme +
// mb-14 mobil fixed alt çubuk payı (footer çubuğun arkasında kalmasın) yalnız portalda.
// Landing/giriş kapısı DOKUNULMADI — koyu marka footer'ı oralarda aynen yaşar.
// `theme`: ByAura wordmark PNG seçimi (açık kromda beyaz PNG görünmez) — SSR cookie'den.
export function DoctoriumFooter({ portal = false, theme = "dark" }: { portal?: boolean; theme?: "dark" | "light" }) {
  return (
    <footer
      style={portal ? undefined : DOCTORIUM_PALETTE}
      className={`border-t border-[var(--dl-line)] bg-[var(--dl-bg)] text-[var(--dl-ink)] print:hidden ${
        portal ? "doctorium-footer-portal mb-14 py-7 md:mb-0" : "py-10"
      }`}
    >
      <div className="mx-auto w-full max-w-6xl px-5">
        {/* Marka bloğu — AURA landing footer'ının alt-marka eşleniği. */}
        <div className="flex items-center gap-3">
          <AuraMark size={34} tone="emerald" />
          <DoctoriumWord className="text-[32px] leading-none" />
        </div>
        <div className={`mt-6 flex flex-col justify-between gap-4 text-xs sm:flex-row ${portal ? "text-[var(--dl-body)]" : "text-[#777c82]"}`}>
          <span>
            {/* Akan metinde marka tek düğüm (v6.140; lockup yalnız üstteki wordmark'ta). */}
            © 2026 Doctorium <ByAura light={portal && theme === "light"} />
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
