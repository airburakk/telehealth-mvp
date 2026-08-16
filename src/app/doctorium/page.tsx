import type { Metadata } from "next";
import { DoctoriumLanding } from "@/components/aura/doctorium-landing";

// /doctorium (2026-08-16) — Doctorium tanıtım landing'i: giriş yapmamış hekim/öğrenciye portalı
// anlatır, /kayit ve /ogrenci hunilerine çağırır. for-clinicians sözleşmesiyle aynı: indekslenir,
// sitemap'te, sayfa kendi üst barını/footer'ını taşır (global krom Header.tsx listesinde gizli).
// ⚠️ İddia disiplini (v6.8): görünür metin + metadata aynı kurala tabi — ölçülmemiş süre/oran
// iddiası YOK ("iki dakika" bilinçli atıldı), "doğrulanmış" = belge incelemesi (akreditasyon değil).
// İç portal /doktor/doctorium AYRI iştir; bu rota yalnız vitrin.
export const metadata: Metadata = {
  title: "Doctorium", // kök layout template'i "%s · AURA" ekler — ELLE " · AURA" YAZMA (v6.43 dersi)
  description:
    "Hekimler için tek çalışma alanı: branşa göre hakemli yayın takibi, sektörel gündem, sağlık hukuku arşivi, kongre takvimi ve kariyer kaynakları. Doğrulanmış hekim ve tıp öğrencisi üyeliği.",
  alternates: { canonical: "/doctorium" },
  openGraph: {
    type: "website",
    url: "/doctorium",
    siteName: "AURA",
    title: "Doctorium by AURA",
    description:
      "Hekimin çalışma alanı: hakemli yayınlar, sektörel gündem, sağlık hukuku, kongre ve kariyer — tek akışta.",
    locale: "tr_TR",
  },
  twitter: {
    card: "summary",
    title: "Doctorium by AURA",
    description: "Hekimin çalışma alanı: hakemli yayınlar, sektörel gündem, sağlık hukuku, kongre ve kariyer.",
  },
};

export default function DoctoriumLandingPage() {
  return <DoctoriumLanding />;
}
