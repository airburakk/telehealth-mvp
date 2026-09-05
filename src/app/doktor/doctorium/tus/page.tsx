import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { DoctoriumShell } from "../DoctoriumSidebar";
import { PageHeader } from "@/components/ui/PageHeader";
import { KARIYER_HREF, TusOfficialLinksPanel, TusPeriodsPanel, TusPlacementSection } from "../CareerEduSections";

export const dynamic = "force-dynamic";
export const metadata = { title: "TUS" };

/**
 * TUS — Tıpta Uzmanlık Sınavı AYRINTI sayfası (üç katman Faz B1 → B3, kullanıcı kararı 2026-09-05; rapor §3). Raf durağı
 * DEĞİL: bölüm Kariyer sekmesinin içinde yaşar (öğrencide StudentCareerHub, doktorda Özelleştir anahtarıyla
 * DoctorTusSection); bu sayfa oradan "Ayrıntı" bağlantısıyla açılır, rafta Kariyer aktif kalır. Doğrudan URL herkese
 * serbest ("kapalı, gizli değil"; kapı segment layout'unun Doctorium kapısıdır).
 *
 * VERİ (K1, 2026-09-05): ÖSYM "En Küçük ve En Büyük Puanlar" PDF'leri scripts/tus-ingest.ts ile dönem dönem çekilir (src/data/tus),
 * lib/tus-data TUS_SNAPSHOTS'ta 👤 approvedAt dolu dönemler TusPlacementSection'da KPI + Recharts grafikleriyle gösterilir;
 * onaysız dönem görünmez. Paneller CareerEduSections'ta hub ile PAYLAŞILIR — temsilî sayı / uydurma tarih / tahmin YOK.
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

        <TusPlacementSection className="mt-6" />
        <TusOfficialLinksPanel className="mt-6" />
        <TusPeriodsPanel className="mt-6" />
      </div>
    </DoctoriumShell>
  );
}
