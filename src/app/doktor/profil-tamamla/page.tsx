import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { BRANCH_LABELS } from "@/lib/procedures";
import { CompleteProfileForm } from "./CompleteProfileForm";
import { IS_DOCTORIUM_DEPLOY } from "@/lib/brand";
import { hasDoctoriumAccess } from "@/lib/doctor-activation";

export const dynamic = "force-dynamic";

export const metadata = { title: "Profilinizi tamamlayın" };

// OAuth profil-tamamlama ara sayfası (v6.87). Google/Apple yalnız ad+e-posta verir; doktor hesabı
// branch:"" city:"" ile açılır → onboarding'den ÖNCE bu ekran kimliği doldurtur. Bekçi zinciri:
// callback yeni doktoru buraya yönlendirir (hızlı yol) + /doktor/baslangic branch/city boşsa buraya
// atar (kaçış kapanır). Profili TAM olan doktor burada tutulmaz → baslangic'a geçer (döngü yok).
export default async function CompleteProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/doktor/profil-tamamla");
  if (user.role !== "DOCTOR") redirect("/doktor");

  const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
  const doctor = me?.doctorId
    ? await db.doctor.findUnique({
        where: { id: me.doctorId },
        select: {
          name: true, title: true, branch: true, city: true,
          // Üç katman (2026-09-05): deneme üyesi profilini tamamlayınca DOĞRUDAN portala iner.
          diplomaVerifiedAt: true, studentVerifiedAt: true, doctoriumOptOutAt: true, trialEndsAt: true,
        },
      })
    : null;
  if (!doctor) redirect("/doktor");

  const sp = await searchParams;
  const fromQs = sp.from === "doctorium" ? "?from=doctorium" : "";
  // Varış (üç katman, 2026-09-05): Doctorium deploy'unda portala girebilen hesap (DENEME penceresi açık
  // ya da doğrulanmış) doğrudan Doctorium'a iner — diploma yüklemesi kilit ekranına/Hesabım'a kalır;
  // diğerleri eskisi gibi onboarding kapısına. Kompakt form yalnız Doctorium deploy'unda (branş + şehir).
  const compact = IS_DOCTORIUM_DEPLOY;
  const nextHref = compact && hasDoctoriumAccess(doctor) ? "/doktor/doctorium" : `/doktor/baslangic${fromQs}`;
  // Kimlik zaten tam → ara sayfanın işi yok; hedefe geç (from korunur).
  if (doctor.branch.trim() && doctor.city.trim()) redirect(nextHref);

  const branches = Object.values(BRANCH_LABELS).sort((a, b) => a.localeCompare(b, "tr"));
  return (
    <div className="grid min-h-[calc(100vh-8rem)] place-items-center bg-[var(--c-bg)] px-5 py-10">
      <CompleteProfileForm
        initialName={doctor.name}
        initialTitle={doctor.title}
        branches={branches}
        nextHref={nextHref}
        compact={compact}
      />
    </div>
  );
}
