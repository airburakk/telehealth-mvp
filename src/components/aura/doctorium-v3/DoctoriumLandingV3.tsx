import type { ReactNode } from "react";
import { canShowAll } from "@/lib/doctorium-landing/capabilities";
import { SECTIONS, type SectionId } from "@/lib/doctorium-landing/content";
import { landingFeedSample, landingProofSample, type LandingSample } from "@/lib/doctorium-landing/landing-feed";
import { DEFAULT_DEMO_BRANCH, DEFAULT_DEMO_MODULES } from "@/lib/doctorium-landing/taxonomy";
import { LandingEventBeacon } from "../doctorium-v2/LandingEventBeacon";
import { MobileStickyCta } from "../doctorium-v2/MobileStickyCta";
import { LandingFooterV3 } from "./Footer";
import { LandingHeader } from "./LandingHeader";
import { V3_LIGHT } from "./palette";
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
import { PostSection } from "./sections/Post";
import { ProblemSection } from "./sections/Problem";
import { RegulatorySection } from "./sections/Regulatory";
import { TransparencySection } from "./sections/Transparency";

// /doctorium landing V3 (2026-08-26, modernizasyon turu — kullanıcı brief'i "Apple estetiği").
//
// V2'den DEVRALINAN sözleşmeler (değişmedi): bölüm sırası SECTIONS · requires/canShowAll kapısı ·
// tek DB turu (landingFeedSample + landingProofSample memo'lu, fixture yedekli) · analytics
// (LandingEventBeacon + CtaLink track) · tek dil TR · iddia disiplini content.ts'te · ProductFrame
// içinde GERÇEK ürün bileşenleri.
//
// V3'ün DEĞİŞTİRDİKLERİ:
//   · ZEBRA YOK (kullanıcı, 2026-08-26 üç adımda): "tek koyu blok hero" → "hero da açık, video
//     gelecek" → "film13'ü arkaya yerleştir" NİHAİ: hero = film13 video-zeminli (paleti Hero.tsx
//     taşır, zemin düz koyu değil FİLM), kalan 13 bölüm + header + footer açık (#fbfbfa);
//     manifesto açık-panel bandı; diğer koyu kutular ProductFrame ürün pencereleri. theme.ts.
//   · Tek font ailesi: Inter (gövde zaten Inter'di; başlıklardaki Space Grotesk/aura-display ve
//     mono etiketler v3 yüzeyinde kalktı — DoctoriumWord lockup'ı marka olduğu için istisna).
//   · Framer Motion bölüm-girişleri (FadeInUp: 400ms, [0.32,0.72,0,1], reduced-motion destekli).
//   · shadcn deseni ui/button.tsx (cva) — landing'in düğme giysisi.
export async function DoctoriumLandingV3() {
  const [sample, proof] = await Promise.all([
    landingFeedSample(DEFAULT_DEMO_BRANCH, DEFAULT_DEMO_MODULES, 12) as Promise<LandingSample>,
    landingProofSample(DEFAULT_DEMO_BRANCH),
  ]);

  const renderers: Partial<Record<SectionId, () => ReactNode>> = {
    hero: () => <HeroSection />,
    problem: () => <ProblemSection />,
    manifesto: () => <ManifestoSection />,
    personalize: () => <PersonalizeSection sample={sample} />,
    // "today" yuvası (kullanıcı 2026-08-26): "Bugün sizin için" yerine DOCTORIUM POST tanıtımı —
    // id/anchor/sıra content.ts'ten sürer, metin Post.tsx POST_COPY'de (v2 arşivi content'i
    // paylaştığı için content.ts'e yazılmadı).
    today: () => <PostSection sample={sample} />,
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
    <div lang="tr" style={V3_LIGHT} className="min-h-dvh bg-[var(--dl-bg)] text-[var(--dl-ink)]">
      <LandingHeader />
      {/* <main> DEĞİL: kök layout zaten <main> sarar (iç içe main = axe landmark ihlali). */}
      <div id="icerik" className="pb-14 md:pb-0">
        {SECTIONS.map((s) => {
          const r = renderers[s.id];
          if (!r || !canShowAll(s.requires)) return null;
          return <div key={s.id} className="contents">{r()}</div>;
        })}
      </div>
      <LandingFooterV3 />
      <MobileStickyCta />
      <LandingEventBeacon />
    </div>
  );
}
