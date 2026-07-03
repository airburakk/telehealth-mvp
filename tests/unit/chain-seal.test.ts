// Birim testleri — lib/timestamp.ts zincir mührü v2 (P1 #8: keyed-HMAC + kid + unknown-key politikası).
// TSA_SECRET modül yükünde çözüldüğünden testler mevcut ortam sırıyla (dev fallback veya .env) çalışır —
// davranış her iki durumda da aynıdır (mühürle → doğrula kendi anahtarıyla tutarlı).
import { describe, it, expect } from "vitest";
import { chainSeal, verifyChainSeal, isV2Seal } from "@/lib/timestamp";

const DOMAIN = "audit-entry";
const canonical = JSON.stringify(["actor-1", "ADMIN", "CASE_VIEW", "CASE", "c1", null, "detay", "1.2.3.4", null, "2026-07-03T10:00:00.000Z", "GENESIS"]);

describe("zincir mührü v2 (chainSeal/verifyChainSeal)", () => {
  it("biçim: v2:<kid8>:<mac64> + isV2Seal", () => {
    const seal = chainSeal(DOMAIN, canonical);
    expect(seal).toMatch(/^v2:[0-9a-f]{8}:[0-9a-f]{64}$/);
    expect(isV2Seal(seal)).toBe(true);
    expect(isV2Seal("a".repeat(64))).toBe(false); // v1 çıplak hex
    expect(isV2Seal(null)).toBe(false);
  });

  it("round-trip: mühürle → aynı kanonikle doğrula → valid", () => {
    const seal = chainSeal(DOMAIN, canonical);
    expect(verifyChainSeal(DOMAIN, canonical, seal)).toBe("valid");
  });

  it("kanonik değişirse (tamper) → broken", () => {
    const seal = chainSeal(DOMAIN, canonical);
    const tampered = canonical.replace("detay", "TAMPERED");
    expect(verifyChainSeal(DOMAIN, tampered, seal)).toBe("broken");
  });

  it("domain ayrımı: aynı kanonik farklı domain'de doğrulanmaz (audit mührü onam mührü yerine geçemez)", () => {
    const seal = chainSeal(DOMAIN, canonical);
    expect(verifyChainSeal("consent-entry", canonical, seal)).toBe("broken");
  });

  it("mac bozulursa → broken; biçim bozuksa → broken", () => {
    const seal = chainSeal(DOMAIN, canonical);
    const [v, kid, mac] = seal.split(":");
    const flipped = mac.endsWith("0") ? mac.slice(0, -1) + "1" : mac.slice(0, -1) + "0";
    expect(verifyChainSeal(DOMAIN, canonical, `${v}:${kid}:${flipped}`)).toBe("broken");
    expect(verifyChainSeal(DOMAIN, canonical, "v2:zzzz:kısa")).toBe("broken");
    expect(verifyChainSeal(DOMAIN, canonical, "düz-metin")).toBe("broken");
  });

  it("bilinmeyen kid → unknown-key (bozuk DEĞİL — başka ortamın anahtarı)", () => {
    const seal = chainSeal(DOMAIN, canonical);
    const mac = seal.split(":")[2];
    // kid'i bilinmeyen bir değere çevir (geçerli biçim, tanınmayan anahtar kimliği)
    expect(verifyChainSeal(DOMAIN, canonical, `v2:00000000:${mac}`)).toBe("unknown-key");
  });
});
