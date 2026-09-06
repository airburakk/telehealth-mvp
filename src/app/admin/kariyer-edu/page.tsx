import Link from "next/link";
import { redirect } from "next/navigation";
import { GraduationCap, Info, ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { listAllEduOpportunities } from "@/lib/edu-store";
import { EduAdmin } from "./EduAdmin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Kariyer EDU" };

/**
 * Kariyer EDU küratör paneli (E2, 2026-09-06) — staj / değişim / burs fırsatı GİRİŞİ ve 👤 YAYIN ONAYI. Etkinlik paneliyle aynı desen
 * (elle giriş; kaynak = kurumun kendi sayfası). approvedAt olmayan kayıt öğrenci yüzeyinde GÖRÜNMEZ. Burs kapsamı 👤 2026-09-05:
 * kamu + üniversite + büyük vakıf (ilaç/cihaz/ticari kuruluş bursu DIŞARIDA). ⚖️ İlan dili API'de reddedilir.
 */
export default async function EduAdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (user.role !== "ADMIN") redirect("/doktor/doctorium");
  const rows = await listAllEduOpportunities();
  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-ink)]">
        <ArrowLeft size={15} /> Yönetim
      </Link>
      <h1 className="aura-display mt-3 flex items-center gap-2.5 text-2xl font-medium tracking-tight text-[var(--c-ink)]">
        <GraduationCap size={22} className="text-[var(--c-accent)]" /> Kariyer EDU — fırsat takvimi yönetimi
      </h1>
      <p className="mt-3 flex items-start gap-2 rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-3.5 py-2.5 text-xs text-[var(--c-ink-2)]">
        <Info size={15} className="mt-px shrink-0" />
        <span>
          Kayıtlar tıp öğrencilerinin Kariyer sekmesinde ve Takvim&apos;inde görünür; yalnız <strong className="text-[var(--c-ink)]">onayladığınız</strong> kayıtlar
          yayına girer. Kaynak daima kurumun kendi sayfası; şartlar kısa özet (kaynak metin kopyalanmaz). Burs kapsamı: kamu + üniversite + büyük vakıf.
          Bu bir ilan panosu değildir — başvuru düğmesi, CV, işveren eşleştirmesi yoktur.
        </span>
      </p>
      <EduAdmin rows={rows} />
    </div>
  );
}
