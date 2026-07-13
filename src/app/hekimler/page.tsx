import { db } from "@/lib/db";
import { DoctorDirectory, type DoctorRow } from "@/components/DoctorDirectory";
import { Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DoctorsPage() {
  // Yalnız doğrulanmış doktorlar dizinde görünür (self-signup → admin/etik kurul onayına kadar gizli).
  // rating null olabilir (yeni self-signup) → nulls last ile puanlılar önde kalır.
  const doctors = await db.doctor.findMany({
    where: { verified: true },
    orderBy: [{ rating: { sort: "desc", nulls: "last" } }],
    include: { _count: { select: { reviews: true } } }, // gerçek DB yorum sayısı (üretilmiş sahte sayı DEĞİL)
  });

  const rows: DoctorRow[] = doctors.map((d) => ({
    id: d.id,
    name: d.name,
    title: d.title,
    branch: d.branch,
    city: d.city,
    languages: d.languages,
    rating: d.rating,
    experienceYears: d.experienceYears,
    successRate: d.successRate,
    verified: d.verified,
    color: d.color,
    reviews: d._count.reviews,
    photo: d.photo,
  }));

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-[var(--c-bg)]">
    <div className="mx-auto max-w-4xl px-5 py-10">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--c-accent)] text-[var(--c-bg)]"><Users size={22} /></span>
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-[var(--c-ink)]">Doktorlarımız</h1>
          <p className="text-sm text-[var(--c-ink-2)]">Doğrulanmış, deneyimli uzmanlar — branşa göre filtreleyin.</p>
        </div>
      </div>
      <div className="mt-7">
        <DoctorDirectory doctors={rows} />
      </div>
    </div>
    </div>
  );
}
