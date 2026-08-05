import { Suspense } from "react";
import { isGoogleConfigured, isAppleConfigured } from "@/lib/oauth";
import { PatientSignupForm } from "@/components/PatientSignupForm";

export const dynamic = "force-dynamic";

// Hasta üyeliği (sign up). Public (proxy matcher dışı). Hesap oluşturulunca /onam (KVKK) →
// hasta ana akışı. Doktor kaydı /kayit'ta ayrıdır.
export default function PatientSignupPage() {
  return (
    <div className="grid min-h-[calc(100vh-8rem)] place-items-center bg-[var(--c-bg)] px-5 py-10">
      <Suspense fallback={<div className="text-sm text-[var(--c-ink-3)]">Yükleniyor…</div>}>
        <PatientSignupForm googleEnabled={isGoogleConfigured()} appleEnabled={isAppleConfigured()} />
      </Suspense>
    </div>
  );
}
