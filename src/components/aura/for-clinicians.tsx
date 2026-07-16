"use client";

import Link from "next/link";
import { ArrowRight, Stethoscope } from "lucide-react";
import { AuraClosing } from "./closing";
import { V2Nav } from "./v2/nav";
import { V2ClaimSection } from "./v2/claim-section";
import { LangProvider, langDir, useLang } from "@/lib/aura-landing/i18n";

// /for-clinicians (v6.17, Faz 2 kalanı) — doktor-yüzü vitrin sayfası.
// Sözlük /v2'deki kompakt bölümle ORTAK (copy.ts v2.clinicians — kanıt haritası
// orada): sayfa aynı dört maddeyi + "neyi iddia etmiyoruz" kutusunu gösterir,
// üstüne iki eylem koyar: doktor başvurusu (/kayit) + personel girişi
// (/kurumsal-giris). how-it-works sayfa sözleşmesiyle aynı: kök AuraNav +
// AuraClosing; global Header/SiteFooter bu rotada gizli (Header.tsx listesi).
// dir/lang KÖKE değil konteynere ([[nextfont-fallback-unicode-trap]] — lang ŞART).
export function ForClinicians() {
  return (
    <LangProvider>
      <Shell />
    </LangProvider>
  );
}

function Shell() {
  const { lang, t } = useLang();
  const c = t.v2.clinicians;

  return (
    <div dir={langDir(lang)} lang={lang} className="aura-page min-h-dvh">
      {/* V2Nav (taşıma 2026-07-16): kök AuraNav'ın /#ch-* çapaları yeni ana
          sayfada karşılıksız — site geneli nav artık tek bakım mimarisi. */}
      <V2Nav />
      <main className="pt-16">
        {/* Gündüz gövde: iddia bölümü /v2'dekiyle aynı iskeletten çizilir
            (tek kaynak) — yalnız cta.more köprüsü YOK (zaten bu sayfadayız),
            yerine iki eylem düğmesi. */}
        <div className="aura-light bg-[var(--aura-bg)]">
          {/* headingLevel=h1: bu sayfada iskelet başlığı SAYFA başlığıdır (Ray D a11y). */}
          <V2ClaimSection id="clinicians" copy={c} icon={Stethoscope} headingLevel="h1" />

          <div className="mx-auto max-w-6xl px-5 pb-24 md:px-8 md:pb-32">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {/* Ray D (axe, ölçüldü): gündüz --aura-accent (#17919e) üstü beyaz 3.76:1 = AA altı →
                  zemin accent-stronger (#0d6470, beyazla 6.83:1). Token zaten gündüz-kontrast için var. */}
              <Link
                href="/kayit"
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[var(--aura-accent-stronger)] px-7 py-3.5 text-base font-semibold text-[var(--aura-white)] transition-transform duration-200 hover:translate-x-0.5 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aura-ink)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--aura-bg)]"
              >
                {c.cta.signup}
                <ArrowRight aria-hidden size={16} className="rtl:rotate-180" />
              </Link>
              <Link
                href="/kurumsal-giris"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-[var(--aura-hairline)] px-7 py-3.5 text-base font-semibold text-[var(--aura-ink)] transition-colors hover:border-[var(--aura-accent)]/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aura-accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--aura-bg)]"
              >
                {c.cta.login}
              </Link>
            </div>
          </div>
        </div>
      </main>
      <AuraClosing />
    </div>
  );
}
