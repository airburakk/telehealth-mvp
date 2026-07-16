"use client";

import { AuraClosing } from "../closing";
import { AuraTrust } from "../trust";
import { AuraDoctors } from "../doctors";
import { AuraHowItWorks } from "../how";
import { V2Accessibility, V2AiResponsibility, V2ConnectedCare } from "./claim-section";
import { V2EntryPaths } from "./entry-paths";
import { V2Hero } from "./hero";
import { V2Nav } from "./nav";
import { LangProvider, langDir, useLang } from "@/lib/aura-landing/i18n";

// /v2 — YENİ ANA SAYFA (2026-07-16), ÖNİZLEME rotası (noindex).
// Kullanıcı kararı: yeni sayfa /v2'de kurulur, gerçek cihazda mevcut / ile
// karşılaştırılır, onaylanınca /'ye taşınır (eski landing tag'le geri alınabilir).
//
// Blueprint IA sırası: Hero → EntryPaths → CareJourney → ConnectedCare → Trust
// → HumanExpertise → Accessibility → Clinicians → Closing.
// FAZ 1 (bu commit): Hero + EntryPaths (video arkalı) + mevcut how/doctors/trust
// + closing. Kalan bölümler (ConnectedCare · HumanExpertise · Accessibility ·
// Clinicians + /for-clinicians) sonraki fazlarda — hepsi kullanıcı onaylı.
export function V2Home() {
  return (
    <LangProvider>
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
      {/* V2Nav (v6.16): kök AuraNav yerine — dört hizmet sekmesi yerine tek
          bakım mimarisi. Kök nav / ve /how-it-works'te dokunulmadan durur. */}
      <V2Nav />
      <main>
        <V2Hero />
        <V2EntryPaths />
        {/* Sandwich gövdesi: gece bantların arasındaki gündüz şeridi (mevcut
            landing ile aynı desen; token'lar .aura-light'ta açık değerlere geçer). */}
        {/* Gündüz şeridi — akış: nasıl işliyor → kim (doktorlar) → kanıt (güven) →
            AI'nın SINIRI → erişilebilirlik. İki yeni bölüm (v6.16 Faz 2) güvenin
            HEMEN ardında: güven "neye güvenebilirsiniz"i, bunlar "neyi iddia
            etmiyoruz"u söyler — sıra bilinçli, ikisi birbirini tamamlıyor. */}
        <div className="aura-light bg-[var(--aura-bg)]">
          <AuraHowItWorks />
          {/* ConnectedCare (v6.17) blueprint IA'ya uygun: süreç (how) → ne bağlı
              kalır (connected) → kim (doctors) → kanıt (trust) → sınırlar (ai/a11y). */}
          <V2ConnectedCare />
          <AuraDoctors />
          <AuraTrust />
          <V2AiResponsibility />
          <V2Accessibility />
        </div>
        <AuraClosing />
      </main>
    </div>
  );
}
