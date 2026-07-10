import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canCaseBeAccessedBy } from "@/lib/ownership";
import { staffAccessClosed } from "@/lib/postop-access";
import { ConsultationRoom } from "@/components/ConsultationRoom";
import { PreConsultLobby } from "@/components/PreConsultLobby";
import { buildDoctorCard } from "@/lib/doctor-card";
import { branchKeyFromLabel, branchLabel as branchLabelOf, getBranchProcedures, getByCodes } from "@/lib/procedures";
import { getTryPerUsd } from "@/lib/fxrate";
import { icd10ForBranchLabel } from "@/data/coding";
import { ICD_PROCEDURES } from "@/data/icd-procedures";
import { decryptField, decryptCaseFields } from "@/lib/crypto";

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
  if (!(await canCaseBeAccessedBy(user, consult.case))) notFound(); // hasta yalnız kendi görüşmesine katılır
  // E2EE Faz 2A — post-op takip tamamlandıysa klinik personel görüşme klinik ekranına giremez (hasta-only, §0.1·3).
  if ((await staffAccessClosed(consult.case.id, user)).closed) notFound();
  const sessionRole =
    user && ["DOCTOR", "COORDINATOR", "ADMIN"].includes(user.role) ? "doctor" : "patient";
  const selfRole: "doctor" | "patient" =
    sp.role === "patient" ? "patient" : sp.role === "doctor" ? "doctor" : sessionRole;

  const c = decryptCaseFields(consult.case); // symptoms/reasoning/extra at-rest şifreli → çöz (discharge alanları aşağıda ayrıca)

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

  // Birleşik Klinik Kodlama + Tedavi Kararı verisi — yalnız doktor görünümü için derle (FAZ 2).
  // AI Epikriz artık burada değil: post-op ekranına taşındı (/takip/[caseId], personel görünümü).
  let clinical:
    | {
        icd10Code: string | null;
        patientIdentifier: string | null;
        patientIdentifierType: string | null;
        icd10Options: { code: string; label: string }[];
        icdProcedures: Record<string, { code: string; name: string; price: number | null }[]>;
        treatmentDaysMin: number | null;
        treatmentDaysMax: number | null;
        hospitalRegistryId: number | null;
        hospitalName: string | null;
        agencySentAt: string | null;
      }
    | undefined;
  if (selfRole === "doctor") {
    const branchKey = branchKeyFromLabel(consult.doctor.branch);
    // ICD→işlem eşlemesi KATALOG-çözümlü gönderilir (kod+ad+taban): eşlenmiş kodlar çapraz-branş
    // olabilir (ör. onkolojide kemoterapi = hematoloji havuzu) → branş listesinde aranmaz.
    const rawMap = (branchKey ? ICD_PROCEDURES[branchKey] : undefined) ?? {};
    const icdProcedures: Record<string, { code: string; name: string; price: number | null }[]> = {};
    for (const [icd, codes] of Object.entries(rawMap)) {
      icdProcedures[icd] = getByCodes(codes).map((p) => ({ code: p.code, name: p.name, price: p.price }));
    }
    clinical = {
      icd10Code: c.icd10Code,
      patientIdentifier: c.patientIdentifier,
      patientIdentifierType: c.patientIdentifierType,
      icd10Options: icd10ForBranchLabel(c.branch),
      icdProcedures,
      treatmentDaysMin: c.treatmentDaysMin,
      treatmentDaysMax: c.treatmentDaysMax,
      hospitalRegistryId: c.hospitalRegistryId,
      hospitalName: c.hospitalName,
      agencySentAt: c.agencySentAt ? c.agencySentAt.toISOString() : null,
    };
  }

  // Atanan doktor public profil özeti — yalnız hasta görünümünde bekleme odası kartına gider.
  const doctorCard = selfRole === "patient" ? await buildDoctorCard(consult.doctor) : null;

  // autoJoin: lobiden sonra ConsultationRoom kendi "katıl" ekranını atlar → tek tık (yalnız lobi yolunda true)
  const buildRoom = (autoJoin: boolean) => (
    <ConsultationRoom
      consultationId={consult.id}
      selfRole={selfRole}
      status={consult.status}
      storageKey={consult.id}
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
      doctorCard={doctorCard}
    >
      {buildRoom(true)}
    </PreConsultLobby>
  );
}
