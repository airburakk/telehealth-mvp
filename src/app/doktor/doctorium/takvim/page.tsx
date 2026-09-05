import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  doctorCalendarMonth, parseMonth, monthWindow, dayKey, CAL_KIND_LABEL, type CalendarItem,
} from "@/lib/calendar";
import { DoctoriumShell } from "../DoctoriumSidebar";
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Info, Star } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Takvim" };

/**
 * ETKİNLİK TAKVİMİ (kullanıcı isteği 2026-08-19) — rafın 08 durağı + Header menüsü "Takvimim".
 *
 * İçerik OTOMATİK: takip edilen etkinlikler (aralık) + bildiri/erken-kayıt son günleri —
 * lib/calendar.ts (ortak çekirdek; Aşama 2'de nöbet/icap planı AYNI sayfada aynı çekirdekten
 * gelecek — kind renk/etiket sözlüğü şimdiden tam). MVP'de elle kayıt formu YOK (kullanıcı
 * kararı: "takip edilenler otomatik").
 *
 * Erişim: Doctorium segment layout kapısı (Aşama 1 dahil). Personel (doctor'suz COORDINATOR/
 * ADMIN) sayfayı görür ama takvim kişisel — bilgi bandı çizilir (page-level rol kontrolü
 * derinlik savunması olarak durur).
 *
 * TARİH DİLİ: UTC gün anahtarları (lib/calendar.ts başlığı) — Pazartesi başlangıçlı ızgara.
 */
export default async function TakvimPage({
  searchParams,
}: {
  searchParams: Promise<{ ay?: string; gun?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "COORDINATOR", "ADMIN"].includes(user.role)) redirect("/");

  const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
  const doctorId = me?.doctorId ?? null;

  const sp = await searchParams;
  const { year, month } = parseMonth(sp.ay);
  const { start, end } = monthWindow(year, month);
  const items = doctorId ? await doctorCalendarMonth(doctorId, year, month) : [];

  // Gün → öğe haritası (çok günlü etkinlik kapsadığı HER güne yazılır; ızgara ay içini çizer).
  const byDay = new Map<string, CalendarItem[]>();
  for (const it of items) {
    const from = it.start < dayKey(start) ? dayKey(start) : it.start;
    const to = it.end > dayKey(endOfMonth(year, month)) ? dayKey(endOfMonth(year, month)) : it.end;
    for (let d = new Date(`${from}T00:00:00Z`); dayKey(d) <= to; d = addDays(d, 1)) {
      const k = dayKey(d);
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k)!.push(it);
    }
  }

  const today = dayKey(new Date());
  const selected = sp.gun && /^\d{4}-\d{2}-\d{2}$/.test(sp.gun) ? sp.gun : null;
  const selectedItems = selected ? (byDay.get(selected) ?? []) : [];

  // Izgara hücreleri: ay öncesi boşluk (Pazartesi başlangıç) + ayın günleri.
  const firstWeekday = (start.getUTCDay() + 6) % 7; // 0=Pzt … 6=Paz
  const daysInMonth = Math.round((end.getTime() - start.getTime()) / 86400000);
  const monthLabel = start.toLocaleDateString("tr-TR", { month: "long", year: "numeric", timeZone: "UTC" });
  const prev = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
  const next = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;

  return (
    <DoctoriumShell active="takvim">
      <div className="mx-auto max-w-3xl px-5 py-8">
        <Link href="/doktor/doctorium?m=etkinlik" className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-ink)]">
          <ArrowLeft size={15} /> Etkinlik Takvimi
        </Link>

        <div className="mt-5">
          <div className="aura-mono text-[11px] font-bold tracking-[0.16em] text-[var(--c-accent)]">TAKVİM</div>
          <h1 className="aura-display mt-1 text-3xl font-medium tracking-tight text-[var(--c-ink)]">Takvimim</h1>
          <p className="mt-1 text-[13px] text-[var(--c-ink-2)]">
            Takip ettiğiniz etkinlikler, bildiri ve erken kayıt son tarihleriyle — kendiliğinden.
          </p>
        </div>

        {!doctorId && (
          <p className="mt-6 flex items-start gap-2 rounded-2xl border border-dashed border-[var(--c-hairline)] bg-[var(--c-surface)] px-4 py-6 text-sm text-[var(--c-ink-2)]">
            <Info size={16} className="mt-0.5 shrink-0" />
            <span>Takvim kişiseldir ve doktor hesabına bağlıdır — bu hesapta doktor profili yok.</span>
          </p>
        )}

        {/* ── Ay gezinmesi ── */}
        <div className="mt-6 flex items-center justify-between rounded-t-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-3 py-2">
          <Link href={`/doktor/doctorium/takvim?ay=${prev}`} aria-label="Önceki ay"
            className="grid h-8 w-8 place-items-center rounded-lg text-[var(--c-ink-2)] hover:bg-[var(--c-surface-2)] hover:text-[var(--c-ink)]">
            <ChevronLeft size={16} />
          </Link>
          <div className="flex items-baseline gap-3">
            <h2 className="aura-display text-lg font-medium capitalize text-[var(--c-ink)]">{monthLabel}</h2>
            <Link href="/doktor/doctorium/takvim" className="aura-mono text-[10px] font-semibold tracking-wider text-[var(--c-ink-3)] hover:text-[var(--c-ink)]">
              BUGÜN
            </Link>
          </div>
          <Link href={`/doktor/doctorium/takvim?ay=${next}`} aria-label="Sonraki ay"
            className="grid h-8 w-8 place-items-center rounded-lg text-[var(--c-ink-2)] hover:bg-[var(--c-surface-2)] hover:text-[var(--c-ink)]">
            <ChevronRight size={16} />
          </Link>
        </div>

        {/* ── Izgara ── */}
        <div className="overflow-hidden rounded-b-2xl border-x border-b border-[var(--c-hairline)] bg-[var(--c-surface)]">
          <div className="grid grid-cols-7 border-b border-[var(--c-hairline)]">
            {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map((d, i) => (
              <div key={d} className={`aura-mono px-1 py-1.5 text-center text-[10px] font-semibold tracking-wider ${i >= 5 ? "text-[var(--c-ink-3)]/70" : "text-[var(--c-ink-3)]"}`}>
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: firstWeekday }, (_, i) => (
              <div key={`b${i}`} className="min-h-[72px] border-b border-e border-[var(--c-hairline)]/50 bg-[var(--c-bg)]/40" />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const k = dayKey(new Date(Date.UTC(year, month - 1, i + 1)));
              const dayItems = byDay.get(k) ?? [];
              const isToday = k === today;
              const isSel = k === selected;
              return (
                <Link
                  key={k}
                  href={`/doktor/doctorium/takvim?ay=${year}-${String(month).padStart(2, "0")}&gun=${k}`}
                  aria-label={`${i + 1} ${monthLabel}${dayItems.length ? ` — ${dayItems.length} kayıt` : ""}`}
                  className={`min-h-[72px] border-b border-e border-[var(--c-hairline)]/50 p-1 transition-colors hover:bg-[var(--c-surface-2)] ${
                    isSel ? "bg-[var(--c-surface-2)] shadow-[inset_0_0_0_1px_var(--c-accent)]" : ""
                  }`}
                >
                  <span
                    className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-semibold ${
                      isToday ? "bg-[var(--c-accent)] text-[var(--c-bg)]" : "text-[var(--c-ink-2)]"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="mt-0.5 block space-y-0.5">
                    {dayItems.slice(0, 2).map((it) => (
                      <span key={it.key} className={`block truncate rounded px-1 text-[9.5px] font-semibold leading-4 ${KIND_CHIP[it.kind]}`}>
                        {it.title}
                      </span>
                    ))}
                    {dayItems.length > 2 && (
                      <span className="aura-mono block px-1 text-[9px] text-[var(--c-ink-3)]">+{dayItems.length - 2}</span>
                    )}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* ── Seçili gün listesi ── */}
        {selected && (
          <section className="mt-4 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-4 py-3.5">
            <h3 className="aura-mono text-[11px] font-bold tracking-[0.16em] text-[var(--c-ink-3)]">
              {new Date(`${selected}T00:00:00Z`).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", weekday: "long", timeZone: "UTC" }).toLocaleUpperCase("tr-TR")}
            </h3>
            {selectedItems.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--c-ink-2)]">Bu günde kayıt yok.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {selectedItems.map((it) => (
                  <li key={it.key} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className={`aura-mono rounded-full px-2 py-0.5 text-[10px] font-semibold ${KIND_CHIP[it.kind]}`}>
                      {CAL_KIND_LABEL[it.kind]}
                    </span>
                    {it.href ? (
                      <Link href={it.href} className="text-[var(--c-ink)] hover:underline">{it.title}</Link>
                    ) : (
                      <span className="text-[var(--c-ink)]">{it.title}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* ── Boş durum / açıklama ── */}
        {doctorId && items.length === 0 && (
          <p className="mt-4 flex items-start gap-2 rounded-2xl border border-dashed border-[var(--c-hairline)] bg-[var(--c-surface)] px-4 py-6 text-sm text-[var(--c-ink-2)]">
            <CalendarDays size={16} className="mt-0.5 shrink-0" />
            <span>
              Bu ayda takvim kaydınız yok. Takvim, <strong className="text-[var(--c-ink)]">takip ettiğiniz</strong>{" "}
              etkinliklerden kendiliğinden oluşur —{" "}
              <Link href="/doktor/doctorium?m=etkinlik" className="underline hover:text-[var(--c-ink)]">
                Etkinlik sekmesinden
              </Link>{" "}
              <Star size={11} className="inline -mt-0.5" /> Takip et demeniz yeterli.
            </span>
          </p>
        )}
      </div>
    </DoctoriumShell>
  );
}

/** Tür → çip stili (gece güvenli açık tonlar; gündüz güvencesi Tailwind sınıf-yakalayıcısında).
 *  nobet/icap/kisisel Aşama-2'de aynı sözlükten renklenecek. */
const KIND_CHIP: Record<CalendarItem["kind"], string> = {
  etkinlik: "bg-emerald-500/15 text-emerald-300",
  bildiri: "bg-sky-500/15 text-sky-300",
  "erken-kayit": "bg-violet-500/15 text-violet-300",
  nobet: "bg-rose-500/15 text-rose-300",
  icap: "bg-amber-500/15 text-amber-300",
  kisisel: "bg-[var(--c-surface-2)] text-[var(--c-ink-2)]",
};

function endOfMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 0));
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000);
}
