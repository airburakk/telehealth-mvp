// ISO gün ("2026-10-08") → Türkçe uzun tarih ("8 Ekim 2026"). SAF; saat dilimi UTC (takvim/etkinlik dili ile aynı eksen —
// lib/calendar.ts başlığı: gün anahtarları UTC'dir, yerel saate çevrilirse gece yarısı kayması bir gün ileri/geri gösterir).
// Kullanım: Kariyer EDU son başvuru satırı · TUS dönem tablosu. Render'da `new Date(sabit)` saf sayılır (girdi deterministik).
export function formatIsoDayTr(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/**
 * Türkiye takvim günü (ISO, "2026-10-09"). "Son başvuru 8 Ekim" 8 Ekim TSİ gün sonuna dek açıktır; "geçti mi" karşılaştırması
 * bu eksende yapılır (UTC'de 21:00'de gün dönmesin). `now` parametreyle geçer → saf sınanır; varsayılanı VERİ katmanında
 * çağrılır (lib/edu-store · landing-feed), bileşen render'ında değil.
 */
export function todayIsoTr(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
