import type { Metadata } from "next";
import { StructuredData } from "@/components/aura/structured-data";
import { TrustSafety } from "@/components/aura/trust-safety";
import { COPY } from "@/lib/aura-landing/copy";
import { OG_LOCALE, OG_ALTERNATE_LOCALES } from "@/lib/aura-landing/seo";

// /guven-ve-gizlilik — Güven ve Gizlilik (2026-07-15). Eski/kısa yol /trust
// buraya 301 (next.config.ts). SEO: landing ile aynı 8-dil-tek-URL sinyali.
//
// ⚠️ İDDİA DİSİPLİNİ [[public-claim-honesty]]: görünür metin YETMEZ — aşağıdaki
// description/OG/JSON-LD de aynı iddia sınıfıdır. Buradaki metinler sayfanın
// kendi sözleşmesiyle aynı çizgide tutulur: "iletimde ve sunucuda şifreli"
// (uçtan uca DEĞİL), "belge doğrulaması" (akreditasyon DEĞİL).
export const metadata: Metadata = {
  title: "Trust & Privacy", // layout template → "Trust & Privacy · AURA"
  description:
    "How AURA protects health data: encrypted in transit and at rest, stored and processed in the EU (Frankfurt), role-based access, separate consent for AI steps, a tamper-evident access log — and what we do not claim.",
  alternates: { canonical: "/guven-ve-gizlilik" },
  openGraph: {
    type: "article",
    url: "/guven-ve-gizlilik",
    siteName: "AURA",
    title: "Trust & Privacy at AURA",
    description:
      "What we do, what we do not yet do, and what is not ours to decide — data protection, consent, access, doctor verification, retention and deletion.",
    locale: OG_LOCALE.en,
    alternateLocale: OG_ALTERNATE_LOCALES,
    images: [{ url: "/assets/video/p-hero3.jpg", width: 1280, height: 720, alt: "AURA" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Trust & Privacy at AURA",
    images: ["/assets/video/p-hero3.jpg"],
  },
};

// SEO: 10 bölüm = FAQPage (EN birincil; modül-düzeyi sabit dize — StructuredData
// sözleşmesi). COPY "use client"sız copy.ts'ten gelir → server component'te
// güvenle iterate edilir (RSC client-referans tuzağı yok).
// Cevap metni gövde + varsa "neyi iddia etmiyoruz" notunu BİRLİKTE taşır:
// arama sonucunda iddia, sınırından koparılmış görünmesin.
const LD_JSON = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  inLanguage: "en",
  mainEntity: COPY.en.trustPage.sections.map((s) => {
    const extra =
      s.key === "consent"
        ? ` ${COPY.en.trustPage.aiEmphasis}`
        : s.key === "transfers"
          ? ` ${COPY.en.trustPage.transferItems.join(" ")}`
          : "";
    const note = s.note.text ? ` ${s.note.label}: ${s.note.text}` : "";
    return {
      "@type": "Question",
      name: s.title,
      acceptedAnswer: { "@type": "Answer", text: `${s.body}${extra}${note}` },
    };
  }),
});

export default function TrustPage() {
  return (
    <>
      <StructuredData json={LD_JSON} />
      <TrustSafety />
    </>
  );
}
