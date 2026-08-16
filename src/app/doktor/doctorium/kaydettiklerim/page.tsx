import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { savedFeed, localizeTitles } from "@/lib/doctorium";
import { isStudentOnly } from "@/lib/doctor-activation";
import { getDoctorBalance } from "@/lib/rewards";
import { ArticleCard } from "../ArticleCard";
import { DoctoriumShell } from "../DoctoriumSidebar";
import { ArrowLeft, Bookmark, Info } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = { title: "Kaydettiklerim" };

// Doctorium "Kaydettiklerim" (Faz 2, 2026-08-14) — doktorun işaretlediği içerikler, kaydediliş
// sırasıyla. Segment layout'u Aşama-1 kapısını uygular; buradaki rol kontrolü derinlik
// savunmasıdır. Yalnız DOCTOR (kayıt doktor kimliğine bağlı); öğrenci-sınırlı üye DAHİL
// (içerik işlevi — pazarlama yüzeyi değil; ödül sayfasının aksine yönlendirilmez).
export default async function SavedPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (user.role !== "DOCTOR") redirect("/doktor/doctorium");
  const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
  if (!me?.doctorId) redirect("/doktor");
  const doctorId = me.doctorId;

  const d = await db.doctor.findUnique({
    where: { id: doctorId },
    select: { activatedAt: true, studentVerifiedAt: true },
  });
  // Puan rozeti bant için: öğrenci-sınırlıda null (pazarlama süzgeci) — sayfa erişimini KISITLAMAZ.
  const balance = d && !isStudentOnly(d) ? await getDoctorBalance(doctorId) : null;

  let items = await savedFeed(doctorId);
  if (items.length) items = await localizeTitles(items);

  return (
    <DoctoriumShell active="kaydettiklerim" balance={balance} isDoctor>
      <div className="max-w-3xl px-5 py-8">
        {/* Masaüstünde dönüş banttadır (Faz 1); bu link yalnız mobil için. */}
        <Link
          href="/doktor/doctorium"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-ink)] md:hidden"
        >
          <ArrowLeft size={15} /> Doctorium
        </Link>

        <div className="mt-3 md:mt-0">
          <div className="aura-mono text-[10.5px] font-bold tracking-[0.16em] text-[var(--c-ink)]">KİŞİSEL</div>
          <h1 className="aura-display mt-1 flex items-center gap-2.5 text-3xl font-medium tracking-tight text-[var(--c-ink)]">
            <Bookmark size={24} className="text-emerald-300" /> Kaydettiklerim
          </h1>
          <p className="mt-1 text-[13px] text-[var(--c-ink-2)]">
            İşaretlediğiniz içerikler burada — akış aksa da kaybolmaz.
          </p>
        </div>

        {items.length === 0 ? (
          <p className="mt-6 flex items-start gap-2 rounded-2xl border border-dashed border-[var(--c-hairline)] bg-[var(--c-surface)] px-4 py-8 text-sm text-[var(--c-ink-2)]">
            <Info size={16} className="mt-0.5 shrink-0" />
            <span>
              Henüz içerik kaydetmediniz. Akıştaki herhangi bir kartın sağ üst köşesindeki
              yer imi düğmesiyle kaydedebilirsiniz.
            </span>
          </p>
        ) : (
          <ul className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-3">
            {/* grid-cols-[minmax(0,1fr)]: akış listesindeki taşma dersinin eşleniği (2026-08-16). */}
            {items.map((it) => (
              <ArticleCard key={it.id} item={it} saved />
            ))}
          </ul>
        )}
      </div>
    </DoctoriumShell>
  );
}
