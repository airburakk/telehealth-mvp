import { isGoogleConfigured, isAppleConfigured } from "@/lib/oauth";
import { PatientSignupForm } from "@/components/PatientSignupForm";

export const dynamic = "force-dynamic";

// Hasta üyeliği (sign up). Public (proxy matcher dışı). Hesap oluşturulunca /onam (KVKK) →
// hasta ana akışı. Doktor kaydı /kayit'ta ayrıdır.
// Suspense YOK (2026-08-28 denetimi): sayfa zaten force-dynamic — statik prerender hiç
// denenmeyeceğinden PatientSignupForm'un useSearchParams() kullanımı Suspense'e ihtiyaç duymaz.
// Suspense varken React'in streaming DOM-taşıma mekanizması (rAF tabanlı $RC/$RV) headless/
// arka-plan sekmelerde hiç tetiklenmiyordu → form kalıcı "Yükleniyor…" fallback'inde takılı
// kalıyordu (bkz. src/app/kayit/page.tsx aynı not).
export default function PatientSignupPage() {
  return (
    <div className="grid min-h-[calc(100vh-8rem)] place-items-center bg-[var(--c-bg)] px-5 py-10">
      <PatientSignupForm googleEnabled={isGoogleConfigured()} appleEnabled={isAppleConfigured()} />
    </div>
  );
}
