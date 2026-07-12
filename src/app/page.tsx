import { AuraLanding } from "@/components/aura/landing";
import { StructuredData } from "@/components/aura/structured-data";

// AURA sinematik landing (vitrin aura-health.higgsfield.app'ten taşındı,
// 2026-07-12) — vitrin + platform tek sitede birleşti.
// Önceki tasarımlar: PortamedLanding (src/components/PortamedLanding.tsx,
// design_handoff_portamed_landing) · daha eskisi design-backup/anasayfa-klasik-v2.6.tsx.bak.
// Sayfa statik sözlükle çizilir (DB sorgusu yok); dil seçimi client'ta
// air_lang'dan okunur.

// SEO: JSON-LD (MedicalOrganization + WebSite) — modül-düzeyi sabit dize
// (StructuredData sözleşmesi). COPY verisi "use client"sız copy.ts'te durur;
// (RSC client-referans tuzağına girmez).
const SITE = "https://telehealth-mvp-roan.vercel.app";
const LD_JSON = JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "MedicalOrganization",
      name: "AURA",
      url: SITE,
      logo: `${SITE}/assets/aura-symbol.png`,
      description:
        "Telehealth and health tourism, end to end — AI triage, video consultations, independent second opinions and planned health tourism in Türkiye.",
      areaServed: "Türkiye",
    },
    {
      "@type": "WebSite",
      name: "AURA — Telehealth & Health Tourism",
      url: SITE,
      inLanguage: ["en", "tr", "de", "fr", "ru", "ar", "fa", "az"],
    },
  ],
});

export default function Home() {
  return (
    <>
      <StructuredData json={LD_JSON} />
      <AuraLanding />
    </>
  );
}
