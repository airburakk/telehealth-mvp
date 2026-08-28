import type { Metadata } from "next";
import { DoctoriumLandingV3 } from "@/components/aura/doctorium-v3/DoctoriumLandingV3";
import { StructuredData } from "@/components/aura/structured-data";
import { LANDING_META } from "@/lib/doctorium-landing/content";
import { SITE_URL } from "@/lib/aura-landing/seo";

// /doctorium — Doctorium tanıtım landing'i V3 (2026-08-26, modernizasyon turu: zebra yok,
// Inter tek aile, film13 hero, Framer Motion). Karşılaştırma yedeği rotaları (v1/v2) V3
// kesinleşince kaldırıldı (2026-08-28); geri dönüş git tag'leriyle mümkün:
// doctorium-landing-v1-son · doctorium-landing-v2-son.
// Sözleşme aynen: indekslenir, sitemap'te, kendi kromu.
// ⚠️ İddia disiplini: görünür metin + metadata + JSON-LD aynı kurala tabi (ölçülmemiş süre/oran
// YOK; "doğrulanmış" = belge incelemesi; EMA/TİTCK yok; "hekim" yok) — content.ts + registry testi.
// Veri: sayfa DB'den örnek akış okur (ISR 10 dk) — tazelik yeterli, DB yükü sınırlı; DB
// ulaşılamazsa fixture ile render olur (landing-feed.ts), sayfa asla 500 vermez.
export const revalidate = 600;

export const metadata: Metadata = {
  // Ayrışma (2026-08-24): segment layout'u "%s · Doctorium" şablonu uygular — landing'in kendisi
  // yalın "Doctorium" kalsın diye absolute ("Doctorium · Doctorium" tekrarı olmasın).
  title: { absolute: "Doctorium" },
  description: LANDING_META.description,
  alternates: { canonical: "/doctorium" },
  openGraph: {
    type: "website",
    url: "/doctorium",
    siteName: "Doctorium",
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
// Yalnız WebPage; rating/medical/aggregate şeması YOK (kanıtsız iddia). isPartOf AURA
// WebSite'ı 2026-08-24 ayrışmasında kaldırıldı (marka bağımsız konumlanır).
const JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Doctorium",
  url: `${SITE_URL}/doctorium`,
  inLanguage: "tr-TR",
  description: LANDING_META.description,
});

export default function DoctoriumLandingPage() {
  return (
    <>
      <StructuredData json={JSON_LD} />
      <DoctoriumLandingV3 />
    </>
  );
}
