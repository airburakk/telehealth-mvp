import type { Metadata } from "next";
import { AuraLanding } from "@/components/aura/landing";
import { StructuredData } from "@/components/aura/structured-data";
import { OG_LOCALE, OG_ALTERNATE_LOCALES, SITE_URL } from "@/lib/aura-landing/seo";

// AURA sinematik landing (vitrin aura-health.higgsfield.app'ten taşındı,
// 2026-07-12) — vitrin + platform tek sitede birleşti. Önceki tasarım
// PortamedLanding v5.9.1'de emekli edildi (ölü kod silindi). Sayfa statik
// sözlükle çizilir (DB sorgusu yok); dil seçimi client'ta air_lang'dan okunur.
const SITE = SITE_URL;

// SEO metadata: landing-özel zengin başlık + OpenGraph/Twitter kart + canonical.
// hreflang KARARI (v5.9.1): landing 8 dil TEK URL'de (dil client-side, air_lang) —
// klasik path-başına-URL yerine og:locale:alternate + JSON-LD inLanguage ile işaretlenir
// (gerçeğe uygun; ayrı rota/prerender üretmez).
// P0 dürüstlük (v6.8): SEO metni de görünür metinle aynı iddia disiplinine tabi —
// "AI triage" (determinist/klinik ses tonu) → "AI-supported case preparation".
// Buradaki "end to end" ŞİFRELEME DEĞİL, hizmet sürekliliğidir (hero ile aynı) → kalır.
export const metadata: Metadata = {
  title: { absolute: "AURA — Telehealth & Health Tourism, End to End" },
  description:
    "AURA: AI-supported case preparation, video consultations, independent second opinions and planned health tourism in Türkiye — end to end, in 8 languages.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "AURA",
    title: "AURA — Telehealth & Health Tourism, End to End",
    description:
      "AI-supported case preparation, video consultations, independent second opinions and planned health tourism in Türkiye — end to end.",
    locale: OG_LOCALE.en,
    alternateLocale: OG_ALTERNATE_LOCALES,
    images: [{ url: "/assets/video/p-hero3.jpg", width: 1280, height: 720, alt: "AURA" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AURA — Telehealth & Health Tourism, End to End",
    description: "AI-supported case preparation, video consultations, second opinions and health tourism — end to end.",
    images: ["/assets/video/p-hero3.jpg"],
  },
};
const LD_JSON = JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "MedicalOrganization",
      name: "AURA",
      url: SITE,
      logo: `${SITE}/assets/aura-symbol.png`,
      description:
        "Telehealth and health tourism, end to end — AI-supported case preparation, video consultations, independent second opinions and planned health tourism in Türkiye.",
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
