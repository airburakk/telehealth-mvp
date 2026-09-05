// ORTAK TAKVİM ÇEKİRDEĞİ (kullanıcı kararı 2026-08-19): Doctorium etkinlik takvimi BUGÜN,
// AURA Aşama-2 nöbet/icap PLANI yarın — ikisi de bu katmandan okur ("ortak database").
//
// İki kaynak birleşir:
//   1) TAKİP EDİLEN ETKİNLİKLER — CongressFollow'dan TÜRETİLİR (kopya kayıt YOK: takip
//      zaten kaynak; kopyalamak senkron derdi doğururdu — kullanıcı kararı "otomatik").
//      Etkinliğin tarih aralığı + BİLDİRİ son günü + ERKEN KAYIT son günü ayrı işaretler
//      (deadline'lar etkinliğin kendisinden aylar önce olabilir — kendi günlerine düşer).
//   2) CalendarEntry TABLOSU — nöbet/icap/kişisel kayıtların evi (şema hazır; migration
//      `20260820010000_takvim_calendar_entry`). ⚠️ Birleşim aşağıda BİLİNÇLİ KAPALI:
//      dev ortamında migration + `prisma generate` henüz koşulmadı (paralel oturum v6.124
//      ara durumu); tablo/client hazır olunca işaretli bloğu açmak yeterli.
//
// TARİH DİLİ: gün anahtarları UTC ("YYYY-MM-DD") — MedicalCongress tarihleri UTC-fmt'li
// (etkinlik detayı toLocaleDateString(timeZone:"UTC") basar); takvim aynı eksende kalır,
// yoksa gece yarısı kayması etkinliği bir gün ileri/geri gösterir.
import { db } from "./db";
import { followedCongressIds } from "./doctorium";
import { tusCalendarItems } from "./tus";

export interface CalendarItem {
  /** Liste key'i — kaynak+id+tür (aynı etkinlik 3 türde görünebilir). */
  key: string;
  kind: "etkinlik" | "bildiri" | "erken-kayit" | "nobet" | "icap" | "kisisel" | "tus";
  title: string;
  /** Detay bağlantısı (etkinlik kartı vb.); kişisel/nöbet kayıtlarında olmayabilir. */
  href?: string;
  /** Kapsadığı İLK gün (UTC, YYYY-MM-DD). */
  start: string;
  /** Kapsadığı SON gün (tek günlükte start ile aynı). */
  end: string;
}

export const CAL_KIND_LABEL: Record<CalendarItem["kind"], string> = {
  etkinlik: "Etkinlik",
  bildiri: "Bildiri son gönderim",
  "erken-kayit": "Erken kayıt son tarih",
  nobet: "Nöbet",
  icap: "İcap nöbeti",
  kisisel: "Kişisel",
  // T1 (2026-09-05): TUS başvuru/sınav/sonuç günleri — öğrencide daima, doktorda Özelleştir "Kariyer içinde TUS" açıksa.
  tus: "TUS",
};

/** UTC gün anahtarı. */
export function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** "YYYY-MM" doğrula/çöz — geçersizse bugünün ayı (UTC). */
export function parseMonth(raw?: string | null): { year: number; month: number } {
  const m = raw && /^\d{4}-\d{2}$/.test(raw) ? raw : new Date().toISOString().slice(0, 7);
  const [y, mo] = m.split("-").map(Number);
  // Ay 1-12 dışına taşan elle-yazılmış URL bugüne düşer (bozuk link boş takvim açmasın).
  if (mo < 1 || mo > 12) return parseMonth(null);
  return { year: y, month: mo };
}

/** Ay penceresi [ilk gün 00:00, sonraki ay ilk günü) — UTC. */
export function monthWindow(year: number, month: number): { start: Date; end: Date } {
  return { start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 1)) };
}

/**
 * Doktorun bir aylık takvimi. Ay penceresiyle KESİŞEN her öğe döner (aralık taşanlar dahil —
 * ızgara kırpar). Sıralama: başlangıç günü, sonra tür (etkinlik > son tarihler).
 */
export async function doctorCalendarMonth(
  doctorId: string, year: number, month: number, opts: { includeTus?: boolean } = {},
): Promise<CalendarItem[]> {
  const { start, end } = monthWindow(year, month);
  const followed = await followedCongressIds(doctorId);
  const items: CalendarItem[] = [];

  if (followed.size) {
    const ids = [...followed];
    const rows = await db.medicalCongress.findMany({
      where: {
        id: { in: ids },
        // Pencereyle kesişim: (etkinlik aralığı) VEYA (bildiri/erken-kayıt günü) ay içinde.
        OR: [
          { startDate: { lt: end }, endDate: { gte: start } },
          { startDate: { gte: start, lt: end }, endDate: null },
          { abstractDeadline: { gte: start, lt: end } },
          { earlyBirdDeadline: { gte: start, lt: end } },
        ],
      },
      select: {
        id: true, title: true, startDate: true, endDate: true,
        abstractDeadline: true, earlyBirdDeadline: true,
      },
      orderBy: { startDate: "asc" },
    });
    for (const c of rows) {
      const href = `/doktor/doctorium/etkinlik/${c.id}`;
      // Etkinlik aralığı pencereye değiyorsa (deadline eşleşmesiyle gelmiş olabilir — koşulu yeniden sına)
      const evStart = c.startDate;
      const evEnd = c.endDate ?? c.startDate;
      if (evStart < end && evEnd >= start) {
        items.push({ key: `ev-${c.id}`, kind: "etkinlik", title: c.title, href, start: dayKey(evStart), end: dayKey(evEnd) });
      }
      if (c.abstractDeadline && c.abstractDeadline >= start && c.abstractDeadline < end) {
        const k = dayKey(c.abstractDeadline);
        items.push({ key: `ab-${c.id}`, kind: "bildiri", title: c.title, href, start: k, end: k });
      }
      if (c.earlyBirdDeadline && c.earlyBirdDeadline >= start && c.earlyBirdDeadline < end) {
        const k = dayKey(c.earlyBirdDeadline);
        items.push({ key: `eb-${c.id}`, kind: "erken-kayit", title: c.title, href, start: k, end: k });
      }
    }
  }

  // ── CalendarEntry birleşimi (nöbet/icap/kişisel) — AÇIK (migration + generate 2026-08-19
  // indi). MVP'de tabloya yazan yok (etkinlikler türetme); Aşama 2 nöbet/icap planı yazmaya
  // başladığında görünüm kendiliğinden dolar.
  const entries = await db.calendarEntry.findMany({
    where: { doctorId, startAt: { lt: end }, OR: [{ endAt: { gte: start } }, { endAt: null, startAt: { gte: start } }] },
    orderBy: { startAt: "asc" },
  });
  for (const e of entries) {
    const kind = e.kind === "NOBET" ? "nobet" : e.kind === "ICAP" ? "icap" : "kisisel";
    items.push({ key: `ce-${e.id}`, kind, title: e.title, start: dayKey(e.startAt), end: dayKey(e.endAt ?? e.startAt) });
  }

  // T1 (2026-09-05): TUS dönem tablosundan (lib/tus, ÖSYM kaynaklı) başvuru aralığı + sınav + sonuç günleri. Pencere
  // [start, end) — end ayın ilk günü (dışlayıcı); tus.ts de aynı yarı-açık aralığı kullanır.
  if (opts.includeTus) items.push(...tusCalendarItems(dayKey(start), dayKey(end)));

  return items;
}
