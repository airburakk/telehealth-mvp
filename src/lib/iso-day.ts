// ISO gün ("2026-10-08") → Türkçe uzun tarih ("8 Ekim 2026"). SAF; saat dilimi UTC (takvim/etkinlik dili ile aynı eksen —
// lib/calendar.ts başlığı: gün anahtarları UTC'dir, yerel saate çevrilirse gece yarısı kayması bir gün ileri/geri gösterir).
// Kullanım: Kariyer EDU son başvuru satırı · TUS dönem tablosu. Render'da `new Date(sabit)` saf sayılır (girdi deterministik).
export function formatIsoDayTr(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
