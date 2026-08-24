"use client";

import Link from "next/link";
import { useLang } from "@/lib/aura-landing/i18n";
import { AuraFooter } from "@/components/aura/aura-footer";

// Kapanis v2: gece paneli (22px radius — Sign Up panel dili) icinde kisa
// baslik + CTA. Kapanis CTA giysisi: genis panel-bant butonu; hover'da tum
// bant hafif yana kayar ve turkuaz kenar cizgisi dolar. Altinda koyu footer.
//
// AuraFooter aura-footer.tsx'e taşındı (2026-08-18): aynı footer artık giriş yapılmış
// uygulama sayfalarında da (SiteFooter üzerinden) çiziliyor. AuraClosing = CTA + footer;
// uygulama tarafı CTA'sız varyantı alır.
export function AuraClosing() {
  const { t } = useLang();

  return (
    <>
      <section className="mx-auto max-w-6xl px-5 pb-24 md:px-8">
        <div className="relative overflow-hidden rounded-[22px] border border-[var(--aura-hairline)] bg-[var(--aura-panel)] px-6 py-20 text-center md:py-24">
          <h2 className="aura-display text-4xl font-bold leading-none tracking-tighter text-[var(--aura-ink)] md:text-6xl">
            {t.closing.headline}
          </h2>
          <div className="mt-10 flex justify-center">
            <Link
              href="/giris"
              className="group relative inline-flex items-center gap-3 overflow-hidden rounded-full border border-[var(--aura-accent)]/60 px-8 py-4 text-base font-semibold text-[var(--aura-ink)] transition-transform duration-200 hover:translate-x-1 active:scale-[0.98]"
            >
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 w-1 bg-[var(--aura-accent)] transition-all duration-300 group-hover:w-full group-hover:opacity-15"
              />
              <span className="relative">{t.closing.cta}</span>
              <svg
                aria-hidden
                viewBox="0 0 16 16"
                className="relative h-4 w-4 text-[var(--aura-accent)] transition-transform duration-300 group-hover:translate-x-1.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M2 8h10M8 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      <AuraFooter />
    </>
  );
}
