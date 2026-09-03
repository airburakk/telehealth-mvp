import type { Metadata } from "next";
import { BRANCH_LABELS } from "@/lib/procedures";
import { StudentGateForm } from "@/components/StudentGateForm";
import { StudentScopeCard } from "@/components/aura/student-scope-card";

export const dynamic = "force-dynamic";

// v6.95 — Tıp öğrencisi kaydı: vitrin footer'ından gelinen, doktor kaydından AYRI kayıt sayfası
// (kullanıcı kararı 2026-08-14; 2026-08-17'de SALT KAYIT — gömülü giriş formu kaldırıldı, giriş
// /kurumsal-giris'ten). Doktor belgeleri (diploma/MMSS) bu hunide HİÇ görünmez; tek
// belge e-Devlet öğrenci belgesidir (onboarding öğrenci modu).
// noindex: personel/üyelik kapıları arama sonuçlarından ayrık tutulur (kurumsal-giris kararıyla
// tutarlı); indekslemeye açmak ayrı kullanıcı kararı.
export const metadata: Metadata = {
  // Kök layout şablonu "· AURA" ekler → marka tekrarı yazılmaz.
  title: "Tıp Öğrencisi Kaydı",
  description: "Tıp öğrencileri için Doctorium üyeliği — kayıt.",
  robots: { index: false, follow: false },
};

export default function StudentGatePage() {
  const branches = Object.values(BRANCH_LABELS).sort((a, b) => a.localeCompare(b, "tr"));
  return (
    <div className="grid min-h-[calc(100vh-8rem)] place-items-center bg-[var(--c-bg)] px-5 py-10">
      <div className="w-full max-w-md">
        <StudentGateForm branches={branches} />

        {/* Kapsam kutusu ORTAK bileşende (2026-08-24: /doctorium/ogrenci ile paylaşılır —
            kopya kutu drift üretirdi; dürüst-dil sözleşmesi bileşenin başında). */}
        <StudentScopeCard />
      </div>
    </div>
  );
}
