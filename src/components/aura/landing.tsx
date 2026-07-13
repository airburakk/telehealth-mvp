"use client";

import { AuraChapters } from "./chapters";
import { AuraClosing } from "./closing";
import { AuraDoctors } from "./doctors";
import { AuraHero } from "./hero";
import { SmoothScroll } from "./motion";
import { AuraNav } from "./nav";
import { AuraTrust } from "./trust";
import { ClientOnly } from "./client-only";
import { LangProvider, langDir, useLang } from "@/lib/aura-landing/i18n";

// AURA sinematik landing (vitrinden taşındı, 2026-07-12): hero (video +
// kinetik tipografi) → 4 sahnelik 3D roll chapter destesi → doktorlar →
// güven → kapanış. Tüm bölümler SSR'da tam render edilir; hareket katmanı
// (gsap/lenis) mount sonrası. Global Header/SiteFooter "/"de gizlidir —
// sayfa kendi nav/footer'ını taşır (PortamedLanding dönemiyle aynı sözleşme).
export function AuraLanding() {
  return (
    <LangProvider>
      <LandingShell />
    </LangProvider>
  );
}

// dir/lang KÖKE değil bu konteynere uygulanır (diğer sayfalara sızmasın);
// nav fixed olsa da konteynerin çocuğu olduğundan RTL aynalaması kapsanır.
function LandingShell() {
  const { lang } = useLang();
  return (
    <div dir={langDir(lang)} lang={lang} className="aura-page min-h-dvh">
      <ClientOnly>
        <SmoothScroll />
      </ClientOnly>
      <AuraNav />
      <main>
        <AuraHero />
        <AuraChapters />
        {/* Sandwich gövdesi: gece bantların arasındaki gündüz şeridi. Wrapper
            aura-light → içteki aura-* açık değerlere geçer; bg beyaz. */}
        <div className="aura-light bg-[var(--aura-bg)]">
          <AuraDoctors />
          <AuraTrust />
        </div>
        <AuraClosing />
      </main>
    </div>
  );
}
