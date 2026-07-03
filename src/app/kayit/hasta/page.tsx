import { Suspense } from "react";
import { isGoogleConfigured } from "@/lib/oauth";
import { PatientSignupForm } from "@/components/PatientSignupForm";

export const dynamic = "force-dynamic";

// Hasta üyeliği (sign up). Public (proxy matcher dışı). Hesap oluşturulunca /onam (KVKK) →
// hasta ana akışı. Doktor kaydı /kayit'ta ayrıdır.
export default function PatientSignupPage() {
  return (
    <div className="grid min-h-[calc(100vh-8rem)] place-items-center px-5 py-10">
      <Suspense fallback={<div className="text-sm text-slate-400">Yükleniyor…</div>}>
        <PatientSignupForm googleEnabled={isGoogleConfigured()} />
      </Suspense>
    </div>
  );
}
