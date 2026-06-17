import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { CaseQueue, type CaseRow } from "@/components/CaseQueue";
import { Stethoscope, ArrowRight } from "lucide-react";

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

  // İkinci Görüş — doktora atanmış, görüş bekleyen (ASSIGNED) sayısı
  const user = await getCurrentUser();
  let soCount = 0;
  if (user?.role === "DOCTOR") {
    const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
    if (me?.doctorId) soCount = await db.secondOpinionCase.count({ where: { assignedDoctorId: me.doctorId, status: "ASSIGNED" } });
  } else if (user) {
    soCount = await db.secondOpinionCase.count({ where: { status: "ASSIGNED" } });
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#101010]">Doktor Paneli · Vaka Kuyruğu</h1>
          <p className="mt-1 text-sm text-slate-500">Aciliyet sırasına göre, triyajdan geçmiş hazır vaka kartları.</p>
        </div>
      </div>

      <Link href="/doktor/ikinci-gorus" className="mt-6 flex items-center gap-3 rounded-3xl border border-[#14C3D0]/30 bg-[#14C3D0]/[0.06] p-4 transition hover:bg-[#14C3D0]/[0.1]">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#14C3D0] text-[#101010]"><Stethoscope size={18} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[#101010]">İkinci Görüş — Atanan Vakalar</div>
          <p className="text-xs text-slate-500">Dosya inceleme + ek tetkik talebi + yazılı görüş</p>
        </div>
        {soCount > 0 && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">{soCount} görüş bekliyor</span>}
        <ArrowRight size={16} className="shrink-0 text-[#0E8A95]" />
      </Link>

      <div className="mt-7">
        <CaseQueue rows={rows} />
      </div>
    </div>
  );
}
