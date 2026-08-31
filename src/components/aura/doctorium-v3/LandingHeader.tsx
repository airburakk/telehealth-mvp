import Link from "next/link";
import { AuraMark } from "@/components/AuraLogo";
import { DoctoriumMobileMenu } from "@/components/aura/doctorium-mobile-menu";
import { LANDING_ANCHORS, LANDING_ROUTES } from "@/lib/doctorium-landing/routes";
import { MobileMenuTracked } from "./MobileMenuTracked";
import { DoctoriumWordV3 } from "./brand";

// V3 üst bar — AÇIK tema (kullanıcı 2026-08-26: hero da açık, koyu blok kalmadı → header kendi
// paletini TAŞIMAZ, kök V3_LIGHT değişkenlerini miras alır; frosted-white blur + saç çizgisi).
// Marka lockup'ı (küre + DoctoriumWord) dokunulmaz. Yapı/menü/analytics v2 ile birebir:
// masaüstü sticky 72px, mobil statik 56px (yapışkan üst bar ürün kartlarını kapatıyordu — v2
// QA kararı), "Giriş yap" mobilde hamburger'de. DoctoriumMobileMenu --dl-* okur → açıkta da doğru.
export function LandingHeader() {
  const menuItems = [
    ...LANDING_ANCHORS.map((a) => ({ href: `#${a.id}`, label: a.label })),
    { href: LANDING_ROUTES.login, label: "Giriş yap" },
  ];
  return (
    <header className="z-20 border-b border-[var(--dl-line)] bg-[color-mix(in_srgb,var(--dl-bg)_86%,transparent)] backdrop-blur-md md:sticky md:top-0">
      <a
        href="#icerik"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[#065f46] focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Ana içeriğe geç
      </a>
      {/* flex-wrap + min-h (h yerine) ŞART: nav+Giriş+CTA tek satırda viewport kırılımına
          (md/lg) bağlı, İÇERİK genişliğine değil — metin %200 büyütüldüğünde (OS/AT metin
          ölçekleme, viewport aynı kalır) satır taşıyordu. min-h normal tek-satır boyunu
          AYNEN korur (içerik sığdığında hiçbir görsel fark yok); yalnız sığmadığında 2.
          satıra döker (Impeccable audit P2, 2026-08-28). */}
      <div className="relative mx-auto flex min-h-14 w-full max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 md:min-h-[72px] md:px-5 sm:gap-x-6">
        <Link href="/doctorium" className="flex min-w-0 items-center gap-2 md:gap-2.5" aria-label="Doctorium ana sayfa">
          <AuraMark size={28} tone="emerald" className="shrink-0" />
          <DoctoriumWordV3 className="text-[18px] md:text-[22px]" />
        </Link>
        <nav aria-label="Bölümler" className="ml-auto hidden items-center gap-6 text-sm font-medium text-[var(--dl-muted)] lg:flex">
          {LANDING_ANCHORS.map((a) => (
            <a key={a.id} href={`#${a.id}`} className="transition-colors duration-200 hover:text-[var(--dl-ink)]">{a.label}</a>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0 sm:gap-2.5">
          {/* A · Yükselme dili (kullanıcı 2026-08-26) — buttonVariants ile aynı hover/active;
              header'a özgü boy/punto responsive'i korunduğu için sınıflar burada elle. */}
          <Link
            href={LANDING_ROUTES.login}
            className="hidden min-h-[44px] items-center rounded-xl border border-[var(--dl-line)] px-4 text-sm font-semibold transition-[transform,box-shadow,border-color] duration-250 ease-[cubic-bezier(.32,.72,0,1)] hover:-translate-y-0.5 hover:border-[rgba(24,24,27,.26)] hover:shadow-[0_10px_22px_-10px_rgba(24,24,27,.22)] active:translate-y-0 active:scale-[.98] active:shadow-none motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-none md:inline-flex"
          >
            Giriş yap
          </Link>
          <Link
            href={LANDING_ROUTES.signup}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#065f46] px-3 text-[13px] font-semibold text-white transition-[transform,box-shadow,background-color] duration-250 ease-[cubic-bezier(.32,.72,0,1)] hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-8px_rgba(6,95,70,.38),0_3px_8px_-3px_rgba(6,95,70,.25)] active:translate-y-0 active:scale-[.98] active:bg-[#054d39] active:shadow-[0_2px_6px_-2px_rgba(6,95,70,.3)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-none md:px-4 md:text-sm"
          >
            <span className="md:hidden">Oluştur</span>
            <span className="hidden md:inline">Doctorium&apos;unu oluştur</span>
          </Link>
          <MobileMenuTracked>
            <DoctoriumMobileMenu sections={menuItems} breakpoint="lg" />
          </MobileMenuTracked>
        </div>
      </div>
    </header>
  );
}
