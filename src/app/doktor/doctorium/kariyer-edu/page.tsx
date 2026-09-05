import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { currentDoctoriumAudience } from "@/lib/doctorium-audience";
import { DoctoriumShell } from "../DoctoriumSidebar";
import { PageHeader } from "@/components/ui/PageHeader";
import { EduOpportunitiesPanel, KARIYER_HREF } from "../CareerEduSections";

export const dynamic = "force-dynamic";
export const metadata = { title: "Kariyer EDU" };

/**
 * KARİYER EDU — staj / değişim / burs takvimi AYRINTI sayfası (üç katman Faz B1 → B3, kullanıcı kararı 2026-09-05; rapor
 * §7). Raf durağı DEĞİL: bölüm öğrencinin Kariyer sekmesinin içinde yaşar (StudentCareerHub); bu sayfa oradan "Ayrıntı"
 * bağlantısıyla açılır, rafta Kariyer aktif kalır. YALNIZ öğrenci yüzeyi (audienceFlags.showsStudentSurfaces) — doktor/
 * deneme/personel doğrudan URL ile gelirse Kariyer sekmesine döner. ⚖️ İlan DEĞİL, süreç bilgisi (İŞKUR sınırı).
 *
 * DÜRÜST İSKELET: fırsat verisi elle derlenip (lib/edu-opportunities — boş başlar) kalıcı modele geçecek; panel
 * CareerEduSections'ta hub ile PAYLAŞILIR — grafik/uydurma satır YOK.
 */
export default async function KariyerEduPage() {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "COORDINATOR", "ADMIN"].includes(user.role)) redirect("/");
  const ctx = await currentDoctoriumAudience();
  if (!ctx?.flags.showsStudentSurfaces) redirect(KARIYER_HREF);

  return (
    <DoctoriumShell active="kariyer">
      <div className="mx-auto max-w-3xl px-5 py-8">
        <Link href={KARIYER_HREF} className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-ink)]">
          <ArrowLeft size={15} /> Kariyer
        </Link>

        <PageHeader
          className="mt-5"
          eyebrow="KARİYER · EDU"
          title="Staj, değişim ve burs takvimi"
          sub="Zorunlu stajlar fakültenizde yapılır; buradaki değer isteğe bağlı fırsatlardır: yurt içi ve yurt dışı değişim, gözlemcilik, yaz araştırma programları, burslar. Son başvuru tarihleri ve şart özetleri tek yerde; başvuru daima resmî kaynakta yapılır."
        />

        <EduOpportunitiesPanel className="mt-6" />
      </div>
    </DoctoriumShell>
  );
}
