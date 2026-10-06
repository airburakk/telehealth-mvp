import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { formatIsoDayTr } from "@/lib/iso-day";
import { getItem } from "@/lib/social-calendar/plan";
import { WEEKDAY_LONG, isoWeekday, seriesByKey, weekStart } from "@/lib/social-calendar/series";
import { PageHeader } from "@/components/ui/PageHeader";
import { SlotEditor } from "../SlotEditor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "İçerik Takvimi · Yuva" };

type Params = Promise<{ id: string }>;

// İçerik takvimi yuva ayrıntısı (v6.328, 2026-10-06) — kaynak seç · taslağı düzenle · PNG önizle · onayla. Yalnız ADMIN; veri sunucuda okunur,
// düzenleme/onay istemci bileşeninde (SlotEditor) /api/admin/icerik-takvimi'ye gider. Okuma sırası: oturum → rol → yuva (kapı önce, sorgu sonra).
export default async function ContentSlotPage({ params }: { params: Params }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/giris?next=/admin/icerik-takvimi/${id}`);
  if (user.role !== "ADMIN") redirect("/");

  const item = await getItem(id);
  if (!item) notFound();
  const series = seriesByKey(item.seriesKey);
  if (!series) notFound();

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <Link href={`/admin/icerik-takvimi?hafta=${weekStart(item.slotDay)}`} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--c-ink-2)] hover:text-[var(--c-accent)]">
        <ChevronLeft size={14} /> Haftaya dön
      </Link>
      <PageHeader
        className="mt-3"
        eyebrow={`${WEEKDAY_LONG[isoWeekday(item.slotDay) - 1]} · ${formatIsoDayTr(item.slotDay)}`}
        title={series.name}
        sub={`${series.sourceLabel}${series.approval === "legal" ? " · hukuk günü: alıntı bütünlüğü ve kimlik kapıları" : ""}`}
      />
      <SlotEditor initial={item} series={series} />
    </div>
  );
}
