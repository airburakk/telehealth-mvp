import { Suspense } from "react";
import { isGoogleConfigured } from "@/lib/oauth";
import { BRANCH_LABELS } from "@/lib/procedures";
import { LANGUAGES } from "@/lib/constants";
import { DoctorSignupForm } from "@/components/DoctorSignupForm";

export const dynamic = "force-dynamic";

// M5 — Doktor kayıt (sign up). Public (proxy matcher dışı). Hesap oluşturulunca /onam → /doktor →
// onboarding kapısı (FHIR uzmanlık + işlem + diploma + MMSS). Hesap admin onayına kadar
// doğrulanmamış (public dizin/eşleştirme kapalı).
export default function SignupPage() {
  const branches = Object.values(BRANCH_LABELS).sort((a, b) => a.localeCompare(b, "tr"));
  return (
    <div className="grid min-h-[calc(100vh-8rem)] place-items-center bg-[#0D0E10] px-5 py-10">
      <Suspense fallback={<div className="text-sm text-white/40">Yükleniyor…</div>}>
        <DoctorSignupForm googleEnabled={isGoogleConfigured()} branches={branches} languages={[...LANGUAGES]} />
      </Suspense>
    </div>
  );
}
