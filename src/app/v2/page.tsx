import type { Metadata } from "next";
import { V2Home } from "@/components/aura/v2/home";

// /v2 — yeni ana sayfa ÖNİZLEMESİ (2026-07-16). Kullanıcı kararı: yeni sayfa
// burada kurulur, canlıda gerçek cihazda mevcut "/" ile karşılaştırılır,
// onaylanınca "/"ye taşınır.
//
// ⚠️ noindex ZORUNLU: aynı içeriğin iki URL'de indekslenmesi "/"nin SEO'sunu
// böler (kopya içerik). sitemap.ts'e de EKLENMEDİ. Sayfa "/"ye taşınınca bu
// rota ve noindex kalkar.
export const metadata: Metadata = {
  title: "AURA v2 (önizleme)",
  robots: { index: false, follow: false },
};

export default function V2Page() {
  return <V2Home />;
}
