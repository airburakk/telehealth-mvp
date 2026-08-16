import { Suspense } from "react";
import type { Metadata } from "next";
import { DoctoriumGate } from "@/components/aura/auth-gates";

// Doctorium giriş kapısı (2026-08-16, kullanıcı onaylı tasarım) — /kurumsal-giris
// panelinin Doctorium alt-marka uyarlaması: zümrüt dönen AuraMark + Doctorium
// lockup başlığı + iki rol (Doktor / Tıp Öğrencisi) + Google/Apple/e-posta girişi.
// Landing (/doctorium) üst bandındaki "Giriş yap" buraya gelir. Kapı sözleşmesi
// gereği noindex (giriş kapıları arama sonuçlarından ayrık — vitrindeki karar).
// Tek dil TR (landing kararıyla tutarlı).
export const metadata: Metadata = {
  // Kök layout şablonu "· AURA" ekler → marka tekrarı yazılmaz (Ray D title-çifti düzeltmesi).
  title: "Doctorium giriş",
  description: "Doğrulanmış doktor ve tıp öğrencileri için Doctorium çalışma alanı girişi.",
  robots: { index: false, follow: false },
};

export default function DoctoriumGatePage() {
  // useSearchParams (kapıdaki ?next/?oauth iletimi) Suspense sınırı ister.
  return (
    <Suspense fallback={<div className="aura-page min-h-dvh" aria-hidden />}>
      <DoctoriumGate />
    </Suspense>
  );
}
