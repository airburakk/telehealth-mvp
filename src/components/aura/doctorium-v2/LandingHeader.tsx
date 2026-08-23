import Link from "next/link";
import { AuraMark } from "@/components/AuraLogo";
import { DoctoriumWord } from "@/components/aura/doctorium-brand";
import { DoctoriumMobileMenu } from "@/components/aura/doctorium-mobile-menu";
import { LANDING_ANCHORS, LANDING_ROUTES } from "@/lib/doctorium-landing/routes";
import { MobileMenuTracked } from "./MobileMenuTracked";

// V2 üst bar. Masaüstü/tablet (md+): sticky, 72px, nav çapaları (lg+) + Giriş yap + CTA — v1
// sözleşmesi aynen. MOBİL (<768px, pre-freeze patch 2026-08-23 — kullanıcı QA kararı):
//   · `Doctorium | Oluştur | ☰` — "Giriş yap" hamburger menüsüne taşındı (dört öğe 360px'te yarışıyordu).
//   · Header STATİK (sticky değil) ve 56px: yapışkan üst bar kaydırırken ürün kartlarının üstüne
//     biniyordu ("hiçbir içeriği kapatmamalı" → mobilde en kesin çözüm yapışmamak; dönüşüm zaten
//     alttaki MobileStickyCta'da, gezinme hamburger'de). Anchor offset'i bölümlerde `scroll-mt`
//     (masaüstü header 72px + güvenli pay).
// Skip link: ilk odaklanabilir öğe (WCAG bypass blocks).
export function LandingHeader() {
  const menuItems = [
    ...LANDING_ANCHORS.map((a) => ({ href: `#${a.id}`, label: a.label })),
    { href: LANDING_ROUTES.login, label: "Giriş yap" },
  ];
  return (
    <header className="z-20 border-b border-[var(--dl-line)] bg-[color-mix(in_srgb,var(--dl-bg)_86%,transparent)] backdrop-blur-md md:sticky md:top-0">
      <a
        href="#icerik"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[#34d399] focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-[#04342c]"
      >
        Ana içeriğe geç
      </a>
      <div className="relative mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 md:h-[72px] md:px-5 sm:gap-6">
        <Link href="/doctorium" className="flex min-w-0 items-center gap-2 md:gap-2.5" aria-label="Doctorium ana sayfa">
          {/* Tek küre (28px): hidden/md:block çifti AuraMark'ın kendi display kuralına yenilip
              İKİ küre çizdi (ölçüldü 2026-08-23) — boyut farkı için iki örnek KULLANMA. */}
          <AuraMark size={28} tone="emerald" className="shrink-0" />
          <DoctoriumWord className="text-[18px] md:text-[22px]" />
        </Link>
        {/* "by AURA" imzası 2026-08-24 ayrışmasında kalktı — Doctorium bağımsız marka. */}
        <nav aria-label="Bölümler" className="ml-auto hidden items-center gap-6 text-sm text-[#c7c9cc] lg:flex">
          {LANDING_ANCHORS.map((a) => (
            <a key={a.id} href={`#${a.id}`} className="transition-colors hover:text-[var(--dl-ink)]">{a.label}</a>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0 sm:gap-2.5">
          {/* Giriş yap: yalnız md+ (mobilde hamburger menüsünde) */}
          <Link
            href={LANDING_ROUTES.login}
            className="hidden min-h-[44px] items-center rounded-xl border border-[var(--dl-line)] px-4 text-sm font-semibold transition-colors hover:border-[var(--dl-emerald)]/55 md:inline-flex"
          >
            Giriş yap
          </Link>
          <Link
            href={LANDING_ROUTES.signup}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-[#065f46] px-3 text-[13px] font-semibold text-white transition-colors hover:bg-[#064e3b] md:min-h-[44px] md:px-4 md:text-sm"
          >
            <span className="md:hidden">Oluştur</span>
            <span className="hidden md:inline">Doctorium&apos;unu oluştur</span>
          </Link>
          {/* Hamburger: lg altında (tablet dahil — 768-1023'te nav çapaları yok, menü tek gezinme). */}
          <MobileMenuTracked>
            <DoctoriumMobileMenu sections={menuItems} breakpoint="lg" />
          </MobileMenuTracked>
        </div>
      </div>
    </header>
  );
}
