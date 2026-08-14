import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasDoctoriumAccess } from "@/lib/doctor-activation";

export const dynamic = "force-dynamic";

// İki aşamalı giriş — AŞAMA 1 kapısı (v6.87; öğrenci damgası v6.95). Doctorium'a DOCTOR rolü
// ancak tabip odası yazısı (chamberLetterAt) VEYA öğrenci belgesi (studentVerifiedAt) VEYA klinik
// aktivasyon (activatedAt) varsa girer; hiçbiri yoksa onboarding'e yönlendirilir (?from=doctorium
// → sayfa "önce belgenizi yükleyin" bandını gösterir). Segment layout'u [id] dahil TÜM alt
// rotaları sarmaladığı için kapı tek noktadan işler; page.tsx'lerin kendi rol kontrolleri
// (derinlik savunması) aynen durur. COORDINATOR/ADMIN gözetim erişimi mevcut davranışıyla geçer.
export default async function DoctoriumLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "COORDINATOR", "ADMIN"].includes(user.role)) redirect("/");

  if (user.role === "DOCTOR") {
    const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
    const doctor = me?.doctorId
      ? await db.doctor.findUnique({
          where: { id: me.doctorId },
          select: { chamberLetterAt: true, activatedAt: true, studentVerifiedAt: true },
        })
      : null;
    if (!doctor) redirect("/doktor"); // doktor profili bağlı değil — genel panel davranışına bırak
    if (!hasDoctoriumAccess(doctor)) redirect("/doktor/baslangic?from=doctorium");
  }

  return <>{children}</>;
}
