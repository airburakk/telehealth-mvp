import type { Metadata } from "next";
import { V2Home } from "@/components/aura/v2/home";
import { StructuredData } from "@/components/aura/structured-data";
import { OG_LOCALE, OG_ALTERNATE_LOCALES, SITE_URL } from "@/lib/aura-landing/seo";
import { LANG_CODES } from "@/lib/aura-landing/copy";

// ANA SAYFA = V2 (taşıma 2026-07-16, kullanıcı onayı: "v2'yi siteye geçebiliriz").
// Önceki sinematik landing (AuraLanding, v5.9→v6.15) tag'de: `landing-eski-v5.9-son`
// — bileşenleri repoda duruyor (geri dönüş; silme = ayrı temizlik kararı).
// /v2 rotası kalıcı redirect'e döndü (bookmark kırılmaz).
// Sayfa statik sözlükle çizilir (DB yok); dil client'ta air_lang'dan.
const SITE = SITE_URL;

// Metadata = yeni konumlandırma (brand paketi + v6.14 kullanıcı onaylı metinler):
// başlık "Care, without borders." · açıklama v2.hero.lede (onaylı 9-dil setinin EN'i).
// hreflang KARARI değişmedi: "/" kanonik, 9 dil tek URL (og:locale:alternate);
// /en…/bg rotaları var ama noindex — indeksleme AYRI kullanıcı kararı ([lang]/page.tsx).
// İddia disiplini (v6.8): determinist AI dili yok, "end to end" ifadesi tamamen çıktı.
export const metadata: Metadata = {
  title: { absolute: "AURA — Care, without borders." },
  description:
    "Meet the right specialist, understand your options and continue your care wherever you are — with multilingual support from first assessment to follow-up.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "AURA",
    title: "AURA — Care, without borders.",
    description:
      "One care journey, four ways to begin: talk to a doctor, second opinion, health tourism and access care — in 9 languages.",
    locale: OG_LOCALE.en,
    alternateLocale: OG_ALTERNATE_LOCALES,
    images: [{ url: "/assets/video/p-hero3.jpg", width: 1280, height: 720, alt: "AURA" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AURA — Care, without borders.",
    description:
      "Meet the right specialist and keep your care connected from first assessment to follow-up.",
    images: ["/assets/video/p-hero3.jpg"],
  },
};

// JSON-LD de yeni konumlandırmada — görünür metinle aynı iddia disiplini
// (v6.8: meta/OG/JSON-LD ayrı taranır; determinist/sonuç iddiası yok).
const LD_JSON = JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "MedicalOrganization",
      name: "AURA",
      url: SITE,
      logo: `${SITE}/assets/aura-symbol.png`,
      description:
        "A multilingual digital care platform connecting case preparation, specialist consultation, treatment planning and follow-up across borders.",
      areaServed: "Türkiye",
    },
    {
      "@type": "WebSite",
      name: "AURA — Cross-Border Digital Care",
      url: SITE,
      inLanguage: LANG_CODES, // tek doğruluk noktası (copy.ts; 2026-07-23'e dek elle 8'lik kopyaydı)
    },
  ],
});

export default function Home() {
  return (
    <>
      <StructuredData json={LD_JSON} />
      <V2Home />
    </>
  );
}
