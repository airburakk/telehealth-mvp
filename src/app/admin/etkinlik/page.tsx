import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { BRANCH_OPTIONS } from "@/lib/doctorium";
import { CongressAdmin } from "./CongressForm";
import { ArrowLeft, CalendarDays, Info } from "lucide-react";

export const dynamic = "force-dynamic";

// Doctorium Modül E küratör paneli — etkinlik takvimine ADMIN tarafından ELLE giriş.
// v6.120 düzeltmesi: "otomatik kaynak yok" artık YANLIŞ — TTB'nin akredite etkinlik kaydı
// (kredilendirme.ttb.dr.tr) kimliksiz ve sorgulanabilir, scripts/ingest-ttb-events.ts onu
// çeker. Bu panel TTB dışı / henüz akredite edilmemiş etkinlikler ve düzeltmeler içindir;
// TTB kayıtlarını (source="ttb-kredilendirme") buradan düzenlemeyin — ingest üzerine yazar.
export default async function CongressAdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (user.role !== "ADMIN") redirect("/doktor/doctorium");

  // Açık select: coverImage data URI'ları admin listesine gelmesin (forma da geçmiyor).
  const rows = await db.medicalCongress.findMany({
    orderBy: { startDate: "asc" },
    take: 100,
    select: { id: true, title: true, organizer: true, city: true, country: true,
      startDate: true, endDate: true, url: true, eventType: true, ttbCode: true },
  });
  const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <Link href="/doktor/doctorium?m=etkinlik" className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-ink)]">
        <ArrowLeft size={15} /> Doctorium · Etkinlik Takvimi
      </Link>

      <h1 className="aura-display mt-3 flex items-center gap-2.5 text-2xl font-medium tracking-tight text-[var(--c-ink)]">
        <CalendarDays size={22} className="text-emerald-300" /> Etkinlik takvimi yönetimi
      </h1>

      {/* ⚠️ flex-gap tuzağı (2026-09-04 dersi): ikon dışı içerik TEK span'e sarılı olmalı. */}
      <p className="mt-3 flex items-start gap-2 rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-3.5 py-2.5 text-xs text-[var(--c-ink-2)]">
        <Info size={15} className="mt-px shrink-0" />
        <span>
          Buraya girdiğiniz kayıtlar doktorların Doctorium → Etkinlik Takvimi sekmesinde görünür.
          Yalnız <strong className="text-[var(--c-ink)]">doğruladığınız</strong> etkinlikleri girin;
          etkinlik adresini resmî sayfasından alın.
        </span>
      </p>

      <CongressAdmin
        branchOptions={BRANCH_OPTIONS}
        rows={rows.map((c) => ({
          id: c.id, title: c.title, organizer: c.organizer, city: c.city, country: c.country,
          startDate: iso(c.startDate) as string, endDate: iso(c.endDate), url: c.url,
          eventType: c.eventType, ttbCode: c.ttbCode,
        }))}
      />
    </div>
  );
}
