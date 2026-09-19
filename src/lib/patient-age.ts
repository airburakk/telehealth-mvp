// Hasta üyeliği 18+ kapısı (kod Paket D, 2026-09-19 — A01 madde 3.2 / 12 · A02 madde 3.1, 👤 S3 12.09.2026):
// Platform 18 yaşını doldurmuş kişilere açıktır; kayıtta doğum tarihi BEYANI alınır, SAKLANMAZ ve loglanmaz —
// yalnız kayıt anında yaş hesaplanır. 18 altı fail-closed reddedilir; veli/vasi akışı (A14) AÇILMAZ (👤 ayrı karar).
// lib/student-age.ts (Doctorium öğrenci kapısı, v6.212) ile AYNI saf hesap; sınır ayrı sabit (iki ürünün kuralı
// bağımsız evrilebilsin). Saf ve istemci-güvenli: PatientSignupForm anlık geri bildirim için, api/auth/signup-patient
// ve OAuth dönüşleri (lib/age-gate çerezi üzerinden) ASIL kapı olarak kullanır.
import { hasReachedAge, maxBirthDateFor, parseBirthDate } from "./student-age";

export const MIN_PATIENT_AGE = 18;

/** Beyan edilen doğum tarihiyle 18 yaş dolmuş mu? (fail-closed: biçimsiz/geçersiz/gelecek → false) */
export function isAdultPatient(birthDate: string, now: Date = new Date()): boolean {
  return hasReachedAge(birthDate, MIN_PATIENT_AGE, now);
}

/** Tarih seçicinin üst sınırı: bugün 18'ini dolduran en genç kişinin doğum günü (YYYY-AA-GG). */
export function maxPatientBirthDate(now: Date = new Date()): string {
  return maxBirthDateFor(MIN_PATIENT_AGE, now);
}

/** Biçim denetimi (sunucu 400 mesajı "tarih girin" ile "18 altı" ayrımı için). */
export function isValidBirthDate(birthDate: string): boolean {
  return parseBirthDate(birthDate) !== null;
}

/** Kullanıcıya gösterilen ret metni — TR kanonik; EN ikinci kanonik (S4). */
export const UNDERAGE_MESSAGE = {
  tr: "AURA 18 yaşını doldurmuş kişilere açıktır. 18 yaşından küçük bir hasta için yasal temsilcisinin kendi adına başvurması da kabul edilmez.",
  en: "AURA is open to people aged 18 and over. A legal representative may not apply on their own behalf for a patient under 18.",
} as const;
