import { Suspense } from "react";
import { isGoogleConfigured } from "@/lib/oauth";
import { PatientLoginForm } from "@/components/PatientLoginForm";
import { AuthSteps } from "@/components/AuthSteps";

export const dynamic = "force-dynamic";

// Hasta girişi (Adım 0). Kurumsal roller (Doktor/Koordinatör/Etik Kurul/Partner) → /kurumsal-giris.
// İki-adım çerçeve: giriş → /basla yol seçimi (Adım 1) tek akış gibi hissettirir.
export default function LoginPage() {
  return (
    <div className="bg-[#0D0E10]">
      <div className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-sm flex-col justify-center px-5 py-10">
        <AuthSteps active={0} labels={["Giriş", "Yol seçimi"]} />
        <Suspense fallback={<div className="text-center text-sm text-white/40">Yükleniyor…</div>}>
          <PatientLoginForm googleEnabled={isGoogleConfigured()} />
        </Suspense>
      </div>
    </div>
  );
}
