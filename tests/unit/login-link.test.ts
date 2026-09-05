// Parolasız giriş bağlantısı token sözleşmesi (üç katman Faz A3, 2026-09-05) — lib/login-link.ts saf kısmı.
// password-reset.test.ts'in eşleniği; ek olarak GÜVENLİK SINIRI kilitlenir: bağlantı yalnız parolasız
// DOCTOR hesabına oturum açar (parolalı hesapta posta kutusu = anında erişim OLMAZ).
import { describe, it, expect } from "vitest";
import {
  hashLoginToken, loginTokenMatches, loginLinkCooldownActive, canUseLoginLink,
  LOGIN_LINK_TTL_MS, LOGIN_LINK_COOLDOWN_MS,
} from "@/lib/login-link";
import { RESET_TOKEN_TTL_MS } from "@/lib/password-reset";

const TOKEN = "c".repeat(64);
const now = new Date("2026-09-05T12:00:00.000Z");
const rowFor = (token: string, sentAt: Date | null) => ({
  loginTokenHash: token ? hashLoginToken(token) : null,
  loginTokenSentAt: sentAt,
});

describe("giriş bağlantısı — süre sözleşmesi", () => {
  it("TTL 20 dakika ve parola sıfırlamanın 1 saatinden KISA (bağlantı oturum açar)", () => {
    expect(LOGIN_LINK_TTL_MS).toBe(20 * 60 * 1000);
    expect(LOGIN_LINK_TTL_MS).toBeLessThan(RESET_TOKEN_TTL_MS);
  });
  it("taze token eşleşir; süresi dolmuş token REDDEDİLİR", () => {
    expect(loginTokenMatches(rowFor(TOKEN, now), TOKEN, now)).toBe(true);
    expect(loginTokenMatches(rowFor(TOKEN, new Date(now.getTime() - LOGIN_LINK_TTL_MS - 1)), TOKEN, now)).toBe(false);
    expect(loginTokenMatches(rowFor(TOKEN, new Date(now.getTime() - LOGIN_LINK_TTL_MS + 1000)), TOKEN, now)).toBe(true);
  });
});

describe("giriş bağlantısı — eşleşme sözleşmesi", () => {
  it("yanlış, kısa ve boş token reddedilir", () => {
    expect(loginTokenMatches(rowFor(TOKEN, now), "d".repeat(64), now)).toBe(false);
    expect(loginTokenMatches(rowFor(TOKEN, now), "kisa", now)).toBe(false);
    expect(loginTokenMatches(rowFor(TOKEN, now), "", now)).toBe(false);
  });
  it("kullanılmış (hash null) ya da tarihsiz satır reddedilir — tek kullanımlık bunun üstünde durur", () => {
    expect(loginTokenMatches({ loginTokenHash: null, loginTokenSentAt: now }, TOKEN, now)).toBe(false);
    expect(loginTokenMatches({ loginTokenHash: hashLoginToken(TOKEN), loginTokenSentAt: null }, TOKEN, now)).toBe(false);
  });
  it("DB'de ham token DEĞİL sha256 hash'i yaşar", () => {
    expect(hashLoginToken(TOKEN)).not.toBe(TOKEN);
    expect(hashLoginToken(TOKEN)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("soğuma penceresi", () => {
  it("2 dk içinde ikinci bağlantı gitmez, sonra gider; hiç gönderilmemişse soğuma yok", () => {
    expect(LOGIN_LINK_COOLDOWN_MS).toBe(2 * 60 * 1000);
    expect(loginLinkCooldownActive(new Date(now.getTime() - 30_000), now)).toBe(true);
    expect(loginLinkCooldownActive(new Date(now.getTime() - LOGIN_LINK_COOLDOWN_MS - 1), now)).toBe(false);
    expect(loginLinkCooldownActive(null, now)).toBe(false);
  });
});

describe("canUseLoginLink — güvenlik sınırı (yalnız parolasız DOCTOR, silinmemiş)", () => {
  it("parolasız doktor → bağlantı oturum açar", () => {
    expect(canUseLoginLink({ role: "DOCTOR", passwordSetAt: null, deletedAt: null })).toBe(true);
  });
  it("PAROLALI doktor → HAYIR (posta kutusu anında erişim olmaz — reset-password kararıyla tutarlı)", () => {
    expect(canUseLoginLink({ role: "DOCTOR", passwordSetAt: new Date("2026-09-01"), deletedAt: null })).toBe(false);
  });
  it("hasta / personel / silinmiş kabuk → HAYIR", () => {
    expect(canUseLoginLink({ role: "PATIENT", passwordSetAt: null, deletedAt: null })).toBe(false);
    expect(canUseLoginLink({ role: "ADMIN", passwordSetAt: null, deletedAt: null })).toBe(false);
    expect(canUseLoginLink({ role: "DOCTOR", passwordSetAt: null, deletedAt: new Date("2026-09-01") })).toBe(false);
  });
});
