import type { Metadata } from "next";
import { BRANCH_LABELS } from "@/lib/procedures";
import { StudentGateForm } from "@/components/StudentGateForm";
import { DoctoriumSignupShell } from "@/components/aura/doctorium-signup-shell";
import { StudentScopeCard } from "@/components/aura/student-scope-card";

export const dynamic = "force-dynamic";

// Doctorium tıp öğrencisi kaydı (ayrışma Faz B, 2026-08-24) — landing'in öğrenci yolunun
// hedefi. AURA kromlu /ogrenci'nin Doctorium sarmalayıcısı: AYNI form + AYNI signup-student
// akışı (v6.147 üniversite e-postası doğrulaması), yalnız görünüm Doctorium. Kapsam kutusu
// ortak bileşen (StudentScopeCard) — iki sayfada kopya kutu drift üretirdi.
// noindex: /ogrenci ile aynı karar (üyelik kapıları arama sonuçlarından ayrık).
export const metadata: Metadata = {
  title: "Tıp Öğrencisi Kaydı",
  description: "Tıp öğrencileri için Doctorium üyeliği — kayıt.",
  robots: { index: false, follow: false },
};

export default function DoctoriumStudentPage() {
  const branches = Object.values(BRANCH_LABELS).sort((a, b) => a.localeCompare(b, "tr"));
  return (
    <DoctoriumSignupShell>
      <StudentGateForm branches={branches} brand="doctorium" />
      <StudentScopeCard />
    </DoctoriumSignupShell>
  );
}
