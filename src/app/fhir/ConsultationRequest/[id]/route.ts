import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getRequestWithDocs } from "@/lib/consultation-requests";
import { consultationRequestBundle } from "@/lib/fhir";
import { fhirJson, operationOutcome } from "@/lib/fhir-http";

// GET /fhir/ConsultationRequest/:id — anonim konsültasyon talebini FHIR R4 Bundle olarak verir.
// İçerik: tanı (Condition ICD-10) + belge labları (Observation LOINC) + hekim önerileri
// (lab/görüntüleme ServiceRequest · ilaç MedicationRequest ATC) + uzman görüşü (Composition). Hasta kimliği YOK.
// Erişim: talebi açan Partner doktor · yanıtlayan hekim · ADMIN.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return operationOutcome(401, "login", "Kimlik doğrulama gerekli.");

  const { id } = await params;
  const raw = await db.consultationRequest.findUnique({
    where: { id },
    select: { id: true, requestedByPartnerId: true, answeredByDoctorId: true },
  });
  if (!raw) return operationOutcome(404, "not-found", "Konsültasyon talebi bulunamadı.");

  const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true, partnerId: true } });
  const isOwnerPartner = !!me?.partnerId && raw.requestedByPartnerId === me.partnerId;
  const isAnsweringDoctor = !!me?.doctorId && raw.answeredByDoctorId === me.doctorId;
  if (!(isOwnerPartner || isAnsweringDoctor || user.role === "ADMIN")) {
    return operationOutcome(403, "forbidden", "Bu konsültasyona erişim yetkiniz yok.");
  }

  const v = await getRequestWithDocs(id);
  if (!v) return operationOutcome(404, "not-found", "Konsültasyon talebi bulunamadı.");

  let answeredByName: string | null = null;
  if (raw.answeredByDoctorId) {
    const d = await db.doctor.findUnique({ where: { id: raw.answeredByDoctorId }, select: { title: true, name: true } });
    if (d) answeredByName = `${d.title} ${d.name}`;
  }

  const bundle = consultationRequestBundle({
    id: v.id,
    branch: v.branch,
    region: v.region,
    language: v.language,
    icd10Code: v.icd10Code,
    clinicalSummary: v.summaryTr || v.clinicalSummary,
    answerText: v.answerText,
    answeredByName,
    answeredAt: v.answeredAt ? new Date(v.answeredAt) : null,
    docLabs: v.documents.flatMap((d) => d.aiLabs),
    recommendedLabs: v.recommendedLabs,
    recommendedImaging: v.recommendedImaging,
    medications: v.medications,
  });

  return fhirJson(bundle);
}
