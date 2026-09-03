// Öğrenci üyeliği yaş kapısı (v6.212, 2026-09-03 — belge 07 §A.1, 👤 karar 03.09.2026: 18 yaş altı
// KABUL EDİLMEZ). Saf ve istemci-güvenli (db yok): StudentGateForm anlık geri bildirim için,
// api/auth/signup-student ASIL kapı olarak kullanır. Beyan edilen doğum tarihi SAKLANMAZ ve loglanmaz —
// yalnız kayıt anında yaş hesaplanır (KVKK minimizasyonu; envanter 17'de yeni veri kategorisi açılmaz).
// Yanlış beyan riski üyeye aittir (07 §A.1); beyana dayalı tespitin sınırı bilinerek kabul edildi.

export const MIN_STUDENT_AGE = 18;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** YYYY-AA-GG → UTC gün. Biçimsiz, takvimde olmayan (30 Şubat) ya da 1900 öncesi tarih → null. */
export function parseBirthDate(s: string): Date | null {
  const m = ISO_DATE.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  if (y < 1900) return null;
  const dt = new Date(Date.UTC(y, mo, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo && dt.getUTCDate() === d ? dt : null;
}

/**
 * `now` itibarıyla `minAge` yaşını doldurmuş mu? Fail-closed: geçersiz/gelecek tarih → false.
 * 29 Şubat doğumlu, artık olmayan yılda 1 Mart'ta doldurur (Date.UTC ay taşması bunu doğal verir).
 */
export function hasReachedAge(birthDate: string, minAge: number, now: Date = new Date()): boolean {
  const bd = parseBirthDate(birthDate);
  if (!bd) return false;
  const cutoff = Date.UTC(now.getUTCFullYear() - minAge, now.getUTCMonth(), now.getUTCDate());
  return bd.getTime() <= cutoff;
}

/** Tarih seçicinin üst sınırı: bugün `minAge` yaşını dolduran en genç kişinin doğum günü (YYYY-AA-GG). */
export function maxBirthDateFor(minAge: number, now: Date = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear() - minAge, now.getUTCMonth(), now.getUTCDate())).toISOString().slice(0, 10);
}
