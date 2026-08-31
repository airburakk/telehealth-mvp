// Parola sıfırlama token sözleşmesi (v6.194) — lib/password-reset.ts saf fonksiyonları.
//
// Kilitlenenler (hepsi güvenlik davranışı, süs değil):
//   1) Hash DB'de, ham token yalnız bağlantıda → eşleşme sha256 üzerinden ve SABİT ZAMANLI.
//   2) TTL 1 saat — doğrulama e-postasının 24 saatinden KISA (sıfırlama bağlantısı hesabı
//      devralmaya yeter). Süresi dolmuş token kabul EDİLMEZ.
//   3) Hash null (kullanılmış/hiç istenmemiş) → DAİMA reddedilir; tek kullanımlık bunun üstünde.
//   4) Soğuma penceresi: aynı hesaba art arda e-posta yağmuru olmaz.
import { describe, it, expect } from "vitest";
import {
  hashResetToken,
  resetTokenMatches,
  resetCooldownActive,
  RESET_TOKEN_TTL_MS,
  RESET_COOLDOWN_MS,
} from "@/lib/password-reset";

const TOKEN = "a".repeat(64);
const now = new Date("2026-08-31T12:00:00.000Z");
const rowFor = (token: string, sentAt: Date | null) => ({
  passwordResetTokenHash: token ? hashResetToken(token) : null,
  passwordResetSentAt: sentAt,
});

describe("sıfırlama token'ı — süre sözleşmesi", () => {
  it("TTL 1 saat ve doğrulama e-postasının TTL'inden KISA", () => {
    expect(RESET_TOKEN_TTL_MS).toBe(60 * 60 * 1000);
    expect(RESET_TOKEN_TTL_MS).toBeLessThan(24 * 60 * 60 * 1000);
  });

  it("taze token eşleşir", () => {
    expect(resetTokenMatches(rowFor(TOKEN, now), TOKEN, now)).toBe(true);
  });

  it("süresi dolmuş token REDDEDİLİR", () => {
    const sent = new Date(now.getTime() - RESET_TOKEN_TTL_MS - 1000);
    expect(resetTokenMatches(rowFor(TOKEN, sent), TOKEN, now)).toBe(false);
  });

  it("sınırın hemen içi kabul, hemen dışı ret", () => {
    const icerde = new Date(now.getTime() - RESET_TOKEN_TTL_MS + 1000);
    const disarda = new Date(now.getTime() - RESET_TOKEN_TTL_MS - 1);
    expect(resetTokenMatches(rowFor(TOKEN, icerde), TOKEN, now)).toBe(true);
    expect(resetTokenMatches(rowFor(TOKEN, disarda), TOKEN, now)).toBe(false);
  });
});

describe("sıfırlama token'ı — eşleşme sözleşmesi", () => {
  it("YANLIŞ token reddedilir", () => {
    expect(resetTokenMatches(rowFor(TOKEN, now), "b".repeat(64), now)).toBe(false);
  });

  it("KULLANILMIŞ token (hash null) reddedilir — tek kullanımlık bunun üstünde durur", () => {
    expect(resetTokenMatches({ passwordResetTokenHash: null, passwordResetSentAt: now }, TOKEN, now)).toBe(false);
  });

  it("zaman damgası yoksa reddedilir (yarım durum güvenli tarafa düşer)", () => {
    expect(resetTokenMatches({ passwordResetTokenHash: hashResetToken(TOKEN), passwordResetSentAt: null }, TOKEN, now)).toBe(false);
  });

  it("farklı UZUNLUKTAKİ girdi çökertmez, reddeder (timingSafeEqual uzunluk şartı)", () => {
    expect(resetTokenMatches(rowFor(TOKEN, now), "kısa", now)).toBe(false);
    expect(resetTokenMatches(rowFor(TOKEN, now), "", now)).toBe(false);
  });

  it("hash ham token'ı SIZDIRMAZ (DB'de duran değer token'ın kendisi değildir)", () => {
    const h = hashResetToken(TOKEN);
    expect(h).not.toBe(TOKEN);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("yeniden-gönder soğuması", () => {
  it("pencere içinde aktif, dışında değil", () => {
    expect(resetCooldownActive(new Date(now.getTime() - 1000), now)).toBe(true);
    expect(resetCooldownActive(new Date(now.getTime() - RESET_COOLDOWN_MS - 1), now)).toBe(false);
  });

  it("hiç gönderilmemişse soğuma yok", () => {
    expect(resetCooldownActive(null, now)).toBe(false);
  });
});
