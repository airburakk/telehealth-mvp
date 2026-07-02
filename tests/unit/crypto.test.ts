// Birim testleri — lib/crypto.ts (E2EE Faz 1 at-rest envelope şifreleme). KEK env üstünden toggle edilir.
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { encryptField, decryptField, isEncrypted, decryptCaseFields } from "@/lib/crypto";

const ORIG_KEK = process.env.DATA_ENCRYPTION_KEK;
afterAll(() => {
  if (ORIG_KEK === undefined) delete process.env.DATA_ENCRYPTION_KEK;
  else process.env.DATA_ENCRYPTION_KEK = ORIG_KEK;
});

describe("KEK tanımsız (geliştirme passthrough)", () => {
  beforeAll(() => {
    delete process.env.DATA_ENCRYPTION_KEK;
  });
  it("encryptField düz metni değiştirmeden döndürür", () => {
    expect(encryptField("merhaba")).toBe("merhaba");
    expect(isEncrypted("merhaba")).toBe(false);
  });
  it("null/undefined/boş passthrough", () => {
    expect(encryptField(null)).toBeNull();
    expect(encryptField(undefined)).toBeUndefined();
    expect(encryptField("")).toBe("");
  });
});

describe("KEK tanımlı (at-rest şifreleme)", () => {
  const KEK = Buffer.alloc(32, 7).toString("base64"); // geçerli 32-byte anahtar
  beforeAll(() => {
    process.env.DATA_ENCRYPTION_KEK = KEK;
  });

  it("şifreler ve geri çözer (round-trip)", () => {
    const enc = encryptField("Ahmet Yılmaz");
    expect(enc.startsWith("enc:v1:")).toBe(true);
    expect(isEncrypted(enc)).toBe(true);
    expect(enc).not.toContain("Ahmet"); // ciphertext'te düz metin yok
    expect(decryptField(enc)).toBe("Ahmet Yılmaz");
  });

  it("her şifreleme farklı ciphertext üretir (rastgele DEK/IV)", () => {
    const a = encryptField("aynı metin");
    const b = encryptField("aynı metin");
    expect(a).not.toBe(b);
    expect(decryptField(a)).toBe(decryptField(b));
  });

  it("idempotent — zaten şifreli değer tekrar şifrelenmez (backfill güvenli)", () => {
    const enc = encryptField("x");
    expect(encryptField(enc)).toBe(enc);
  });

  it("decryptField düz metni (enc: ön-eksiz) aynen döndürür (kademeli geçiş)", () => {
    expect(decryptField("eski düz satır")).toBe("eski düz satır");
  });

  it("decryptCaseFields ilgili klinik alanları çözer", () => {
    const row = {
      patientName: encryptField("Mehmet"),
      symptoms: encryptField("baş ağrısı"),
      extra: null,
    };
    const dec = decryptCaseFields(row);
    expect(dec.patientName).toBe("Mehmet");
    expect(dec.symptoms).toBe("baş ağrısı");
  });

  it("geçersiz uzunlukta KEK hata verir", () => {
    const valid = process.env.DATA_ENCRYPTION_KEK;
    process.env.DATA_ENCRYPTION_KEK = Buffer.alloc(16, 1).toString("base64"); // 16 byte → geçersiz
    expect(() => encryptField("x")).toThrow(/32 byte/);
    process.env.DATA_ENCRYPTION_KEK = valid; // geri yükle
  });
});

// P0 #3 — üretimde KEK yoksa fail-closed (düz-metin PHI yazmaktansa throw). En sonda: NODE_ENV'i izole değiştirir.
describe("KEK tanımsız + ÜRETİM (fail-closed, P0 #3)", () => {
  beforeAll(() => {
    delete process.env.DATA_ENCRYPTION_KEK;
    vi.stubEnv("NODE_ENV", "production"); // tip-güvenli + izole
  });
  afterAll(() => {
    vi.unstubAllEnvs(); // izolasyon: sonraki testler etkilenmesin
  });
  it("içerik varken THROW eder (düz-metin yazımı engellenir)", () => {
    expect(() => encryptField("gerçek PHI")).toThrow(/DATA_ENCRYPTION_KEK|fail-closed|engellendi/);
  });
  it("null/boş üretimde de güvenli passthrough (şifrelenecek içerik yok)", () => {
    expect(encryptField(null)).toBeNull();
    expect(encryptField("")).toBe("");
  });
});
