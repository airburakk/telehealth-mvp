import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { soEligible } from "@/lib/doctor-home";
import { branchKeyFromLabel, branchLabel, getBranchProcedures, getByCodes } from "@/lib/procedures";
import { OnboardingForm } from "./OnboardingForm";

export const dynamic = "force-dynamic";

// M5 — Doktor ilk-giriş onboarding kapısı. onboardedAt damgalıysa Ana Sayfa'ya geçer (bir daha gösterilmez).
export default async function DoctorOnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/doktor/baslangic");
  if (user.role !== "DOCTOR" && user.role !== "ADMIN") redirect("/doktor");

  const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
  const doctor = dbUser?.doctorId
    ? await db.doctor.findUnique({
        where: { id: dbUser.doctorId },
        select: {
          title: true, name: true, branch: true, onboardedAt: true, activatedAt: true, freeCareOptIn: true, consultOptIn: true,
          mmssInsurer: true, mmssPolicyNo: true, mmssCoverageLimit: true, mmssCoverageCurrency: true, mmssValidUntil: true,
          procedures: true, licenseNo: true, eduSchool: true, eduYear: true, specBoard: true, specYear: true,
          certifications: true, publications: true,
        },
      })
    : null;

  // Doktor profili bağlı değilse (ör. koordinatör) onboarding'in anlamı yok → panele geç.
  if (!doctor) redirect("/doktor");
  // Onboard OLMUŞ ve zorunlu belgeleri tamamlamış (aktif) ise kapıyı atla. Belge eksikse (activatedAt
  // null) burada kal — doktor diploma + MMSS yükleyip tamamlasın.
  if (doctor.onboardedAt && doctor.activatedAt) redirect("/doktor");

  // Yüklü mesleki belgelerin meta listesi (içerik DÖNMEZ) + MMSS metadata pre-fill.
  const docs = await db.doctorDocument.findMany({
    where: { doctorId: dbUser!.doctorId! },
    select: { id: true, type: true, label: true, mimeType: true },
    orderBy: { createdAt: "desc" },
  });

  // Branş işlemleri (taban/tavan) + doktorun kayıtlı seçimi (FHIR ServiceRequest/ChargeItem girdisi).
  const branchKey = branchKeyFromLabel(doctor.branch) ?? "";
  const branchItems = branchKey ? getBranchProcedures(branchKey) : [];
  let initialProc: Record<string, number> = {};
  try { initialProc = doctor.procedures ? (JSON.parse(doctor.procedures) as Record<string, number>) : {}; } catch { initialProc = {}; }
  const branchCodes = new Set(branchItems.map((p) => p.code));
  const extraItems = getByCodes(Object.keys(initialProc).filter((c) => !branchCodes.has(c)));

  // FHIR qualification + akademik pre-fill.
  let certs: string[] = [];
  try { if (doctor.certifications) { const p = JSON.parse(doctor.certifications); if (Array.isArray(p)) certs = p as string[]; } } catch { /* bozuk JSON */ }
  let pubs: { title: string; venue: string; year: number }[] = [];
  try { if (doctor.publications) { const p = JSON.parse(doctor.publications); if (Array.isArray(p)) pubs = p; } } catch { /* bozuk JSON */ }

  return (
    <OnboardingForm
      doctorName={`${doctor.title} ${doctor.name}`}
      branchKey={branchKey}
      branchLabel={branchKey ? branchLabel(branchKey) : doctor.branch}
      branchItems={branchItems}
      initialProc={initialProc}
      extraItems={extraItems}
      qualification={{
        licenseNo: doctor.licenseNo,
        eduSchool: doctor.eduSchool,
        eduYear: doctor.eduYear,
        specBoard: doctor.specBoard,
        specYear: doctor.specYear,
        certifications: certs,
        publications: pubs,
      }}
      soOpen={soEligible(doctor.title)}
      initialFreeCare={doctor.freeCareOptIn}
      initialConsult={doctor.consultOptIn}
      initialDocs={docs}
      initialMmss={{
        insurer: doctor.mmssInsurer,
        coverageLimit: doctor.mmssCoverageLimit,
        currency: doctor.mmssCoverageCurrency,
        validUntil: doctor.mmssValidUntil ? doctor.mmssValidUntil.toISOString() : null,
        policyNoSet: !!doctor.mmssPolicyNo,
      }}
    />
  );
}
