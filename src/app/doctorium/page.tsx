import type { Metadata } from "next";
import { DoctoriumLandingV3 } from "@/components/aura/doctorium-v3/DoctoriumLandingV3";
import { StructuredData } from "@/components/aura/structured-data";
import { doctoriumSameAs } from "@/components/aura/doctorium-social-links";
import { LANDING_META } from "@/lib/doctorium-landing/content";
import { DOCTORIUM_CANONICAL_URL } from "@/lib/brand";

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

// Canonical DAİMA doctorium.tr KÖKÜ (2026-10-26, Search Console ölçümü): Doctorium deploy'unda "/" bu sayfaya rewrite
// olur; canonical "/doctorium" deyince Google kökü seçip sayfayı "kopya" saydı. AURA host'unda da servis edilen bu
// sayfa mutlak adresle doctorium.tr'yi gösterir (/secki ve hukuki sayfalarla aynı desen) — iki alan adı yarışmaz.
const CANONICAL = `${DOCTORIUM_CANONICAL_URL}/`;

export const metadata: Metadata = {
  // Ayrışma (2026-08-24): segment layout'u "%s · Doctorium" şablonu uygular — landing'in kendisi
  // yalın "Doctorium" kalsın diye absolute ("Doctorium · Doctorium" tekrarı olmasın).
  title: { absolute: "Doctorium" },
  description: LANDING_META.description,
  alternates: { canonical: CANONICAL },
  openGraph: {
    type: "website",
    url: CANONICAL,
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
// WebPage + Organization; rating/medical/aggregate şeması YOK (kanıtsız iddia). isPartOf AURA
// WebSite'ı 2026-08-24 ayrışmasında kaldırıldı (marka bağımsız konumlanır).
// Organization.sameAs (2026-10-09): resmî sosyal hesaplar — footer ikon satırıyla AYNI liste
// (`doctoriumSameAs()`); arama motoru hesapları markayla eşleştirir. Organization'a yalnız ad +
// adres + hesaplar girer (kuruluş yılı/çalışan/adres gibi doğrulanmamış alan EKLENMEZ).
const ORG_ID = `${DOCTORIUM_CANONICAL_URL}/#doctorium`;
const JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": ORG_ID,
      name: "Doctorium",
      url: CANONICAL,
      sameAs: doctoriumSameAs(),
    },
    {
      "@type": "WebPage",
      name: "Doctorium",
      url: CANONICAL,
      inLanguage: "tr-TR",
      description: LANDING_META.description,
      publisher: { "@id": ORG_ID },
    },
  ],
});

export default function DoctoriumLandingPage() {
  return (
    <>
      <StructuredData json={JSON_LD} />
      <DoctoriumLandingV3 />
    </>
  );
}
