import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ConsultationRoom } from "@/components/ConsultationRoom";

export const dynamic = "force-dynamic";

export default async function ConsultationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const consult = await db.consultation.findUnique({
    where: { id },
    include: { case: true, doctor: true },
  });
  if (!consult) notFound();

  const c = consult.case;
  return (
    <ConsultationRoom
      consultationId={consult.id}
      status={consult.status}
      initialNotes={consult.notes}
      doctor={{ title: consult.doctor.title, name: consult.doctor.name, branch: consult.doctor.branch, color: consult.doctor.color }}
      caseData={{
        id: c.id,
        patientName: c.patientName,
        country: c.country,
        language: c.language,
        branch: c.branch,
        urgency: c.urgency,
        confidence: c.confidence,
        symptoms: c.symptoms,
        reasoning: c.reasoning,
        files: c.attachments ? c.attachments.split(",").filter(Boolean) : [],
      }}
    />
  );
}
