"use client";

import { AuraClosing } from "../closing";
import { AuraTrust } from "../trust";
import { AuraDoctors } from "../doctors";
import { AuraHowItWorks } from "../how";
import { V2ConnectedCare } from "./claim-section";
import { V2Doctorium } from "./doctorium-section";
import { V2EntryPaths } from "./entry-paths";
import { V2Hero } from "./hero";
import { V2Nav } from "./nav";
import { LangProvider, langDir, useLang, type Lang } from "@/lib/aura-landing/i18n";

// ANA SAYFA (taşıma 2026-07-16 — /v2 önizleme dönemi bitti, "/" bunu render eder;
// /v2 rotası kalıcı redirect). Eski landing tag'de: `landing-eski-v5.9-son`.
//
// Blueprint IA tamamlandı (Faz 1 v6.14 + Faz 2 v6.16-17): Hero → EntryPaths →
// How → ConnectedCare → Doctors → Trust → AI → Accessibility → Clinicians →
// Closing — açık/koyu almaşık ritimde (kullanıcı planı, aşağıdaki not).
//
// initialLang: locale rotaları (/tr /ar …) ana sayfayı URL dilinde SSR'lar;
// prop'suz çağrı ("/") eski davranış (EN + mount'ta air_lang) — i18n.tsx sözleşmesi.
export function V2Home({ initialLang }: { initialLang?: Lang } = {}) {
  return (
    <LangProvider initialLang={initialLang}>
      <V2Shell />
    </LangProvider>
  );
}

// dir/lang KÖKE değil bu konteynere (diğer sayfalara sızmasın) — landing ile
// aynı sözleşme. ⚠️ lang niteliği AR/FA fontunun ŞARTI ([[nextfont-fallback-unicode-trap]]).
function V2Shell() {
  const { lang } = useLang();
  return (
    <div dir={langDir(lang)} lang={lang} className="aura-page min-h-dvh">
      {/* V2Nav: tek bakım mimarisi — taşımadan beri SİTE GENELİ nav
          (how-it-works · guven-ve-gizlilik · for-clinicians da bunu kullanır). */}
      <V2Nav />
      <main>
        <V2Hero />
        <V2EntryPaths />
        {/* Sandwich gövdesi: gece bantların arasındaki gündüz şeridi (mevcut
            landing ile aynı desen; token'lar .aura-light'ta açık değerlere geçer). */}
        {/* AÇIK/KOYU RİTİM — SADELEŞME (2026-08-17, kullanıcı kararı; fikir
            kaynağı Codex aura-home taslağı + doctorium-landing mimarisi):
            ai(A) + accessibility(K) + clinicians(A) ana sayfadan ÇIKTI; yerlerine
            TEK köprü bölüm V2Doctorium (→ /doctorium) girdi. Çift-koyu açılış +
            katı almaşık korunur: hero(K) → entry(K) → how(A) → connected(K) →
            doctors(A) → trust(K) → doctorium(A) → closing(K).
            ⚠️ ai/accessibility SÖZLÜKLERİ copy.ts'te duruyor (clinicians'ı
            /for-clinicians sayfası kullanmaya devam eder; yapı-imza testi
            9 dilde aynı kaldı) — bölümler yalnız BU dizilimden düştü.
            Koyu bölümler .aura-page gece token'larını miras alır (sarmalayıcısız);
            açık bölümler tekil .aura-light sarmalanır. */}
        <div className="aura-light bg-[var(--aura-bg)]">
          <AuraHowItWorks />
        </div>
        <V2ConnectedCare />
        <div className="aura-light bg-[var(--aura-bg)]">
          <AuraDoctors />
        </div>
        <AuraTrust />
        <div className="aura-light bg-[var(--aura-bg)]">
          <V2Doctorium />
        </div>
        <AuraClosing />
      </main>
    </div>
  );
}
