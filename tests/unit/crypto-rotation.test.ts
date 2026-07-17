// Birim testleri — lib/crypto rewrapEnvelope (KEK rotasyonu, gate 4).
// Sözleşme: içerik (iv/tag/ct) AYNEN korunur, yalnız DEK sarımı değişir; yanlış eski-KEK
// asla sessizce yazılabilir bir değer üretmez (GCM auth hatasıyla fırlar).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { randomBytes } from "crypto";
import { encryptField, decryptField, rewrapEnvelope, kekFromBase64, isEncrypted } from "@/lib/crypto";

const KEK_A_B64 = randomBytes(32).toString("base64");
const KEK_B_B64 = randomBytes(32).toString("base64");
const KEK_A = kekFromBase64(KEK_A_B64);
const KEK_B = kekFromBase64(KEK_B_B64);

beforeEach(() => vi.stubEnv("DATA_ENCRYPTION_KEK", KEK_A_B64));
afterEach(() => vi.unstubAllEnvs());

describe("rewrapEnvelope — KEK rotasyonu", () => {
  it("A ile şifrelenen, A→B rotasyonundan sonra B ile çözülür; içerik parçaları AYNEN kalır", () => {
    const plain = "hasta semptom metni — rotasyonda asla çözülmemeli";
    const stored = encryptField(plain);
    expect(isEncrypted(stored)).toBe(true);

    const rotated = rewrapEnvelope(stored, KEK_A, KEK_B);
    // Biçim: enc:v1:<wrapped>:<iv>:<tag>:<ct> → ":" ile bölününce içerik = 3..5 indeksleri.
    const [, , wWrapped, wIv, wTag, wCt] = stored.split(":");
    const [, , rWrapped, rIv, rTag, rCt] = rotated.split(":");
    expect([rIv, rTag, rCt]).toEqual([wIv, wTag, wCt]); // içerik dokunulmadı kanıtı
    expect(rWrapped).not.toBe(wWrapped); // sarım değişti (rotasyonun kendisi)

    vi.stubEnv("DATA_ENCRYPTION_KEK", KEK_B_B64);
    expect(decryptField(rotated)).toBe(plain);
  });

  it("rotasyondan sonra ESKİ anahtar artık açamaz (rotasyon gerçekten anahtar değiştirir)", () => {
    const rotated = rewrapEnvelope(encryptField("x"), KEK_A, KEK_B);
    expect(() => decryptField(rotated)).toThrow(); // env hâlâ A
  });

  it("yanlış eski-KEK ile rewrap FIRLATIR (sessiz bozulma yok)", () => {
    const stored = encryptField("y");
    expect(() => rewrapEnvelope(stored, KEK_B, KEK_A)).toThrow();
  });

  it("no-op rewrap (aynı anahtar, açılış testi idiomu) çalışır — rotate-kek 'already' tespiti buna dayanır", () => {
    const rotated = rewrapEnvelope(encryptField("z"), KEK_A, KEK_A);
    expect(decryptField(rotated)).toBe("z");
  });

  it("envelope olmayan girdi ve bozuk biçim reddedilir", () => {
    expect(() => rewrapEnvelope("duz metin", KEK_A, KEK_B)).toThrow();
    expect(() => rewrapEnvelope("enc:v1:yalniz:uc:parca", KEK_A, KEK_B)).toThrow();
  });

  it("kekFromBase64 32 byte zorunluluğunu uygular", () => {
    expect(() => kekFromBase64(Buffer.from("kisa").toString("base64"))).toThrow();
    expect(kekFromBase64(KEK_A_B64).length).toBe(32);
  });
});
