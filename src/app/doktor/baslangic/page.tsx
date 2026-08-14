import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { soEligible } from "@/lib/doctor-home";
import { branchKeyFromLabel, branchLabel, getBranchProcedures, getByCodes } from "@/lib/procedures";
import { hasDoctoriumAccess, isEduEmail } from "@/lib/doctor-activation";
import { SPONSOR_CONSENT_TEXT } from "@/lib/sponsor";
import { HR_CONTACT_CONSENT_TEXT } from "@/lib/hr-consent";
import { GraduationCap } from "lucide-react";
import { StudentStage1Card } from "@/components/StudentStage1Card";
import { OnboardingForm } from "./OnboardingForm";

export const dynamic = "force-dynamic";

// M5 — Doktor ilk-giriş onboarding kapısı. onboardedAt damgalıysa Ana Sayfa'ya geçer (bir daha
// gösterilmez). v6.87: İKİ AŞAMALI — Aşama 1 (tabip odası yazısı → Doctorium) + Aşama 2 (klinik).
// Rıza TAM metinleri buradan prop geçer (lib'ler db'li → client'a import edilemez).
export default async function DoctorOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/doktor/baslangic");
  if (user.role !== "DOCTOR" && user.role !== "ADMIN") redirect("/doktor");

  const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
  const doctor = dbUser?.doctorId
    ? await db.doctor.findUnique({
        where: { id: dbUser.doctorId },
        select: {
          title: true, name: true, branch: true, city: true, onboardedAt: true, activatedAt: true, freeCareOptIn: true, consultOptIn: true,
          mmssInsurer: true, mmssPolicyNo: true, mmssCoverageLimit: true, mmssCoverageCurrency: true, mmssValidUntil: true,
          procedures: true, licenseNo: true, eduSchool: true, eduYear: true, specBoard: true, specYear: true,
          certifications: true, publications: true,
          chamberLetterAt: true, studentVerifiedAt: true, studentTrack: true, sponsorPersonalizationAt: true, hrContactOptInAt: true,
        },
      })
    : null;

  // Doktor profili bağlı değilse (ör. koordinatör) onboarding'in anlamı yok → panele geç.
  if (!doctor) redirect("/doktor");

  // v6.95 — ÖĞRENCİ MODU (/ogrenci hunisi): hekim onboarding'i (FHIR uzmanlık, işlemler,
  // diploma+MMSS, rızalar) HİÇ render edilmez — tek belge e-Devlet öğrenci belgesidir.
  // Branş/city kapısından ÖNCE dallanır: öğrenci profil-tamamla (hekim soruları) sayfasına
  // düşürülmez (kayıt formu branş+şehri zaten zorunlu topluyor).
  if (doctor.studentTrack) {
    const studentDocs = await db.doctorDocument.findMany({
      where: { doctorId: dbUser!.doctorId!, type: "STUDENT_CERT" },
      select: { id: true, type: true, label: true, mimeType: true },
      orderBy: { createdAt: "desc" },
    });
    return (
      <div className="mx-auto max-w-2xl px-5 py-10">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="grid h-12 w-12 place-items-center rounded-3xl bg-[var(--c-panel)] ring-1 ring-[var(--c-hairline)]">
            <GraduationCap size={24} className="text-[var(--c-accent)]" />
          </span>
          <h1 className="mt-3 font-serif text-xl font-bold tracking-tight text-[var(--c-ink)]">
            Hoş geldiniz, {doctor.name}
          </h1>
          <p className="mt-1 max-w-md text-sm text-[var(--c-ink-2)]">
            Öğrenci belgenizi yükleyin; Doctorium&apos;un haber, kongre, hukuk ve kütüphane
            içerikleri anında açılsın.
          </p>
        </div>
        <StudentStage1Card
          initialStudentDoc={studentDocs[0] ?? null}
          eduEmail={isEduEmail(user.email)}
          initialAccess={hasDoctoriumAccess(doctor)}
        />
      </div>
    );
  }
  // Onboard OLMUŞ ve zorunlu belgeleri tamamlamış (aktif) ise kapıyı atla. Belge eksikse (activatedAt
  // null) burada kal — doktor diploma + MMSS yükleyip tamamlasın.
  if (doctor.onboardedAt && doctor.activatedAt) redirect("/doktor");
  // v6.87 OAuth bekçisi: Google/Apple hesabı branch/city BOŞ açılır — kimlik tamamlanmadan
  // onboarding anlamsız (işlem listesi branştan türer) → profil-tamamla ara sayfasına
  // (?from=doctorium bağlamı korunur; callback'in doğrudan yönlendirmesinden kaçanlar da burada yakalanır).
  const sp = await searchParams;
  if (!doctor.branch.trim() || !doctor.city.trim()) {
    redirect(`/doktor/profil-tamamla${sp.from === "doctorium" ? "?from=doctorium" : ""}`);
  }

  // Yüklü mesleki belgelerin meta listesi (içerik DÖNMEZ) + MMSS metadata pre-fill.
  const allDocs = await db.doctorDocument.findMany({
    where: { doctorId: dbUser!.doctorId! },
    select: { id: true, type: true, label: true, mimeType: true },
    orderBy: { createdAt: "desc" },
  });
  // Aşama ayrımı: CHAMBER (tabip odası yazısı) Aşama 1 kartına, kalanı Aşama 2 belge bölümüne.
  // STUDENT_CERT de dışlanır: mezuniyet geçişi yapmış hesabın öğrenci belgesi klinik belge
  // listesine sızmaz (öğrenci MODU yukarıda ayrı dallandı — buraya öğrenci hesabı gelmez).
  const chamberDoc = allDocs.find((d) => d.type === "CHAMBER") ?? null;
  const docs = allDocs.filter((d) => d.type !== "CHAMBER" && d.type !== "STUDENT_CERT");

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
      stage1={{
        initialChamberDoc: chamberDoc,
        initialAccess: hasDoctoriumAccess(doctor),
        initialSponsor: !!doctor.sponsorPersonalizationAt,
        initialHr: !!doctor.hrContactOptInAt,
        sponsorText: SPONSOR_CONSENT_TEXT,
        hrText: HR_CONTACT_CONSENT_TEXT,
        fromDoctorium: sp.from === "doctorium",
      }}
    />
  );
}
