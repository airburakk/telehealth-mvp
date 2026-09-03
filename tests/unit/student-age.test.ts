// Öğrenci yaş kapısı (v6.212 — belge 07 §A.1, 👤 03.09.2026: 18 yaş altı kabul edilmez).
// Saf sözleşme: sınır, gün hassasiyeti, fail-closed girdi, artık yıl. Tarih SAKLANMAZ — burada yalnız hesap.
import { describe, it, expect } from "vitest";
import { hasReachedAge, parseBirthDate, maxBirthDateFor, MIN_STUDENT_AGE } from "@/lib/student-age";

const NOW = new Date("2026-09-03T12:00:00Z");

describe("öğrenci yaş kapısı", () => {
  it("sınır 18 (belge 07 §A.1)", () => {
    expect(MIN_STUDENT_AGE).toBe(18);
  });
  it("tam 18. yaş günü → geçer; bir gün eksik → geçmez (gün hassasiyeti)", () => {
    expect(hasReachedAge("2008-09-03", 18, NOW)).toBe(true);
    expect(hasReachedAge("2008-09-04", 18, NOW)).toBe(false);
    expect(hasReachedAge("1990-01-01", 18, NOW)).toBe(true);
  });
  it("fail-closed: boş, biçimsiz, takvimde olmayan, gelecek, 1900 öncesi → false", () => {
    for (const s of ["", "03.09.2008", "2008-02-30", "2030-01-01", "1899-12-31", "2008-9-3", "abc"]) {
      expect(hasReachedAge(s, 18, NOW), s).toBe(false);
    }
  });
  it("29 Şubat doğumlu: artık olmayan yılda 1 Mart'ta doldurur", () => {
    expect(hasReachedAge("2008-02-29", 18, new Date("2026-02-28T12:00:00Z"))).toBe(false);
    expect(hasReachedAge("2008-02-29", 18, new Date("2026-03-01T12:00:00Z"))).toBe(true);
  });
  it("parseBirthDate geçerli tarihi UTC gün olarak verir, geçersizi null", () => {
    expect(parseBirthDate("2000-01-31")?.toISOString()).toBe("2000-01-31T00:00:00.000Z");
    expect(parseBirthDate(" 2000-01-31 ")?.toISOString()).toBe("2000-01-31T00:00:00.000Z");
    expect(parseBirthDate("2000-02-30")).toBeNull();
    expect(parseBirthDate("2000-13-01")).toBeNull();
  });
  it("maxBirthDateFor: tarih seçici üst sınırı = bugünün 18 yıl öncesi", () => {
    expect(maxBirthDateFor(18, NOW)).toBe("2008-09-03");
  });
});
