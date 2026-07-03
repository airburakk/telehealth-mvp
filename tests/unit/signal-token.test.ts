// Birim testleri — lib/signal-token.ts (P1: sinyalleşme taraf-token'ı HMAC).
// Güvenlik-kritik: token'ın side'ı yanlış dönerse video handshake bozulur → tam kapsam.
import { describe, it, expect } from "vitest";
import { issueSideToken, verifySideToken } from "@/lib/signal-token";

const U = "user-1";
const CH = "chan-abc";
const NOW = 1_780_000_000_000;

describe("signal-token (taraf-token HMAC)", () => {
  it("round-trip: üret → aynı user/channel/now'da doğrula → side döner", () => {
    const tok = issueSideToken(U, CH, "doctor", NOW);
    expect(verifySideToken(tok, U, CH, NOW)).toBe("doctor");
    expect(verifySideToken(issueSideToken(U, CH, "patient", NOW), U, CH, NOW)).toBe("patient");
  });

  it("başka KULLANICI token'ı reddedilir (A'nın token'ı B'de geçmez)", () => {
    const tok = issueSideToken(U, CH, "doctor", NOW);
    expect(verifySideToken(tok, "user-2", CH, NOW)).toBeNull();
  });

  it("başka KANAL token'ı reddedilir (kanaldan kanala taşınmaz)", () => {
    const tok = issueSideToken(U, CH, "doctor", NOW);
    expect(verifySideToken(tok, U, "chan-xyz", NOW)).toBeNull();
  });

  it("süresi geçmiş token reddedilir (TTL 60 sn)", () => {
    const tok = issueSideToken(U, CH, "doctor", NOW);
    expect(verifySideToken(tok, U, CH, NOW + 60_000 - 1)).toBe("doctor"); // sınırdan hemen önce geçerli
    expect(verifySideToken(tok, U, CH, NOW + 60_000 + 1)).toBeNull(); // süre dolmuş
  });

  it("MAC tamper'ı reddedilir (son karakter değiştirilir)", () => {
    const tok = issueSideToken(U, CH, "doctor", NOW);
    const flipped = tok.slice(0, -1) + (tok.endsWith("0") ? "1" : "0");
    expect(verifySideToken(flipped, U, CH, NOW)).toBeNull();
  });

  it("side taklidi imkânsız: geçerli mac'li token'da side elle değiştirilirse mac tutmaz", () => {
    const tok = issueSideToken(U, CH, "patient", NOW); // "patient.exp.mac"
    const parts = tok.split(".");
    const forged = `doctor.${parts[1]}.${parts[2]}`; // side'ı doctor'a çevir, mac aynı
    expect(verifySideToken(forged, U, CH, NOW)).toBeNull();
  });

  it("bozuk/eksik girdiler güvenli reddedilir", () => {
    expect(verifySideToken(null, U, CH, NOW)).toBeNull();
    expect(verifySideToken(undefined, U, CH, NOW)).toBeNull();
    expect(verifySideToken("", U, CH, NOW)).toBeNull();
    expect(verifySideToken("düz-metin", U, CH, NOW)).toBeNull();
    expect(verifySideToken("a.b", U, CH, NOW)).toBeNull(); // 2 parça
    expect(verifySideToken("admin.9999999999999.deadbeef", U, CH, NOW)).toBeNull(); // geçersiz side
    expect(verifySideToken("doctor.notanumber.abcd", U, CH, NOW)).toBeNull(); // exp NaN
  });
});
