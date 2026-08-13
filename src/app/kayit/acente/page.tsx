import type { Metadata } from "next";
import { STAFF_ROLE_CONFIGS } from "@/lib/staff-application-config";
import { StaffSignupForm } from "@/components/StaffSignupForm";

export const metadata: Metadata = { title: "Sağlık Turizmi Acentesi Başvurusu" };

// Kurumsal üyelik — Sağlık Turizmi Acentesi self-signup (2026-08-12). Public (proxy matcher dışı).
// Acente paneli hasta kimliği görür → onay çıtası yüksek: belge (TÜRSAB/yetki) + insan onayı şart.
export default function AgencySignupPage() {
  return (
    <div className="grid min-h-[calc(100vh-8rem)] place-items-center bg-[var(--c-bg)] px-5 py-10">
      <div className="w-full max-w-md">
        <StaffSignupForm config={STAFF_ROLE_CONFIGS.AGENCY} />
      </div>
    </div>
  );
}
