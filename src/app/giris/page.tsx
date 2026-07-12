import { Suspense } from "react";
import type { Metadata } from "next";
import { SigninGate } from "@/components/aura/auth-gates";

// Hasta giriş kapısı — vitrin "AURA Sign Up" panelinin birebir inşası
// (aura-health.higgsfield.app'ten taşındı, 2026-07-12; kullanıcı kararı
// "birebir kapı + ayrı form"). Google doğrudan OAuth'a; Apple/E-posta çalışan
// forma (/giris/e-posta) götürür. Proxy kimliksizi ?next ile buraya düşürür —
// kapı parametreyi forma iletir. Header/SiteFooter bu rotada gizli (landing
// deseni); panel kendi logo + "← ana sayfa" bağlantısını taşır.
export const metadata: Metadata = {
  title: "AURA · Sign in",
  description: "Sign in to AURA and start your care journey.",
};

export default function LoginGatePage() {
  // useSearchParams (kapıdaki ?next iletimi) Suspense sınırı ister.
  return (
    <Suspense
      fallback={<div className="aura-page min-h-dvh" aria-hidden />}
    >
      <SigninGate />
    </Suspense>
  );
}
