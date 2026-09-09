import Link from "next/link";
import { AuraMark } from "@/components/AuraLogo";
import { DOCTORIUM_PALETTE, DoctoriumStudentLockup, DoctoriumWord } from "@/components/aura/doctorium-brand";
import { DoctoriumSocialLinks } from "@/components/aura/doctorium-social-links";
import { LEGAL_LINKS } from "@/lib/doctorium-legal";

// Doctorium alt bilgisi — Doctorium'un TÜM yüzeylerinde ortak (kullanıcı kararı 2026-08-18).
//
// Nerede: /doctorium (landing) · /doctorium/giris (kapı) · /doktor/doctorium/* (iç portalın
// sayfaları, segment layout'undan tek dokunuşla).
//
// AURA↔Doctorium ayrışması (kullanıcı kararı 2026-08-24): "by AURA" imzası, "AURA'ya git ↗"
// ve "Güven ve Gizlilik" (AURA vitrin sayfası) bağlantıları KALDIRILDI — Doctorium ayrı ürün
// olarak konumlandı, footer yalnız kendi markasını taşır. Doctorium'un kendi güven/hukuk
// sayfası ihtiyacı teknik ayrışma planında (output/doctorium-teknik-ayristirma-plani).
// Geri-birleştirme el kitabı: vault [[aura-doctorium-baglanti-sistemi]].
// `theme` prop'u da kalktı — tek işlevi ByAura wordmark renk seçimiydi.
//
// Palet kökte: landing DIŞINDA --dl-* değişkenleri tanımlı değil (landing onları kendi kök
// div'ine veriyor). Footer bu yüzden DOCTORIUM_PALETTE'i kendi köküne uygular ve zeminini
// kendisi boyar — landing içinde aynı değerlerin üzerine yazar, görsel fark oluşmaz.
//
// `portal` varyantı (2026-08-19, kullanıcı bildirimi "footer çok kalın"): iç portalda
// (/doktor/doctorium/*) sabit koyu palet yerine TEMA-DUYARLI krom — globals.css
// `.doctorium-footer-portal` --dl-* token'larını --c-* kromuna remap eder. py-10→py-7
// inceltme + mb-14 mobil fixed alt çubuk payı yalnız portalda.
//
// `student` (2026-09-09, 👤 "[ STUDENT ] lockup'ı footer'a da taşınsın"): öğrenci oturumunda marka bloğu Header'daki
// U4 lockup'ının büyük hâli — küre 44 px + paylaşılan DoctoriumStudentLockup (wordmark 26 px → STUDENT 10,4 px; istif ≈44 px,
// küreyle dengeli — Header'daki 28 ≈ 29 oranı). Yalnız portal layout'u geçer (kitle currentDoctoriumAudience'tan); kapı/landing
// footer'ları öğrenciyi bilmez → zümrüt lockup. Eski durum (v6.257'ye kadar): öğrencide de zümrüt küre + düz wordmark.
export function DoctoriumFooter({ portal = false, student = false }: { portal?: boolean; student?: boolean }) {
  return (
    <footer
      style={portal ? undefined : DOCTORIUM_PALETTE}
      className={`border-t border-[var(--dl-line)] bg-[var(--dl-bg)] text-[var(--dl-ink)] print:hidden ${
        portal ? "doctorium-footer-portal mb-14 py-7 md:mb-0" : "py-10"
      }`}
    >
      <div className="mx-auto w-full max-w-6xl px-5">
        {student ? (
          <Link href="/doctorium" title="Doctorium Student" aria-label="Doctorium Student" className="inline-flex items-center gap-3">
            <AuraMark size={44} tone="emerald" />
            <DoctoriumStudentLockup className="text-[26px]" />
          </Link>
        ) : (
          <Link href="/doctorium" aria-label="Doctorium" className="inline-flex items-center gap-3">
            <AuraMark size={34} tone="emerald" />
            <DoctoriumWord className="text-[32px] leading-none" />
          </Link>
        )}
        {/* Hukuki belgeler (v6.210, 2026-09-03) — tek kaynak lib/doctorium-legal LEGAL_LINKS; landing
            V3 footer'ı aynı satırı çizer. Portalda tema-duyarlı (--dl-body remap), kapılarda sabit koyu. */}
        <nav aria-label="Hukuki belgeler" className={`mt-6 flex flex-wrap gap-x-4 gap-y-1.5 text-xs ${portal ? "text-[var(--dl-body)]" : "text-[#9da1a6]"}`}>
          {LEGAL_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="transition-colors hover:text-[var(--dl-emerald)]">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className={`mt-4 flex flex-wrap items-center justify-between gap-x-5 gap-y-3 text-xs ${portal ? "text-[var(--dl-body)]" : "text-[#777c82]"}`}>
          <span>© 2026 Doctorium</span>
          <DoctoriumSocialLinks className={portal ? "text-[var(--dl-body)]" : "text-[#9da1a6]"} audienceAware={portal} />
        </div>
      </div>
    </footer>
  );
}
