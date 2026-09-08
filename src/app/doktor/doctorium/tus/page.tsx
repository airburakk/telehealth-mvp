import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { currentDoctoriumAudience } from "@/lib/doctorium-audience";
import { resolveTusSection } from "@/lib/tus";
import { db } from "@/lib/db";
import { parseViewPrefs } from "@/lib/doctorium";
import { DoctoriumShell } from "../DoctoriumSidebar";
import { PageHeader } from "@/components/ui/PageHeader";
import { KARIYER_HREF } from "../CareerEduSections";
import { StudentCareerSubnav, TusSectionNav } from "../CareerSubnav";
import { TusSectionBody } from "../TusSections";

export const dynamic = "force-dynamic";
export const metadata = { title: "TUS" };

/**
 * TUS — Tıpta Uzmanlık Sınavı sayfası (üç katman Faz B1 → B3, kullanıcı kararı 2026-09-05; rapor §3). Raf durağı DEĞİL: bölüm
 * Kariyer sekmesinin içinde yaşar; rafta Kariyer aktif kalır. Doğrudan URL herkese serbest ("kapalı, gizli değil"; kapı segment
 * layout'unun Doctorium kapısıdır).
 *
 * YENİDEN YAPI (2026-09-06, kullanıcı kararı "Kariyer çok karmaşık; Hukuk'taki gibi böl"): öğrencide sayfanın üstünde Kariyer'in
 * 1. kademe çubuğu (Fırsatlar | TUS — TUS aktif; akış sayfasındaki çubukla aynı), doktorda "← Kariyer" kalır. İçerik ÜÇ bölüme
 * ayrıldı (?bolum=, TusSections): Veriler (varsayılan) · Rehberler · Sınav dönemleri — eskiden 7 panel art arda tek istifti.
 *
 * VERİ (K1, 2026-09-05): ÖSYM "En Küçük ve En Büyük Puanlar" PDF'leri scripts/tus-ingest.ts ile dönem dönem çekilir (src/data/tus),
 * lib/tus-data TUS_SNAPSHOTS'ta 👤 approvedAt dolu dönemler TusPlacementSection'da KPI + Recharts grafikleriyle gösterilir;
 * onaysız dönem görünmez. Paneller CareerEduSections'ta hub ile PAYLAŞILIR — temsilî sayı / uydurma tarih / tahmin YOK.
 * K3/K4 (2026-09-05): Rehberler = ÖSYM kılavuzu bölüm özetleri (lib/tus-guides, ayrıntı /tus/rehber/[slug]); Kaynakça + kurs dizini =
 * tarafsız künye (lib/tus-resources; fiyat/puan/öneri yok, alfabetik, #kaynakca). İkisi de 👤 approvedAt ile görünür.
 * K5 (2026-09-05): Tıp fakülteleri = YÖK Atlas Tercih Sihirbazı verisi (lib/yok-data, 👤 approvedAt; scripts/yok-atlas-ingest.ts) — KPI +
 * Recharts (giriş kontenjanı ↔ TUS GENEL kontenjanı, kurum türü, il, başarı sırası) + program tablosu (#yok). Tahmin/tavsiye YOK.
 * K2 (2026-09-06): Kurumlar = branş × dönem kurum tablosu (`TusInstitutionsSection`, süzgeçler URL sorgusunda: brans · donem · tur · kt · q ·
 * sirala; #kurumlar) + son 3 dönem en küçük puan eğilimi + ek yerleştirme sütunu (lib/tus-data TUS_EK_SNAPSHOTS, 👤 approvedAt).
 * 🪤 Süzgeç bileşeni URL'yi sıfırdan kurar (bolum düşer) — Kurumlar VARSAYILAN bölümde (Veriler) olduğu için sorun çıkmaz;
 * Kurumlar başka bölüme taşınırsa TusInstitutionFilters'a bolum korunumu eklenmeli.
 */
export default async function TusPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "COORDINATOR", "ADMIN"].includes(user.role)) redirect("/");
  const sp = await searchParams;
  const ctx = await currentDoctoriumAudience();
  const isStudent = ctx?.audience === "STUDENT";
  // Özelleştir'deki Kariyer açılış tercihleri (öğrenci, 2026-09-06): açılış bölümü + varsayılan branş; URL parametresi ezer. Personelde varsayılan.
  const prefRow = ctx?.doctorId ? await db.doctor.findUnique({ where: { id: ctx.doctorId }, select: { doctoriumViewPrefs: true } }) : null;
  const kariyerPref = parseViewPrefs(prefRow?.doctoriumViewPrefs).kariyer;
  const section = resolveTusSection(typeof sp.bolum === "string" ? sp.bolum : undefined, kariyerPref.tusBolum);

  return (
    <DoctoriumShell active="kariyer">
      <div className="mx-auto max-w-3xl px-5 py-8">
        {isStudent ? (
          <StudentCareerSubnav active="tus" />
        ) : (
          <Link href={KARIYER_HREF} className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-ink)]">
            <ArrowLeft size={15} /> Kariyer
          </Link>
        )}

        <PageHeader
          className="mt-5"
          eyebrow="KARİYER · TUS"
          title="Tıpta Uzmanlık Sınavı"
          sub="Kamuya açık ÖSYM ve YÖK verisinin (sınav takvimi, kontenjanlar, taban puanlar, boş kalan kontenjanlar, tıp fakülteleri) tek yerden okunabilir hâli. Veri yayına alınmadan önce kaynak ve tarihle doğrulanır."
        />

        <TusSectionNav active={section} defaultKey={kariyerPref.tusBolum} />
        <TusSectionBody section={section} sp={sp} tusBrans={kariyerPref.tusBrans} />
      </div>
    </DoctoriumShell>
  );
}
