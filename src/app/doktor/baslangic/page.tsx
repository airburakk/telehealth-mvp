import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { soEligible } from "@/lib/doctor-home";
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
          title: true, name: true, onboardedAt: true, activatedAt: true, proBonoOptIn: true, consultOptIn: true,
          mmssInsurer: true, mmssPolicyNo: true, mmssCoverageLimit: true, mmssCoverageCurrency: true, mmssValidUntil: true,
        },
      })
    : null;

  // Hekim profili bağlı değilse (ör. koordinatör) onboarding'in anlamı yok → panele geç.
  if (!doctor) redirect("/doktor");
  // Onboard OLMUŞ ve zorunlu belgeleri tamamlamış (aktif) ise kapıyı atla. Belge eksikse (activatedAt
  // null) burada kal — hekim diploma + MMSS yükleyip tamamlasın.
  if (doctor.onboardedAt && doctor.activatedAt) redirect("/doktor");

  // Yüklü mesleki belgelerin meta listesi (içerik DÖNMEZ) + MMSS metadata pre-fill.
  const docs = await db.doctorDocument.findMany({
    where: { doctorId: dbUser!.doctorId! },
    select: { id: true, type: true, label: true, mimeType: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <OnboardingForm
      doctorName={`${doctor.title} ${doctor.name}`}
      soOpen={soEligible(doctor.title)}
      initialProBono={doctor.proBonoOptIn}
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
