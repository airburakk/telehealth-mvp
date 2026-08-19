import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasDoctoriumAccess } from "@/lib/doctor-activation";
import { DoctoriumFooter } from "@/components/aura/doctorium-footer";

export const dynamic = "force-dynamic";

// İki aşamalı giriş — AŞAMA 1 kapısı (v6.124: e-Devlet doğrulamalı diploma). Doctorium'a DOCTOR
// rolü ancak DOĞRULANMIŞ diploması (diplomaVerifiedAt — DIPLOMA belgesi ACCEPTED) VEYA öğrenci
// belgesi (studentVerifiedAt) varsa girer; yoksa onboarding'e yönlendirilir (?from=doctorium
// → sayfa "önce belgenizi yükleyin" bandını gösterir). Tabip odası yazısı v6.124'te kapıdan
// düştü (kullanıcı kararı 2026-08-19). Segment layout'u [id] dahil TÜM alt
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
          select: { diplomaVerifiedAt: true, studentVerifiedAt: true },
        })
      : null;
    if (!doctor) redirect("/doktor"); // doktor profili bağlı değil — genel panel davranışına bırak
    if (!hasDoctoriumAccess(doctor)) redirect("/doktor/baslangic?from=doctorium");
  }

  // Doctorium alt bilgisi 7 alt sayfanın hepsine BURADAN iner (kullanıcı kararı 2026-08-18).
  // Global AURA SiteFooter bu ağaçta chrome-routes.ts'teki hidesFooter() ile susturulur —
  // ⚠️ Header SUSMAZ: Üst Raf navigasyonu (v6.109) iç portalın gezinme omurgası.
  //
  // DİBE YAPIŞTIRMA (2026-08-19, kullanıcı bildirimi "footer çok yukarı çıkmış"): SiteFooter
  // kök layout'ta `main.flex-1`in KARDEŞİ olduğu için hep dipteydi; DoctoriumFooter ise main'in
  // İÇİNDEN geldiğinden kısa sayfada (etkinlik kartı ~1 ekran) viewport ortasında asılı
  // kalıyordu. min-h = 100dvh − Header h-16 (4rem); MasterBar'lı nadir oturumda sayfa yalnız
  // o kadar uzar (min-height olduğundan zararsız). Mobil fixed alt çubuk payı footer'ın kendi
  // portal varyantında (mb-14) — Shell'in pb-16'sı yalnız children'ı kapsıyordu.
  //
  // Portal varyantı TEMA-DUYARLI (globals.css .doctorium-footer-portal): gece --c-chrome
  // (#08090b) sayfa zemininden (#0d0e10) ayrışır, gündüz açık krom "siyah blok"u bitirir.
  // ByAura wordmark PNG'sinin light/dark seçimi SSR'da cookie'den (Header'la aynı kaynak).
  const themeCookie = (await cookies()).get("aura_theme")?.value;
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col">
      <div className="flex-1">{children}</div>
      <DoctoriumFooter portal theme={themeCookie === "light" ? "light" : "dark"} />
    </div>
  );
}
