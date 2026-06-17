import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ownsSecondOpinionCase } from "@/lib/ownership";
import { BRANCHES } from "@/lib/triage";
import { SoCaseDetail } from "./SoCaseDetail";

export const dynamic = "force-dynamic";

// İkinci görüş vaka hub'ı — durum-güdümlü. Hasta belgeleri yükler, öder, sürecin neresinde
// olduğunu görür. base64 fileRef İSTEMCİYE GÖNDERİLMEZ (yalnız meta).
export default async function SoCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/giris?next=/second-opinion/vaka/${id}`);

  const c = await db.secondOpinionCase.findUnique({
    where: { id },
    include: {
      documents: {
        select: { id: true, type: true, deliveryMethod: true, externalRef: true, label: true },
        orderBy: { uploadedAt: "asc" },
      },
      payment: { select: { status: true, amount: true, currency: true } },
      requests: { orderBy: { createdAt: "desc" }, select: { id: true, type: true, description: true, status: true } },
      opinion: { select: { id: true, submittedAt: true } },
      appointment: { select: { scheduledAt: true, status: true } },
    },
  });
  if (!c) notFound();
  if (!ownsSecondOpinionCase(user, c)) redirect("/");

  const branchLabel = BRANCHES.find((b) => b.key === c.branch)?.label ?? c.branch;

  return (
    <SoCaseDetail
      data={{
        id: c.id,
        status: c.status,
        branch: c.branch,
        branchLabel,
        diagnosisSummary: c.diagnosisSummary,
        createdAt: c.createdAt.toISOString(),
        documents: c.documents,
        payment: c.payment,
        requests: c.requests,
        hasOpinion: !!c.opinion,
        appointment: c.appointment ? { scheduledAt: c.appointment.scheduledAt.toISOString(), status: c.appointment.status } : null,
      }}
    />
  );
}
