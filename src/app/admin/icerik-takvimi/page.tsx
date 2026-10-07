import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { formatIsoDayTr, todayIsoTr } from "@/lib/iso-day";
import { listWeek } from "@/lib/social-calendar/plan";
import { SERIES, WEEKDAY_LONG, addDays, isDayString, isoWeekday, weekStart } from "@/lib/social-calendar/series";
import { STATUS_LABEL, type PlanStatus } from "@/lib/social-calendar/status";
import { PageHeader } from "@/components/ui/PageHeader";
import { AuraPanel } from "@/components/ui/AuraPanel";
import { OpenSlotButton } from "./OpenSlotButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "İçerik Takvimi" };

// İçerik takvimi (v6.328, 2026-10-06) — günlük seçki (omurga) AYNEN sürer; üstüne hafta içi "imza içerik" rubrikleri eklenir. Bu ekran haftanın
// yuvalarını gösterir; yuva satırı yalnız "Yuvayı aç" ile oluşur (GET'te YAZMA YOK). Yalnız ADMIN (admin/hukuki-ceviri deseni: proxy /admin'i korur,
// sayfa kendi kapısını çizer). /admin ağacı Doctorium kromundadır → yalnız --c-* token'ları, AURA'ya götüren bağlantı YOK.
// Faz 1 kapsamı: kaynak seçimi · taslak · onay · PNG önizleme. Yayın hattı (n8n) Faz 3 — onaylanan içerik şimdilik YAYINLANMAZ.
const STATUS_TONE: Record<PlanStatus, string> = {
  PLANNED: "border-[var(--c-hairline)] text-[var(--c-ink-3)]",
  DRAFT: "border-[var(--c-accent)]/40 text-[var(--c-accent)]",
  APPROVED: "border-[var(--c-success)]/40 text-[var(--c-success)]",
  PUBLISHING: "border-[var(--c-warn,#d97706)]/50 text-[var(--c-warn,#d97706)]",
  PUBLISHED: "border-[var(--c-success)]/40 text-[var(--c-success)]",
  SKIPPED: "border-[var(--c-hairline)] text-[var(--c-ink-3)]",
  FAILED: "border-[var(--c-danger)]/40 text-[var(--c-danger)]",
};

type SearchParams = Promise<{ hafta?: string }>;

export default async function ContentCalendarPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/admin/icerik-takvimi");
  if (user.role !== "ADMIN") redirect("/");

  const { hafta } = await searchParams;
  const today = todayIsoTr();
  const monday = weekStart(hafta && isDayString(hafta) ? hafta : today);
  const sunday = addDays(monday, 6);
  const slots = await listWeek(monday);
  const thisWeek = weekStart(today) === monday;

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <PageHeader
        eyebrow="Yönetim"
        title="İçerik Takvimi"
        sub="Günlük seçki her sabah olduğu gibi yayınlanır. Bu takvim, hafta içi belirli günlere ek 'imza içerik' (rubrik) yuvaları açar: kaynağı seçin, taslağı düzenleyin, PNG önizlemeye bakın ve onaylayın. Hukuk günü (Karar masası) için 'Doktor için çıkarım' sizin kaleminizdir; onay kapıları kimlik ve alıntı bütünlüğünü denetler."
      />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-[var(--c-ink-2)]">
          <span className="font-semibold text-[var(--c-ink)]">{formatIsoDayTr(monday)}</span> – {formatIsoDayTr(sunday)}
          {thisWeek && <span className="ml-2 rounded-full border border-[var(--c-accent)]/40 px-2 py-0.5 text-[11px] font-medium text-[var(--c-accent)]">bu hafta</span>}
        </div>
        <nav aria-label="Hafta gezinme" className="flex items-center gap-2 text-xs font-semibold">
          <Link href={`/admin/icerik-takvimi?hafta=${addDays(monday, -7)}`} className="inline-flex items-center gap-1 rounded-lg border border-[var(--c-hairline)] px-3 py-1.5 text-[var(--c-ink-2)] hover:border-[var(--c-accent)] hover:text-[var(--c-accent)]">
            <ChevronLeft size={14} /> Önceki
          </Link>
          {!thisWeek && (
            <Link href="/admin/icerik-takvimi" className="rounded-lg border border-[var(--c-hairline)] px-3 py-1.5 text-[var(--c-ink-2)] hover:border-[var(--c-accent)] hover:text-[var(--c-accent)]">
              Bu hafta
            </Link>
          )}
          <Link href={`/admin/icerik-takvimi?hafta=${addDays(monday, 7)}`} className="inline-flex items-center gap-1 rounded-lg border border-[var(--c-hairline)] px-3 py-1.5 text-[var(--c-ink-2)] hover:border-[var(--c-accent)] hover:text-[var(--c-accent)]">
            Sonraki <ChevronRight size={14} />
          </Link>
        </nav>
      </div>

      <ul className="mt-5 grid gap-3">
        {slots.map(({ series, slotDay, item }) => {
          const past = slotDay < today;
          return (
            <li key={series.key} className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="aura-mono text-[11px] uppercase tracking-[0.2em] text-[var(--c-ink-3)]">
                    {WEEKDAY_LONG[isoWeekday(slotDay) - 1]} · {formatIsoDayTr(slotDay)}
                    {slotDay === today && <span className="ml-2 text-[var(--c-accent)]">bugün</span>}
                  </div>
                  <h2 className="aura-display mt-1 text-lg font-medium tracking-tight text-[var(--c-ink)]">
                    {series.name}
                    {series.approval === "legal" && (
                      <span className="ml-2 rounded-full border border-[var(--c-hairline)] px-2 py-0.5 align-middle text-[10px] font-medium uppercase tracking-wider text-[var(--c-ink-2)]">hukuk · onay kapılı</span>
                    )}
                  </h2>
                  <div className="mt-0.5 text-xs text-[var(--c-ink-3)]">Kaynak: {series.sourceLabel}</div>
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${STATUS_TONE[item?.status ?? "PLANNED"]}`}>
                  {item ? STATUS_LABEL[item.status] : "Yuva açılmadı"}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 text-sm text-[var(--c-ink-2)]">
                  {item?.headline ? (
                    <>
                      <span className="text-[var(--c-ink)]">{item.headline}</span>
                      {item.status === "APPROVED" && item.approvedBy && <span className="ml-2 text-xs text-[var(--c-ink-3)]">· onaylayan: {item.approvedBy}</span>}
                    </>
                  ) : (
                    <span className="text-[var(--c-ink-3)]">{item ? "Henüz taslak yok." : past ? "Geçmiş gün — yuva açılmadı." : "Bu gün için henüz bir şey hazırlanmadı."}</span>
                  )}
                </div>
                {item ? (
                  <Link href={`/admin/icerik-takvimi/${item.id}`} className="shrink-0 text-xs font-semibold text-[var(--c-accent)] hover:underline">
                    {item.status === "APPROVED" || item.status === "PUBLISHING" || item.status === "PUBLISHED" || item.status === "FAILED" ? "Görüntüle" : "Düzenle"}
                  </Link>
                ) : (
                  <OpenSlotButton seriesKey={series.key} slotDay={slotDay} />
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <AuraPanel title="Rubrikler" meta="kayıt defteri · lib/social-calendar/series" className="mt-8" level="h2">
        <ul className="divide-y divide-[var(--c-hairline)] text-sm">
          {SERIES.map((s) => (
            <li key={s.key} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
              <span className="text-[var(--c-ink)]">
                {WEEKDAY_LONG[s.weekday - 1]} · {s.name}
              </span>
              <span className="text-xs text-[var(--c-ink-3)]">
                {s.sourceLabel} · {s.approval === "legal" ? "hukuk günü: alıntı + kimlik kapıları" : "hafif onay"} · {s.generator ? "aday ve taslak otomatik" : "taslak elle (üretici sonra)"}
              </span>
            </li>
          ))}
        </ul>
      </AuraPanel>

      <p className="mt-6 text-xs leading-relaxed text-[var(--c-ink-3)]">
        Otomatik yayın hattı (n8n) henüz kurulu değil: onaylı içeriği yuva sayfasından elle paylaşıp işaretleyin. Onaydan sonra içerik değiştirilirse onay düşer; yayın (elle ya da otomatik) yalnız onay mührüyle birebir eşleşen içeriği yayınlandı sayar.
      </p>
    </div>
  );
}
