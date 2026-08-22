import type { Metadata } from "next";
import { DoctoriumLandingV2 } from "@/components/aura/doctorium-v2/DoctoriumLandingV2";
import { StructuredData } from "@/components/aura/structured-data";
import { LANDING_META } from "@/lib/doctorium-landing/content";
import { SITE_URL } from "@/lib/aura-landing/seo";

// /doctorium — Doctorium tanıtım landing'i V2 (2026-08-23). v1 → /doctorium-v1 (noindex) +
// tag doctorium-landing-v1-son. Sözleşme aynen: indekslenir, sitemap'te, kendi kromu.
// ⚠️ İddia disiplini: görünür metin + metadata + JSON-LD aynı kurala tabi (ölçülmemiş süre/oran
// YOK; "doğrulanmış" = belge incelemesi; EMA/TİTCK yok; "hekim" yok) — content.ts + registry testi.
// Veri: sayfa DB'den örnek akış okur (ISR 10 dk) — tazelik yeterli, DB yükü sınırlı; DB
// ulaşılamazsa fixture ile render olur (landing-feed.ts), sayfa asla 500 vermez.
export const revalidate = 600;

export const metadata: Metadata = {
  title: LANDING_META.title, // kök layout "%s · AURA" ekler — ELLE " · AURA" YAZMA (v6.43 dersi)
  description: LANDING_META.description,
  alternates: { canonical: "/doctorium" },
  openGraph: {
    type: "website",
    url: "/doctorium",
    siteName: "AURA",
    title: LANDING_META.ogTitle,
    description: LANDING_META.ogDescription,
    locale: "tr_TR",
  },
  twitter: {
    card: "summary",
    title: LANDING_META.ogTitle,
    description: LANDING_META.ogDescription,
  },
};

// JSON-LD — MODÜL-DÜZEYİ sabit (kullanıcı girdisi girmez; structured-data.tsx sözleşmesi).
// Yalnız WebPage + isPartOf WebSite; rating/medical/aggregate şeması YOK (kanıtsız iddia).
const JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Doctorium",
  url: `${SITE_URL}/doctorium`,
  inLanguage: "tr-TR",
  description: LANDING_META.description,
  isPartOf: { "@type": "WebSite", name: "AURA", url: SITE_URL },
});

export default function DoctoriumLandingPage() {
  return (
    <>
      <StructuredData json={JSON_LD} />
      <DoctoriumLandingV2 />
    </>
  );
}
