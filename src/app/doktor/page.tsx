import { db } from "@/lib/db";
import { CaseQueue, type CaseRow } from "@/components/CaseQueue";

export const dynamic = "force-dynamic";

export default async function DoctorPanel() {
  const cases = await db.case.findMany({
    include: { doctor: true },
    orderBy: [{ urgency: "desc" }, { createdAt: "desc" }],
  });

  const rows: CaseRow[] = cases.map((c) => ({
    id: c.id,
    patientName: c.patientName,
    country: c.country,
    language: c.language,
    branch: c.branch,
    urgency: c.urgency,
    status: c.status,
    createdAt: c.createdAt.toISOString(),
    doctorName: c.doctor ? `${c.doctor.title} ${c.doctor.name}` : null,
    hasFiles: !!c.attachments,
  }));

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#101010]">Doktor Paneli · Vaka Kuyruğu</h1>
          <p className="mt-1 text-sm text-slate-500">Aciliyet sırasına göre, triyajdan geçmiş hazır vaka kartları.</p>
        </div>
      </div>
      <div className="mt-7">
        <CaseQueue rows={rows} />
      </div>
    </div>
  );
}
