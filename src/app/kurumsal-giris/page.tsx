import { Suspense } from "react";
import type { Metadata } from "next";
import { CorporateGate } from "@/components/aura/auth-gates";

export const dynamic = "force-dynamic";

// Kurumsal giriş kapısı — vitrin panelinin personel/iş-ortağı uyarlaması
// (aura-health.higgsfield.app'ten taşındı, 2026-07-12): rol seçici (görsel
// bağlam) + Google/Apple doğrudan OAuth (intent=doctor) + kapı-içi e-posta
// formu (2026-08-06 — /kurumsal-giris/e-posta kaldırıldı → kalıcı yönlendirme).
// Landing üst bandındaki "Kurumsal Giriş" butonu buraya gelir. Personel
// kapısı arama sonuçlarından ayrık tutulur (noindex — vitrindeki karar).
export const metadata: Metadata = {
  // Kök layout şablonu "· AURA" ekler → marka tekrarı yazılmaz (Ray D title-çifti düzeltmesi).
  title: "Corporate sign-in",
  description: "Corporate sign-in for verified staff and partners of the AURA platform.",
  robots: { index: false, follow: false },
};

export default function CorporateGatePage() {
  // useSearchParams (kapıdaki ?next iletimi) Suspense sınırı ister. Sayfa force-dynamic
  // OLMALI (2026-08-28 denetimi) — bkz. src/app/giris/page.tsx aynı not.
  return (
    <Suspense
      fallback={<div className="aura-page min-h-dvh" aria-hidden />}
    >
      <CorporateGate />
    </Suspense>
  );
}
