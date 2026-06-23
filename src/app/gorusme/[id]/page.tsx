import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ownsCase } from "@/lib/ownership";
import { ConsultationRoom } from "@/components/ConsultationRoom";
import { PreConsultLobby } from "@/components/PreConsultLobby";
import { branchKeyFromLabel, branchLabel as branchLabelOf, getBranchProcedures } from "@/lib/procedures";
import { getTryPerUsd } from "@/lib/fxrate";
import { icd10ForBranchLabel } from "@/data/coding";
import { decryptField } from "@/lib/crypto";
import type { Structured } from "@/components/DischargeReport";

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
        rate: number;
      }
    | undefined;
  if (selfRole === "doctor") {
    const branchKey = branchKeyFromLabel(consult.doctor.branch);
    let doctorPrices: Record<string, number> = {};
    try { doctorPrices = consult.doctor.procedures ? JSON.parse(consult.doctor.procedures) : {}; } catch { doctorPrices = {}; }
    let initial: { code: string; name: string; priceTRY: number }[] = [];
    try { initial = c.recommendedProcedures ? JSON.parse(c.recommendedProcedures) : []; } catch { initial = []; }
    const fx = await getTryPerUsd();
    recommend = {
      branchLabel: branchKey ? branchLabelOf(branchKey) : consult.doctor.branch,
      branchProcedures: branchKey ? getBranchProcedures(branchKey) : [],
      doctorPrices,
      initial,
      rate: fx.rate,
    };
  }

  // Kokpitten taşınan FHIR klinik kodlama + AI epikriz verisi — yalnız doktor görünümü için derle
  let clinical:
    | {
        icd10Code: string | null;
        patientIdentifier: string | null;
        patientIdentifierType: string | null;
        icd10Options: { code: string; label: string }[];
        dischargeReport: string | null;
        dischargeStructured: Structured | null;
        dischargeSavedAt: string | null;
      }
    | undefined;
  if (selfRole === "doctor") {
    let dischargeStructured: Structured | null = null;
    // Epikriz at-rest şifreli → doktor görünümü için çöz (clinical prop yalnız doktora gider).
    try { dischargeStructured = c.dischargeStructured ? (JSON.parse(decryptField(c.dischargeStructured)) as Structured) : null; } catch { dischargeStructured = null; }
    clinical = {
      icd10Code: c.icd10Code,
      patientIdentifier: c.patientIdentifier,
      patientIdentifierType: c.patientIdentifierType,
      icd10Options: icd10ForBranchLabel(c.branch),
      dischargeReport: decryptField(c.dischargeReport),
      dischargeStructured,
      dischargeSavedAt: c.dischargeAt ? c.dischargeAt.toISOString() : null,
    };
  }

  // autoJoin: lobiden sonra ConsultationRoom kendi "katıl" ekranını atlar → tek tık (yalnız lobi yolunda true)
  const buildRoom = (autoJoin: boolean) => (
    <ConsultationRoom
      consultationId={consult.id}
      selfRole={selfRole}
      status={consult.status}
      initialNotes={decryptField(consult.notes)}
      doctor={{ title: consult.doctor.title, name: consult.doctor.name, branch: consult.doctor.branch, color: consult.doctor.color }}
      recommend={recommend}
      clinical={clinical}
      autoJoin={autoJoin}
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

  // Görüşme Öncesi Oda (Faz B) — aktif görüşmede lobi zorunlu (cihaz testi + hazırlık),
  // biten görüşmede atlanır (oda doğrudan "sona erdi" durumunu gösterir).
  // Talk akışında randevu yok → scheduledAt=null (anlık katılım). Doktor arayüzü Türkçe (ConsultationRoom uiLang ile uyumlu).
  // Lobi sonrası autoJoin=true → odanın kendi "katıl" ekranı atlanır (tek tık); ENDED yolunda false (davranış değişmez).
  if (consult.status === "ENDED") return buildRoom(false);
  return (
    <PreConsultLobby
      lang={selfRole === "doctor" ? "Türkçe" : c.language}
      scheduledAt={null}
      isDoctor={selfRole === "doctor"}
      remoteLabel={selfRole === "doctor" ? c.patientName : `${consult.doctor.title} ${consult.doctor.name}`.trim()}
      branchLabel={c.branch}
      storageKey={consult.id}
    >
      {buildRoom(true)}
    </PreConsultLobby>
  );
}
