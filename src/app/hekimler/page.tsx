import { db } from "@/lib/db";
import { DoctorDirectory, type DoctorRow } from "@/components/DoctorDirectory";
import { generatedReviews } from "@/lib/doctor-profile";
import { Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DoctorsPage() {
  const doctors = await db.doctor.findMany({
    orderBy: [{ rating: "desc" }],
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
    reviews: generatedReviews(d).length,
    photo: d.photo,
  }));

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#14C3D0] text-[#101010]"><Users size={22} /></span>
        <div>
          <h1 className="text-2xl font-bold text-[#101010]">Hekimlerimiz</h1>
          <p className="text-sm text-slate-500">Doğrulanmış, deneyimli uzmanlar — branşa göre filtreleyin.</p>
        </div>
      </div>
      <div className="mt-7">
        <DoctorDirectory doctors={rows} />
      </div>
    </div>
  );
}
