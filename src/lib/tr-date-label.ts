// "2026-10-02" → "2 Ekim 2026" — Türkçe tarih etiketi (SAF; ICU/Intl'e bağlı DEĞİL, ay adları sabit tablo).
// v6.315'te `doctorium-secki/view.ts` içindeydi; v6.317'de seçki ucundaki `summaryLong` yedek cümlesi de kullandığı için
// ortak modüle taşındı (çekirdek lib, sayfa görünüm modeline bağımlı olmasın). `view.ts` geriye uyum için yeniden dışa aktarır.
const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"] as const;

/** "2026-10-02" → "2 Ekim 2026". Biçimsiz girdi olduğu gibi döner (sayfa/uç çökmesin). */
export function trDateLabel(day: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return day;
  const month = AYLAR[Number(m[2]) - 1];
  return month ? `${Number(m[3])} ${month} ${m[1]}` : day;
}
