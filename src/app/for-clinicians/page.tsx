import type { Metadata } from "next";
import { ForClinicians } from "@/components/aura/for-clinicians";
import { OG_LOCALE, OG_ALTERNATE_LOCALES } from "@/lib/aura-landing/seo";

// /for-clinicians (v6.17) — doktor-yüzü vitrin. how-it-works sözleşmesiyle aynı:
// indekslenir, sitemap'te, 8 dil TEK URL (dil client-side air_lang) →
// og:locale:alternate ile işaretlenir; sayfa kendi aura nav/footer'ını taşır.
// ⚠️ İddia disiplini (v6.8): metadata da görünür metinle aynı kurala tabi —
// "verified" = belge incelemesi (kodda /admin/hekim-onay), akreditasyon DEĞİL.
export const metadata: Metadata = {
  title: "For clinicians", // layout template → "For clinicians · AURA"
  description:
    "Practice across borders with prepared cases: document-verified profiles, FHIR-based onboarding, AI drafts labelled indicative — the clinical decision stays with the doctor.",
  alternates: { canonical: "/for-clinicians" },
  openGraph: {
    type: "website",
    url: "/for-clinicians",
    siteName: "AURA",
    title: "AURA for clinicians",
    description:
      "Cross-border patients with prepared cases. Verification before visibility, structured onboarding, and AI that drafts — never decides.",
    locale: OG_LOCALE.en,
    alternateLocale: OG_ALTERNATE_LOCALES,
    images: [{ url: "/assets/video/p-hero3.jpg", width: 1280, height: 720, alt: "AURA" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AURA for clinicians",
    description: "Cross-border patients, prepared cases — the clinical decision stays yours.",
    images: ["/assets/video/p-hero3.jpg"],
  },
};

export default function ForCliniciansPage() {
  return <ForClinicians />;
}
