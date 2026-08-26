import type { Metadata } from "next";
import { DoctoriumLandingV2 } from "@/components/aura/doctorium-v2/DoctoriumLandingV2";

// /doctorium-v2 (2026-08-26, kullanıcı kararı) — V3 landing'e geçerken V2 (v6.136-149)
// landing'inin canlı yedeği; v1 takasındaki desenin aynısı (/doctorium-v1 + tag). Git karşılığı
// `doctorium-landing-v2-son` tag'i. Bu sayfa:
//   · noindex + robots.ts disallow + sitemap DIŞI,
//   · chrome-routes.ts CHROME_FREE_ROUTES'ta,
//   · bileşeni DEĞİŞTİRMEZ — doctorium-v2/ dizini V2 olarak dondurulmuştur.
// V3 kesinleşince bu rota kaldırılır (tag geri dönüş için yeter); V2'nin ProductFrame /
// FeedPreview gibi paylaşılan ürün-çerçevesi bileşenleri v3 tarafından da kullanıldığından
// dizin silme işi o bağımlılıklar ayrıştırılarak yapılır.
export const metadata: Metadata = {
  title: "Doctorium (v2)",
  robots: { index: false, follow: false },
  alternates: { canonical: "/doctorium" },
};

export default function DoctoriumLandingV2Page() {
  return <DoctoriumLandingV2 />;
}
