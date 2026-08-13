import type { Metadata } from "next";
import { STAFF_ROLE_CONFIGS } from "@/lib/staff-application-config";
import { StaffSignupForm } from "@/components/StaffSignupForm";

export const metadata: Metadata = { title: "Sağlık Uzmanı Başvurusu" };

// Kurumsal üyelik — Sağlık Uzmanı (doktor-dışı sağlık profesyoneli) self-signup (2026-08-12).
// Bu rolün KLİNİK YETKİSİ YOK (kullanıcı kararı) — onay sonrası /uzman başlangıç paneline iner.
export default function HealthProSignupPage() {
  return (
    <div className="grid min-h-[calc(100vh-8rem)] place-items-center bg-[var(--c-bg)] px-5 py-10">
      <div className="w-full max-w-md">
        <StaffSignupForm config={STAFF_ROLE_CONFIGS.HEALTH_PRO} />
      </div>
    </div>
  );
}
