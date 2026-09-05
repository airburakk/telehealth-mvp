import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { DoctoriumShell } from "../DoctoriumSidebar";
import { PageHeader } from "@/components/ui/PageHeader";
import { KARIYER_HREF, TusOfficialLinksPanel, TusPeriodsPanel } from "../CareerEduSections";

export const dynamic = "force-dynamic";
export const metadata = { title: "TUS" };

/**
 * TUS — Tıpta Uzmanlık Sınavı AYRINTI sayfası (üç katman Faz B1 → B3, kullanıcı kararı 2026-09-05; rapor §3). Raf durağı
 * DEĞİL: bölüm Kariyer sekmesinin içinde yaşar (öğrencide StudentCareerHub, doktorda Özelleştir anahtarıyla
 * DoctorTusSection); bu sayfa oradan "Ayrıntı" bağlantısıyla açılır, rafta Kariyer aktif kalır. Doğrudan URL herkese
 * serbest ("kapalı, gizli değil"; kapı segment layout'unun Doctorium kapısıdır).
 *
 * DÜRÜST İSKELET: veri hattı (ÖSYM açık verisi → doğrulama → dönem-bazlı snapshot → grafikler, simülatör) AYRI plandadır.
 * Paneller CareerEduSections'ta hub ile PAYLAŞILIR — grafik / temsilî sayı / uydurma tarih YOK.
 */
export default async function TusPage() {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "COORDINATOR", "ADMIN"].includes(user.role)) redirect("/");

  return (
    <DoctoriumShell active="kariyer">
      <div className="mx-auto max-w-3xl px-5 py-8">
        <Link href={KARIYER_HREF} className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-ink)]">
          <ArrowLeft size={15} /> Kariyer
        </Link>

        <PageHeader
          className="mt-5"
          eyebrow="KARİYER · TUS"
          title="Tıpta Uzmanlık Sınavı"
          sub="Kamuya açık ÖSYM verisinin (sınav takvimi, kontenjanlar, taban puanlar, boş kalan kontenjanlar) tek yerden okunabilir hâli. Veri yayına alınmadan önce kaynak ve tarihle doğrulanır."
        />

        <TusOfficialLinksPanel className="mt-6" />
        <TusPeriodsPanel className="mt-6" />
      </div>
    </DoctoriumShell>
  );
}
