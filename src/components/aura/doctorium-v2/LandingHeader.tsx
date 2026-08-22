import Link from "next/link";
import { AuraMark } from "@/components/AuraLogo";
import { DoctoriumOnEmerald, DoctoriumWord, ByAura } from "@/components/aura/doctorium-brand";
import { DoctoriumMobileMenu } from "@/components/aura/doctorium-mobile-menu";
import { LANDING_ANCHORS, LANDING_ROUTES } from "@/lib/doctorium-landing/routes";
import { MobileMenuTracked } from "./MobileMenuTracked";

// V2 üst bar — v1 barının sözleşmesi (sticky, blur, 72px, 44px dokunma hedefleri; mobilde Giriş +
// kısaltılmış CTA + hamburger) korunur; nav çapaları yeni hikâyenin indeksi (routes.ts LANDING_ANCHORS).
// Skip link: ilk odaklanabilir öğe (WCAG bypass blocks).
export function LandingHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--dl-line)] bg-[color-mix(in_srgb,var(--dl-bg)_86%,transparent)] backdrop-blur-md">
      <a
        href="#icerik"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[#34d399] focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-[#04342c]"
      >
        Ana içeriğe geç
      </a>
      <div className="relative mx-auto flex h-[72px] w-full max-w-6xl items-center gap-3 px-5 sm:gap-6">
        <Link href="/doctorium" className="flex min-w-0 items-center gap-2.5" aria-label="Doctorium ana sayfa">
          <AuraMark size={30} tone="emerald" className="shrink-0" />
          <DoctoriumWord className="text-[19px] sm:text-[22px]" />
        </Link>
        <span className="aura-mono mt-1 hidden text-[10px] sm:inline"><ByAura /></span>
        <nav aria-label="Bölümler" className="ml-auto hidden items-center gap-6 text-sm text-[#c7c9cc] lg:flex">
          {LANDING_ANCHORS.map((a) => (
            <a key={a.id} href={`#${a.id}`} className="transition-colors hover:text-[var(--dl-ink)]">{a.label}</a>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0 sm:gap-2.5">
          <Link
            href={LANDING_ROUTES.login}
            className="inline-flex min-h-[44px] items-center rounded-xl border border-[var(--dl-line)] px-3 text-[13px] font-semibold transition-colors hover:border-[var(--dl-emerald)]/55 sm:px-4 sm:text-sm"
          >
            Giriş yap
          </Link>
          <Link
            href={LANDING_ROUTES.signup}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#065f46] px-3 text-[13px] font-semibold text-white transition-colors hover:bg-[#064e3b] sm:px-4 sm:text-sm"
          >
            <span className="sm:hidden">Oluştur</span>
            <span className="hidden sm:inline"><DoctoriumOnEmerald />&apos;unu oluştur</span>
          </Link>
          <MobileMenuTracked>
            <DoctoriumMobileMenu sections={LANDING_ANCHORS.map((a) => ({ href: `#${a.id}`, label: a.label }))} />
          </MobileMenuTracked>
        </div>
      </div>
    </header>
  );
}
