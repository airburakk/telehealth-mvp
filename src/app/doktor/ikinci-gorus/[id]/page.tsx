import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { BRANCHES } from "@/lib/triage";
import { ArrowLeft } from "lucide-react";
import { SoOpinionPanel } from "./SoOpinionPanel";

export const dynamic = "force-dynamic";

// İkinci Görüş — doktor inceleme + görüş sayfası.
export default async function DoctorSoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/giris?next=/doktor/ikinci-gorus/${id}`);
  if (!["DOCTOR", "ADMIN"].includes(user.role)) redirect("/");

  const c = await db.secondOpinionCase.findUnique({
    where: { id },
    include: {
      documents: { select: { id: true, type: true, deliveryMethod: true, externalRef: true, label: true }, orderBy: { uploadedAt: "asc" } },
      requests: { orderBy: { createdAt: "desc" } },
      opinion: { select: { content: true, structured: true, submittedAt: true } },
    },
  });
  if (!c) notFound();

  // §8: doktor yalnız kendisine atanmış vakayı görür
  if (user.role === "DOCTOR") {
    const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
    if (!me?.doctorId || me.doctorId !== c.assignedDoctorId) redirect("/doktor/ikinci-gorus");
  }

  const branchLabel = BRANCHES.find((b) => b.key === c.branch)?.label ?? c.branch;
  const patient = await db.user.findUnique({ where: { id: c.patientId }, select: { name: true } });

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <Link href="/doktor/ikinci-gorus" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={15} /> Atanan vakalar
      </Link>
      <SoOpinionPanel
        data={{
          id: c.id,
          status: c.status,
          branch: c.branch,
          branchLabel,
          diagnosisSummary: c.diagnosisSummary,
          patientName: patient?.name ?? "Hasta",
          documents: c.documents,
          requests: c.requests.map((r) => ({ id: r.id, type: r.type, description: r.description, status: r.status })),
          opinion: c.opinion
            ? { content: c.opinion.content, structured: c.opinion.structured, submittedAt: c.opinion.submittedAt.toISOString() }
            : null,
        }}
      />
    </div>
  );
}
