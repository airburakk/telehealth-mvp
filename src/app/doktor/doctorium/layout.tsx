import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasDoctoriumAccess } from "@/lib/doctor-activation";
import { DoctoriumFooter } from "@/components/aura/doctorium-footer";

export const dynamic = "force-dynamic";

// Sekme ikonu: bu segment ve TÜM alt rotaları ([id] · etkinlik · kariyer · kaydettiklerim …)
// ZÜMRÜT ikon gösterir; kök layout'un TURKUAZ varsayılanını override eder (kullanıcı kararı
// 2026-08-23, v6.137: KOYU DİSK + holografik küre; AURA turkuaz küre, Doctorium zümrüt küre
// (hue −30°) — her marka kendi tonunu taşır; 2026-08-19 "dolu daire + siyah amblem" süpersede).
// 🪤 Dosya konvansiyonu (`icon.ico`) ÇALIŞMIYOR: kök `src/app/favicon.ico` alt segment ikonunu
// bastırıyordu (dosya HTTP 200 servis ediliyor ama <link rel="icon"> basılmıyordu) → kök
// favicon.ico kaldırıldı, ikonlar public/ altına alındı, bağlama metadata ile yapılıyor.
// Üretim: `python scripts/gen-icons.py`.
export const metadata: Metadata = {
  // Ayrışma (2026-08-24): sekme başlığı kök şablonun "%s · AURA"sını EZER — Doctorium
  // yüzeylerinde AURA adı geçmez. appleWebApp adı da Doctorium (ana ekrana ekleme).
  // 🪤 `default` YETMEZ: çocuk default'u KÖKÜN şablonuna yerleştirilir ("Doctorium · AURA"
  // ölçüldü) — üst şablonu yalnız `absolute` iptal eder; template alt sayfalara uygulanır.
  title: { absolute: "Doctorium", template: "%s · Doctorium" },
  appleWebApp: { capable: true, title: "Doctorium", statusBarStyle: "default" },
  // 🪤 `?v=` cache-kırıcı — gerekçe kök layout.tsx'te. İkon değişince ÜÇ layout'ta birlikte artır.
  icons: { icon: "/icon-doctorium.ico?v=3", apple: "/apple-touch-icon.png?v=3" },
};

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
          select: { diplomaVerifiedAt: true, studentVerifiedAt: true, doctoriumOptOutAt: true },
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
  // (theme prop'u 2026-08-24 ayrışmasında kalktı — tek işlevi ByAura wordmark renk seçimiydi.)
  return (
    // doctorium-scope (tema-duyarlı, v6.184 — kullanıcı kararı 2026-08-29): sabit
    // `theme-light` KALKTI, Doctorium portalı gece/gündüz toggle'ını yeniden dinliyor
    // (2026-08-27'nin "DAİMA açık palet" kararı süpersede edildi). Tema kök <html>'den
    // gelir (Header'daki ThemeToggle → `theme` cookie); doctorium-scope gündüzde
    // nötr tuvali V3'ün kırık beyazına çeker, gecede AURA'nın gece nötrleri geçerlidir.
    // Marka kimliği her iki temada tipografiden (Inter) sürer — bkz. globals.css.
    <div className="doctorium-scope flex min-h-[calc(100dvh-4rem)] flex-col bg-[var(--c-bg)] text-[var(--c-ink)]">
      <div className="flex-1">{children}</div>
      <DoctoriumFooter portal />
    </div>
  );
}
