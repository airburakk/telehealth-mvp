import { Suspense } from "react";
import type { Metadata } from "next";
import { SigninGate } from "@/components/aura/auth-gates";

export const dynamic = "force-dynamic";

// Hasta giriş kapısı — vitrin "AURA Sign Up" panelinin birebir inşası
// (aura-health.higgsfield.app'ten taşındı, 2026-07-12). Kapı-içi form
// (2026-08-06): Google/Apple doğrudan OAuth başlatır; e-posta formu kapının
// içinde açılır (/giris/e-posta kaldırıldı → kalıcı yönlendirme). Proxy
// kimliksizi ?next ile buraya düşürür; OAuth/verify dönüşleri formu otomatik
// açar. Header/SiteFooter bu rotada gizli (landing deseni); panel kendi
// logo + "← ana sayfa" bağlantısını taşır.
export const metadata: Metadata = {
  // Kök layout şablonu "· AURA" ekler → burada marka tekrar yazılmaz
  // (eski "AURA · Sign in" sekmede "AURA · Sign in · AURA" çiftlenmesi üretiyordu — Ray D).
  title: "Sign in",
  description: "Sign in to AURA and start your care journey.",
};

export default function LoginGatePage() {
  // useSearchParams (kapıdaki ?next iletimi) Suspense sınırı ister. Sayfa force-dynamic
  // OLMALI (2026-08-28 denetimi): kök layout artık cookies() çağırmadığından (P0-3) bu
  // sayfa üst katmandan dolaylı dynamic olmuyordu — statik prerender'da useSearchParams()
  // hiç resolve olmadığından Suspense kalıcı olarak boş fallback'te takılı kalıyordu
  // (raw HTML'de H1/CTA hiç yoktu; sentetik kontrol bunu yakaladı).
  return (
    <Suspense
      fallback={<div className="aura-page min-h-dvh" aria-hidden />}
    >
      <SigninGate />
    </Suspense>
  );
}
