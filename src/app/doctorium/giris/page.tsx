import { Suspense } from "react";
import type { Metadata } from "next";
import { DoctoriumGate } from "@/components/aura/auth-gates";
import { LandingFooterV3 } from "@/components/aura/doctorium-v3/Footer";

// Doctorium giriş kapısı (2026-08-16, kullanıcı onaylı tasarım) — /kurumsal-giris
// panelinin Doctorium alt-marka uyarlaması: zümrüt dönen AuraMark + Doctorium
// lockup başlığı + iki rol (Doktor / Tıp Öğrencisi) + Google/Apple/e-posta girişi.
// Landing (/doctorium) üst bandındaki "Giriş yap" buraya gelir. Kapı sözleşmesi
// gereği noindex (giriş kapıları arama sonuçlarından ayrık — vitrindeki karar).
// Tek dil TR (landing kararıyla tutarlı).
export const metadata: Metadata = {
  // Segment şablonu "%s · Doctorium" ekler (ayrışma 2026-08-24) → marka tekrarı yazılmaz.
  title: "Giriş",
  description: "Doğrulanmış doktor ve tıp öğrencileri için Doctorium çalışma alanı girişi.",
  robots: { index: false, follow: false },
};

export default function DoctoriumGatePage() {
  // useSearchParams (kapıdaki ?next/?oauth iletimi) Suspense sınırı ister.
  // Footer Suspense'in DIŞINDA: kapı verisi beklerken de alt bilgi çizilir (2026-08-18 —
  // bu sayfa Doctorium'un footer'ı hiç olmayan tek yüzeyiydi).
  // v3 hizalama (2026-08-26): kapı açık yüzeye döndü — fallback da aura-light (koyu flash
  // olmasın), alt bilgi v3 landing footer'ı (açık; koyu DoctoriumFooter v2 arşiv + portalda sürer).
  return (
    <>
      <Suspense fallback={<div className="aura-page aura-light min-h-dvh" aria-hidden />}>
        <DoctoriumGate />
      </Suspense>
      <LandingFooterV3 />
    </>
  );
}
