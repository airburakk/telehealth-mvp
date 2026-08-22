import type { Metadata } from "next";
import { DoctoriumLanding } from "@/components/aura/doctorium-landing";

// /doctorium-v1 (2026-08-23, kullanıcı kararı) — V2 landing'e geçerken ESKİ (v6.100) Doctorium
// landing'inin canlı yedeği. Amaç: iki sürümü tarayıcıda yan yana karşılaştırıp "beğenmedik →
// geri dön" kararını tek satır rota takasıyla vermek. Git tarafındaki karşılığı
// `doctorium-landing-v1-son` tag'i (4613fe2). Bu sayfa:
//   · noindex + robots.ts disallow + sitemap DIŞI (arama motoru iki landing görmesin),
//   · chrome-routes.ts CHROME_FREE_ROUTES'ta (yoksa global Header/SiteFooter üstüne biner —
//     2026-08-17 "iki footer" regresyonu),
//   · bileşeni DEĞİŞTİRMEZ — doctorium-landing.tsx v1 olarak dondurulmuştur.
// V2 kesinleşince bu rota ve v1 bileşeni birlikte kaldırılır (tag geri dönüş için yeter).
export const metadata: Metadata = {
  title: "Doctorium (v1)",
  robots: { index: false, follow: false },
  alternates: { canonical: "/doctorium" },
};

export default function DoctoriumLandingV1Page() {
  return <DoctoriumLanding />;
}
