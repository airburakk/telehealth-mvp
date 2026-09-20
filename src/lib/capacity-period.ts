// Aylık kapasite dönemi (kontrol raporu 2026-09-17 D08, v6.284) — saf modül.
//
// Eskiden doktor profilindeki "Aylık Kapasite 29/20" TÜM ZAMANLARIN tamamlanan görüşme sayısını aylık kapasiteye
// bölüyordu: dönem yoktu, aşım açıklanmıyordu. Artık dönem = Türkiye saatiyle içinde bulunulan takvim ayı; sayı yalnız
// o ayda biten görüşmeler; kapasite planlama içindir — aşım görüşmeyi ENGELLEMEZ, yalnız etiketlenir.
import { TR_TZ } from "@/lib/appointment-window";

export type CapacityPeriod = { label: string; start: Date; end: Date };

/** Türkiye saatiyle `now`'un takvim ayı: [start, end) UTC anları + "Eylül 2026" etiketi. */
export function capacityPeriod(now: Date | number): CapacityPeriod {
  const d = typeof now === "number" ? new Date(now) : now;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TR_TZ, year: "numeric", month: "numeric" }).formatToParts(d);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value); // 1-12
  // TR = UTC+3 sabit (2016'dan beri yaz saati yok) → ay başı 00:00 TSİ = önceki gün 21:00 UTC
  const start = new Date(Date.UTC(y, m - 1, 1, -3, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 1, -3, 0, 0, 0));
  const label = new Intl.DateTimeFormat("tr-TR", { timeZone: TR_TZ, month: "long", year: "numeric" }).format(d);
  return { label, start, end };
}

export type CapacityUsage = { period: CapacityPeriod; used: number; capacity: number; overflow: number; percent: number };

/** Dönem içinde biten görüşmeleri sayar; aşım = kapasiteyi aşan miktar (0 = aşım yok). */
export function capacityUsage(ended: readonly { endedAt: Date | null; startedAt: Date }[], capacity: number, now: Date | number): CapacityUsage {
  const period = capacityPeriod(now);
  const used = ended.filter((c) => {
    const t = (c.endedAt ?? c.startedAt).getTime();
    return t >= period.start.getTime() && t < period.end.getTime();
  }).length;
  const cap = Math.max(0, capacity);
  const overflow = Math.max(0, used - cap);
  const percent = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : used > 0 ? 100 : 0;
  return { period, used, capacity: cap, overflow, percent };
}
