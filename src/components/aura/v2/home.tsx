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
        {/* AÇIK/KOYU RİTİM — KATI ALMAŞIK (2026-08-18, kullanıcı kararı).
            Önceki dizilim: hero(K) → entry(K) → how(A) → connected(K) → doctors(A)
            → trust(K) → doctorium(A) → closing(K) — ÇİFT-KOYU AÇILIŞ (2026-08-17) +
            almaşık. Kullanıcı "Nasıl Çalışır" ile "Bugün neye ihtiyacınız varsa"
            bölümlerini TAKAS etti ve entry'yi siyah sabitleyip "sonra beyaz, sonra
            siyah" dedi → araya beyaz how girince çift-koyu açılış kendiliğinden
            kalktı ve 4-8 arası TÜM renkler ters döndü.
            Güncel: hero(K) → how(A) → entry(K) → connected(A) → doctors(K) →
            trust(A) → doctorium(K) → closing(K).
            ⚠️ Son iki bölüm bilerek arka arkaya KOYU (kullanıcı kararı 2026-08-18):
            closing footer'ı İÇERİR; onu beyaza almak /how-it-works ·
            /guven-ve-gizlilik · /for-clinicians ile footer rengi tutarsızlığı
            yaratırdı (o sayfalar AuraClosing'i sarmalayıcısız kullanır). Almaşık
            yalnız en sonda yumuşar — açılıştaki çift-koyunun kapanış eşleniği.
            ⚠️ ai/accessibility SÖZLÜKLERİ copy.ts'te duruyor (clinicians'ı
            /for-clinicians sayfası kullanmaya devam eder; yapı-imza testi
            9 dilde aynı kaldı) — bölümler yalnız BU dizilimden düştü.
            Koyu bölümler .aura-page gece token'larını miras alır (sarmalayıcısız);
            açık bölümler tekil .aura-light sarmalanır.
            🪤 V2EntryPaths zeminini SABİT bg-[var(--aura-night)] ile verir — sarmalasan
            da koyu kalır. Bu dizilimde zaten koyu isteniyor; ileride beyaza almak
            gerekirse bileşenin KENDİ zeminine bak, buradaki sarmalayıcı yetmez. */}
        <V2Hero />
        <div className="aura-light bg-[var(--aura-bg)]">
          <AuraHowItWorks />
        </div>
        <V2EntryPaths />
        <div className="aura-light bg-[var(--aura-bg)]">
          <V2ConnectedCare />
        </div>
        <AuraDoctors />
        <div className="aura-light bg-[var(--aura-bg)]">
          <AuraTrust />
        </div>
        <V2Doctorium />
        <AuraClosing />
      </main>
    </div>
  );
}
