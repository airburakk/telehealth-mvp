import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { decryptField } from "@/lib/crypto";
import { getCurrentUser } from "@/lib/auth";
import { canSoCaseBeAccessedBy } from "@/lib/ownership";
import { BRANCHES } from "@/lib/triage";
import { avatarVariant, isFemaleName } from "@/lib/doctor-profile";
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
      opinion: { select: { content: true, submittedAt: true } },
      appointment: { select: { id: true, scheduledAt: true, status: true } },
    },
  });
  if (!c) notFound();
  if (!(await canSoCaseBeAccessedBy(user, c))) redirect("/");

  const branchLabel = BRANCHES.find((b) => b.key === c.branch)?.label ?? c.branch;

  // Atanan uzman doktor — hastaya kimlik kartı (Faz A3). Avatar değerleri sunucuda türetilir
  // (DoctorArt deterministik: isimden cinsiyet + varyant) → client'a düz değer geçer.
  const doc = c.assignedDoctorId
    ? await db.doctor.findUnique({ where: { id: c.assignedDoctorId }, select: { name: true, title: true, branch: true, photo: true, verified: true } })
    : null;
  const assignedDoctor = doc
    ? {
        name: doc.name,
        title: doc.title,
        branchLabel: BRANCHES.find((b) => b.key === doc.branch)?.label ?? doc.branch,
        avatarI: avatarVariant(doc.name),
        female: isFemaleName(doc.name),
        photo: doc.photo,
        verified: doc.verified, // rozet gerçek Doctor.verified değerine bağlı (koşulsuz beyan yok)
      }
    : null;

  return (
    <SoCaseDetail
      data={{
        id: c.id,
        status: c.status,
        branch: c.branch,
        branchLabel,
        diagnosisSummary: c.diagnosisSummary,
        country: c.country,
        language: c.language,
        createdAt: c.createdAt.toISOString(),
        documents: c.documents,
        payment: c.payment,
        requests: c.requests,
        opinion: c.opinion ? { content: decryptField(c.opinion.content), submittedAt: c.opinion.submittedAt.toISOString() } : null,
        appointment: c.appointment ? { id: c.appointment.id, scheduledAt: c.appointment.scheduledAt.toISOString(), status: c.appointment.status } : null,
        readyAt: c.readyAt ? c.readyAt.toISOString() : null,
        assignedDoctor,
      }}
    />
  );
}
