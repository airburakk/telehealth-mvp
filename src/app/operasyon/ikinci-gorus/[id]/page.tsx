import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { BRANCHES } from "@/lib/triage";
import { ArrowLeft } from "lucide-react";
import { SoReviewPanel } from "./SoReviewPanel";

export const dynamic = "force-dynamic";

// İkinci Görüş — koordinatör inceleme/atama detayı.
export default async function SoReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/giris?next=/operasyon/ikinci-gorus/${id}`);
  if (!["COORDINATOR", "ADMIN"].includes(user.role)) redirect("/");

  const c = await db.secondOpinionCase.findUnique({
    where: { id },
    include: {
      documents: { select: { id: true, type: true, deliveryMethod: true, externalRef: true, label: true }, orderBy: { uploadedAt: "asc" } },
      requests: { orderBy: { createdAt: "desc" } },
      payment: { select: { status: true, amount: true, currency: true } },
      appointment: { select: { id: true, scheduledAt: true, status: true } },
    },
  });
  if (!c) notFound();

  const branchLabel = BRANCHES.find((b) => b.key === c.branch)?.label ?? c.branch;
  const patient = await db.user.findUnique({ where: { id: c.patientId }, select: { name: true } });

  // Branş-eşleşmeli doktorlar (Doctor.branch = etiket); yoksa genel havuz.
  let doctors = await db.doctor.findMany({ where: { branch: branchLabel }, select: { id: true, name: true, title: true, branch: true }, orderBy: { rating: "desc" } });
  if (doctors.length === 0) {
    doctors = await db.doctor.findMany({ select: { id: true, name: true, title: true, branch: true }, orderBy: { rating: "desc" }, take: 20 });
  }
  const assignedDoctor = c.assignedDoctorId
    ? await db.doctor.findUnique({ where: { id: c.assignedDoctorId }, select: { name: true, title: true } })
    : null;

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <Link href="/operasyon/ikinci-gorus" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={15} /> Kuyruk
      </Link>
      <SoReviewPanel
        data={{
          id: c.id,
          status: c.status,
          branch: c.branch,
          branchLabel,
          diagnosisSummary: c.diagnosisSummary,
          patientName: patient?.name ?? "Hasta",
          createdAt: c.createdAt.toISOString(),
          documents: c.documents,
          requests: c.requests.map((r) => ({ id: r.id, type: r.type, description: r.description, status: r.status })),
          payment: c.payment,
          appointment: c.appointment ? { id: c.appointment.id, scheduledAt: c.appointment.scheduledAt.toISOString(), status: c.appointment.status } : null,
          assignedDoctorName: assignedDoctor ? `${assignedDoctor.title} ${assignedDoctor.name}` : null,
        }}
        doctors={doctors}
      />
    </div>
  );
}
