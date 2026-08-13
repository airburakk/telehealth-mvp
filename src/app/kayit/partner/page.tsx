import type { Metadata } from "next";
import { STAFF_ROLE_CONFIGS } from "@/lib/staff-application-config";
import { StaffSignupForm } from "@/components/StaffSignupForm";

export const metadata: Metadata = { title: "Partner Doktor Başvurusu" };

// Kurumsal üyelik — Partner Doktor self-signup (2026-08-12). Public (proxy matcher dışı).
// Akış: başvuru + KVKK → e-posta doğrulama → /onam → /kayit/durum → insan onayı → /partner.
export default function PartnerSignupPage() {
  return (
    <div className="grid min-h-[calc(100vh-8rem)] place-items-center bg-[var(--c-bg)] px-5 py-10">
      <div className="w-full max-w-md">
        <StaffSignupForm config={STAFF_ROLE_CONFIGS.PARTNER} />
      </div>
    </div>
  );
}
