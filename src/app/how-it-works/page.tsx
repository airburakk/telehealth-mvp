import type { Metadata } from "next";
import { HowItWorks } from "@/components/aura/how-it-works";
import { StructuredData } from "@/components/aura/structured-data";
import { COPY } from "@/lib/aura-landing/copy";
import { OG_LOCALE, OG_ALTERNATE_LOCALES } from "@/lib/aura-landing/seo";

// /how-it-works (vitrinden taşındı, 2026-07-12): dört yolculuğun adım adım
// rehberi. Global Header/SiteFooter bu rotada gizlidir — sayfa kendi aura
// nav/footer'ını taşır. SEO: landing ile aynı 8-dil-tek-URL sinyali (og:locale:alternate).
export const metadata: Metadata = {
  title: "How it works", // layout template → "How it works · AURA"
  description:
    "How AURA works, step by step: telehealth visits, independent second opinions, planned health tourism in Türkiye and free volunteer care.",
  alternates: { canonical: "/how-it-works" },
  openGraph: {
    type: "article",
    url: "/how-it-works",
    siteName: "AURA",
    title: "How AURA works, step by step",
    description:
      "Telehealth visits, independent second opinions, planned health tourism and free volunteer care — how each journey works.",
    locale: OG_LOCALE.en,
    alternateLocale: OG_ALTERNATE_LOCALES,
    images: [{ url: "/assets/video/p-hero3.jpg", width: 1280, height: 720, alt: "AURA" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "How AURA works, step by step",
    images: ["/assets/video/p-hero3.jpg"],
  },
};

// SEO: 4 rehber = 4 HowTo şeması (EN birincil; modül-düzeyi sabit dize —
// StructuredData sözleşmesi). COPY "use client"sız copy.ts'ten gelir —
// server component'te güvenle iterate edilir (RSC client-referans tuzağı yok).
const LD_JSON = JSON.stringify({
  "@context": "https://schema.org",
  "@graph": COPY.en.hiw.guides.map((g) => {
    const ch = COPY.en.chapters.find((c) => c.key === g.key);
    return {
      "@type": "HowTo",
      name: ch?.title ?? "AURA",
      description: ch?.body ?? "",
      inLanguage: "en",
      step: g.steps.map((s, i) => ({
        "@type": "HowToStep",
        position: i + 1,
        name: s.t,
        text: s.d,
      })),
    };
  }),
});

export default function HowItWorksPage() {
  return (
    <>
      <StructuredData json={LD_JSON} />
      <HowItWorks />
    </>
  );
}
