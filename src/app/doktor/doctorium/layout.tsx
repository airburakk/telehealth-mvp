import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasDoctoriumAccess } from "@/lib/doctor-activation";
import { DoctoriumFooter } from "@/components/aura/doctorium-footer";

export const dynamic = "force-dynamic";

// İki aşamalı giriş — AŞAMA 1 kapısı (v6.87; öğrenci damgası v6.95). Doctorium'a DOCTOR rolü
// ancak tabip odası yazısı (chamberLetterAt) VEYA öğrenci belgesi (studentVerifiedAt) VEYA klinik
// aktivasyon (activatedAt) varsa girer; hiçbiri yoksa onboarding'e yönlendirilir (?from=doctorium
// → sayfa "önce belgenizi yükleyin" bandını gösterir). Segment layout'u [id] dahil TÜM alt
// rotaları sarmaladığı için kapı tek noktadan işler; page.tsx'lerin kendi rol kontrolleri
// (derinlik savunması) aynen durur. COORDINATOR/ADMIN gözetim erişimi mevcut davranışıyla geçer.
//
// ⚠️ Faz 1 bandı (DoctoriumSidebar/Shell) BURADA DEĞİL, page'lerde yaşar — layout searchParams
// göremez; useSearchParams'lı client bant denemesi Next 16'da Suspense'te asılı kaldı ($RC
// tamamlanma sinyali hiç gelmedi). Aktifliği bilen page, Shell'i kendisi kurar.
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

  // Doctorium alt bilgisi 7 alt sayfanın hepsine BURADAN iner (kullanıcı kararı 2026-08-18).
  // Global AURA SiteFooter bu ağaçta chrome-routes.ts'teki hidesFooter() ile susturulur —
  // ⚠️ Header SUSMAZ: Üst Raf navigasyonu (v6.109) iç portalın gezinme omurgası.
  return (
    <>
      {children}
      <DoctoriumFooter />
    </>
  );
}
