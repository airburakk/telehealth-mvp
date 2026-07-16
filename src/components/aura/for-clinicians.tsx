"use client";

import Link from "next/link";
import { ArrowRight, Stethoscope } from "lucide-react";
import { AuraClosing } from "./closing";
import { AuraNav } from "./nav";
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
      <AuraNav />
      <main className="pt-16">
        {/* Gündüz gövde: iddia bölümü /v2'dekiyle aynı iskeletten çizilir
            (tek kaynak) — yalnız cta.more köprüsü YOK (zaten bu sayfadayız),
            yerine iki eylem düğmesi. */}
        <div className="aura-light bg-[var(--aura-bg)]">
          <V2ClaimSection id="clinicians" copy={c} icon={Stethoscope} />

          <div className="mx-auto max-w-6xl px-5 pb-24 md:px-8 md:pb-32">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/kayit"
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[var(--aura-accent)] px-7 py-3.5 text-base font-semibold text-[var(--aura-white)] transition-transform duration-200 hover:translate-x-0.5 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aura-ink)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--aura-bg)]"
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
