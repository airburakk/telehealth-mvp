import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ownsCase } from "@/lib/ownership";
import { ConsultationRoom } from "@/components/ConsultationRoom";
import { branchKeyFromLabel, branchLabel as branchLabelOf, getBranchProcedures } from "@/lib/procedures";

export const dynamic = "force-dynamic";

export default async function ConsultationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ role?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const consult = await db.consultation.findUnique({
    where: { id },
    include: { case: true, doctor: true },
  });
  if (!consult) notFound();

  const user = await getCurrentUser();
  if (!ownsCase(user, consult.case)) notFound(); // hasta yalnız kendi görüşmesine katılır
  const sessionRole =
    user && ["DOCTOR", "COORDINATOR", "ADMIN"].includes(user.role) ? "doctor" : "patient";
  const selfRole: "doctor" | "patient" =
    sp.role === "patient" ? "patient" : sp.role === "doctor" ? "doctor" : sessionRole;

  const c = consult.case;

  // M2→M3 tavsiye edilen tedaviler — yalnız doktor görünümü için derle
  let recommend:
    | {
        branchLabel: string;
        branchProcedures: { code: string; name: string; price: number | null; branch: string; group: string }[];
        doctorPrices: Record<string, number>;
        initial: { code: string; name: string; priceTRY: number }[];
      }
    | undefined;
  if (selfRole === "doctor") {
    const branchKey = branchKeyFromLabel(consult.doctor.branch);
    let doctorPrices: Record<string, number> = {};
    try { doctorPrices = consult.doctor.procedures ? JSON.parse(consult.doctor.procedures) : {}; } catch { doctorPrices = {}; }
    let initial: { code: string; name: string; priceTRY: number }[] = [];
    try { initial = c.recommendedProcedures ? JSON.parse(c.recommendedProcedures) : []; } catch { initial = []; }
    recommend = {
      branchLabel: branchKey ? branchLabelOf(branchKey) : consult.doctor.branch,
      branchProcedures: branchKey ? getBranchProcedures(branchKey) : [],
      doctorPrices,
      initial,
    };
  }

  return (
    <ConsultationRoom
      consultationId={consult.id}
      selfRole={selfRole}
      status={consult.status}
      initialNotes={consult.notes}
      doctor={{ title: consult.doctor.title, name: consult.doctor.name, branch: consult.doctor.branch, color: consult.doctor.color }}
      recommend={recommend}
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
