import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { BRANCH_OPTIONS } from "@/lib/doctorium";
import { CongressAdmin } from "./CongressForm";
import { ArrowLeft, CalendarDays, Info } from "lucide-react";

export const dynamic = "force-dynamic";

// Doctorium Modül E küratör paneli — kongre takvimi ADMIN tarafından elle girilir.
// Otomatik kaynak yok: dernek/kongre siteleri makine-okunur takvim yayımlamıyor; uydurma
// etkinlik listelemek yerine bilinçli olarak insan küratörlü tutuldu.
export default async function CongressAdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (user.role !== "ADMIN") redirect("/doktor/doctorium");

  // Açık select: coverImage data URI'ları admin listesine gelmesin (forma da geçmiyor).
  const rows = await db.medicalCongress.findMany({
    orderBy: { startDate: "asc" },
    take: 100,
    select: { id: true, title: true, organizer: true, city: true, country: true,
      startDate: true, endDate: true, url: true },
  });
  const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <Link href="/doktor/doctorium?m=kongre" className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-ink)]">
        <ArrowLeft size={15} /> Doctorium · Kongre Takvimi
      </Link>

      <h1 className="aura-display mt-3 flex items-center gap-2.5 text-2xl font-medium tracking-tight text-[var(--c-ink)]">
        <CalendarDays size={22} className="text-emerald-300" /> Kongre takvimi yönetimi
      </h1>

      <p className="mt-3 flex items-start gap-2 rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-3.5 py-2.5 text-xs text-[var(--c-ink-2)]">
        <Info size={15} className="mt-px shrink-0" />
        Buraya girdiğiniz kayıtlar hekimlerin Doctorium → Kongre Takvimi sekmesinde görünür.
        Yalnız <strong className="text-[var(--c-ink)]">doğruladığınız</strong> etkinlikleri girin;
        kongre adresini resmî sayfasından alın.
      </p>

      <CongressAdmin
        branchOptions={BRANCH_OPTIONS}
        rows={rows.map((c) => ({
          id: c.id, title: c.title, organizer: c.organizer, city: c.city, country: c.country,
          startDate: iso(c.startDate) as string, endDate: iso(c.endDate), url: c.url,
        }))}
      />
    </div>
  );
}
