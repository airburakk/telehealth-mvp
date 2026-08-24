import type { ReactNode } from "react";
import { DOCTORIUM_PALETTE } from "@/components/aura/doctorium-brand";
import { DoctoriumFooter } from "@/components/aura/doctorium-footer";
import { canShowAll } from "@/lib/doctorium-landing/capabilities";
import { SECTIONS, type SectionId } from "@/lib/doctorium-landing/content";
import { landingFeedSample, landingProofSample, type LandingSample } from "@/lib/doctorium-landing/landing-feed";
import { DEFAULT_DEMO_BRANCH, DEFAULT_DEMO_MODULES } from "@/lib/doctorium-landing/taxonomy";
import { LandingEventBeacon } from "./LandingEventBeacon";
import { LandingHeader } from "./LandingHeader";
import { MobileStickyCta } from "./MobileStickyCta";
import { AcademicSection } from "./sections/Academic";
import { CongressSection } from "./sections/Congress";
import { ControlSection } from "./sections/Control";
import { DifferenceSection } from "./sections/Difference";
import { FinalCtaSection } from "./sections/FinalCta";
import { HeroSection } from "./sections/Hero";
import { IdentitySection } from "./sections/Identity";
import { LegalSection } from "./sections/Legal";
import { ManifestoSection } from "./sections/Manifesto";
import { PersonalizeSection } from "./sections/Personalize";
import { ProblemSection } from "./sections/Problem";
import { RegulatorySection } from "./sections/Regulatory";
import { TodaySection } from "./sections/Today";
import { TransparencySection } from "./sections/Transparency";

// /doctorium landing V2 (2026-08-23, kullanıcının 7 parçalık "Landing Page V2" paketi).
//
// TEZ: Doctorium bir modül/portal listesi değil, "her doktorun kendi profesyonel bilgi çalışma
// alanını oluşturduğu ürün". Üç katmanlı mesaj: marka (hero/final) → ürün (manifesto) → günlük
// dönüş (bugün). AI kimlik değil motor — hero'da geçmez. Sahte dashboard YOK: ürünün gerçek
// bileşenleri (ArticleCard …) ProductFrame içinde, salt-okunur.
//
// Sözleşmeler:
//   · Bölüm sırası content.ts SECTIONS; bölüm `requires` registry'den geçemezse RENDER EDİLMEZ
//     (canShowAll) — fake bileşenle doldurulmaz. Henüz yazılmamış bölüm (S2) de atlanır.
//   · Tek DB turu: landingFeedSample (memo'lu) → hero/demo/bugün aynı örneği paylaşır.
//   · Eski landing v1 = /doctorium-v1 + tag doctorium-landing-v1-son (karşılaştırma/geri dönüş).
//   · Kendi kromu: Header/SiteFooter chrome-routes.ts ile gizli; footer DoctoriumFooter (ortak).
//   · Analytics: first-party agregat (LandingEventBeacon + CtaLink track) — kimlik/tercih yok.
//   · Tek dil TR; "hekim" yok; iddia disiplini content.ts başlığında + registry testi.
export async function DoctoriumLandingV2() {
  // İki memo'lu okuma (akış örneği + kanıt bölümleri verisi) paralel; ikisi de fixture yedekli.
  const [sample, proof] = await Promise.all([
    landingFeedSample(DEFAULT_DEMO_BRANCH, DEFAULT_DEMO_MODULES, 12) as Promise<LandingSample>,
    landingProofSample(DEFAULT_DEMO_BRANCH),
  ]);

  const renderers: Partial<Record<SectionId, () => ReactNode>> = {
    hero: () => <HeroSection sample={sample} />,
    problem: () => <ProblemSection />,
    manifesto: () => <ManifestoSection />,
    personalize: () => <PersonalizeSection sample={sample} />,
    today: () => <TodaySection sample={sample} />,
    academic: () => <AcademicSection proof={proof.academic} branch={sample.branch} />,
    regulatory: () => <RegulatorySection sample={sample} />,
    legal: () => <LegalSection proof={proof.legal} branch={sample.branch} />,
    congress: () => <CongressSection proof={proof.congress} branch={sample.branch} />,
    identity: () => <IdentitySection />,
    control: () => <ControlSection />,
    transparency: () => <TransparencySection />,
    difference: () => <DifferenceSection />,
    "get-started": () => <FinalCtaSection />,
  };

  return (
    <div lang="tr" style={DOCTORIUM_PALETTE} className="min-h-dvh bg-[var(--dl-bg)] text-[var(--dl-ink)]">
      <LandingHeader />
      {/* <main> DEĞİL: kök layout zaten <main> sarar (iç içe main = axe landmark ihlali; v1'de de vardı).
          Skip link hedefi bu div. */}
      <div id="icerik" className="pb-14 md:pb-0">
        {SECTIONS.map((s) => {
          const r = renderers[s.id];
          if (!r || !canShowAll(s.requires)) return null;
          return <div key={s.id} className="contents">{r()}</div>;
        })}
      </div>
      <DoctoriumFooter />
      <MobileStickyCta />
      <LandingEventBeacon />
    </div>
  );
}
