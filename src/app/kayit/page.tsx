import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { isGoogleConfigured, isAppleConfigured } from "@/lib/oauth";
import { BRANCH_LABELS } from "@/lib/procedures";
import { DoctorSignupForm } from "@/components/DoctorSignupForm";

export const dynamic = "force-dynamic";

// M5 — Doktor kayıt (sign up). Public (proxy matcher dışı). Hesap oluşturulunca /onam → /doktor →
// onboarding kapısı. İKİ AŞAMALI üyelik (v6.124): Aşama 1 = e-Devlet barkodlu diploma
// (doğrulanınca diplomaVerifiedAt) → Doctorium; Aşama 2 = klinik tanımlar (FHIR uzmanlık + işlem;
// diploma TEKRAR İSTENMEZ; MMSS v6.105'ten beri İHTİYARİ — lib/doctor-activation) → doktor
// havuzları. Hesap admin onayına kadar doğrulanmamış
// (public dizin/eşleştirme kapalı). Ayrıntılı anlatım: /kayit/asamalar.
export default function SignupPage() {
  const branches = Object.values(BRANCH_LABELS).sort((a, b) => a.localeCompare(b, "tr"));
  return (
    <div className="grid min-h-[calc(100vh-8rem)] place-items-center bg-[var(--c-bg)] px-5 py-10">
      <div className="w-full max-w-md">
        {/* Suspense YOK (2026-08-28 denetimi): sayfa zaten force-dynamic — statik prerender hiç
            denenmeyeceğinden useSearchParams() Suspense'e ihtiyaç duymaz. Suspense varken React'in
            streaming DOM-taşıma mekanizması (rAF tabanlı $RC/$RV) headless/arka-plan sekmelerde
            hiç tetiklenmiyordu → form kalıcı "Yükleniyor…" fallback'inde takılı kalıyordu
            (doğrulama: sekme document.hidden=true iken rAF 1500ms'de hiç ateşlenmedi). */}
        <DoctorSignupForm googleEnabled={isGoogleConfigured()} appleEnabled={isAppleConfigured()} branches={branches} />

        {/* İki aşamalı üyelik özeti (v6.87) — ayrıntı /kayit/asamalar */}
        <div className="mt-6 rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-5">
          <div className="text-sm font-semibold text-[var(--c-ink)]">İki aşamalı üyelik</div>
          <ol className="mt-2 space-y-2 text-xs text-[var(--c-ink-2)]">
            <li>
              <strong className="text-[var(--c-ink)]">1 · Doctorium</strong> — e-Devlet barkodlu
              mezun belgenizle doktor kimliğinizi doğrulayın; Doctorium&apos;daki tüm içerik ve
              ücretsiz araçlara erişin.
            </li>
            <li>
              <strong className="text-[var(--c-ink)]">2 · Klinik Havuz</strong> — Diploma ve işlem
              tanımlarınızı tamamlayın; uzaktan sağlık, ikinci görüş ve sağlık turizmi doktor
              havuzlarına katılın. MMSS poliçesi isteğe bağlıdır.
            </li>
          </ol>
          <Link href="/kayit/asamalar" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[var(--c-accent-stronger)] hover:underline">
            Ayrıntılı bilgi <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </div>
  );
}
