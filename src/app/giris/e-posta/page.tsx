import { Suspense } from "react";
import { isGoogleConfigured } from "@/lib/oauth";
import { PatientLoginForm } from "@/components/PatientLoginForm";

export const dynamic = "force-dynamic";

// Hasta e-posta girişi — /giris vitrin kapısının "E-posta ile devam" hedefi
// (kapı/form ayrımı 2026-07-12; önceden bu form /giris'in kendisiydi).
// Kurumsal roller (Doktor/Koordinatör/Etik Kurul/Partner) → /kurumsal-giris/e-posta.
// Girişten sonra hasta doğrudan Branş Doktoru akışına iner (/basla 4'lü seçimi kaldırıldı, 2026-07-12).
export default function PatientEmailLoginPage() {
  return (
    <div className="bg-[#0D0E10]">
      <div className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-sm flex-col justify-center px-5 py-10">
        <Suspense fallback={<div className="text-center text-sm text-white/40">Yükleniyor…</div>}>
          <PatientLoginForm googleEnabled={isGoogleConfigured()} />
        </Suspense>
      </div>
    </div>
  );
}
