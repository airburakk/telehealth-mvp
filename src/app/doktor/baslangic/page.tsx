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
        select: { title: true, name: true, onboardedAt: true, proBonoOptIn: true, consultOptIn: true },
      })
    : null;

  // Hekim profili bağlı değilse (ör. koordinatör) onboarding'in anlamı yok → panele geç.
  if (!doctor) redirect("/doktor");
  // Zaten onboard olduysa kapıyı atla.
  if (doctor.onboardedAt) redirect("/doktor");

  return (
    <OnboardingForm
      doctorName={`${doctor.title} ${doctor.name}`}
      soOpen={soEligible(doctor.title)}
      initialProBono={doctor.proBonoOptIn}
      initialConsult={doctor.consultOptIn}
    />
  );
}
