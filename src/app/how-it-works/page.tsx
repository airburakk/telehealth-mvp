import type { Metadata } from "next";
import { HowItWorks } from "@/components/aura/how-it-works";
import { StructuredData } from "@/components/aura/structured-data";
import { COPY } from "@/lib/aura-landing/copy";

// /how-it-works (vitrinden taşındı, 2026-07-12): dört yolculuğun adım adım
// rehberi. Global Header/SiteFooter bu rotada gizlidir — sayfa kendi aura
// nav/footer'ını taşır.
export const metadata: Metadata = {
  title: "AURA · How it works",
  description:
    "How AURA works, step by step: telehealth visits, independent second opinions, planned health tourism in Türkiye and free volunteer care.",
  alternates: { canonical: "https://telehealth-mvp-roan.vercel.app/how-it-works" },
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
