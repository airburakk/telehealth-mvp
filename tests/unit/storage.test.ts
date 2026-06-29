// Birim testleri — lib/storage.ts (T11 object storage soyutlaması). FALLBACK yolu (Blob token yok) test edilir.
// Gerçek Blob upload/download = entegrasyon (token + ağ gerekir, birim kapsamı dışı).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { storeDocument, loadDocument, isBlobRef, blobStorageEnabled } from "@/lib/storage";

const DATA = "data:text/plain;base64," + Buffer.from("merhaba dünya").toString("base64");
const ORIG_KEK = process.env.DATA_ENCRYPTION_KEK;
const ORIG_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

afterAll(() => {
  if (ORIG_KEK === undefined) delete process.env.DATA_ENCRYPTION_KEK;
  else process.env.DATA_ENCRYPTION_KEK = ORIG_KEK;
  if (ORIG_TOKEN === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
  else process.env.BLOB_READ_WRITE_TOKEN = ORIG_TOKEN;
});

describe("isBlobRef", () => {
  it("blob:v1: önekini tanır, diğerlerini değil", () => {
    expect(isBlobRef("blob:v1:https://x.blob/y")).toBe(true);
    expect(isBlobRef("data:text/plain;base64,AAA")).toBe(false);
    expect(isBlobRef("enc:v1:abc")).toBe(false);
    expect(isBlobRef(null)).toBe(false);
    expect(isBlobRef(undefined)).toBe(false);
  });
});

describe("blobStorageEnabled", () => {
  it("token yokken false", () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    expect(blobStorageEnabled()).toBe(false);
  });
  it("token varken true", () => {
    process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_TEST";
    expect(blobStorageEnabled()).toBe(true);
    delete process.env.BLOB_READ_WRITE_TOKEN;
  });
});

describe("fallback (Blob token yok) — KEK tanımsız → düz inline", () => {
  beforeAll(() => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.DATA_ENCRYPTION_KEK;
  });

  it("storeDocument düz metni inline döner, loadDocument geri verir", async () => {
    const ref = await storeDocument(DATA, { encrypt: true });
    expect(isBlobRef(ref)).toBe(false);
    expect(ref).toBe(DATA); // KEK yok → encryptField no-op
    expect(await loadDocument(ref, { encrypt: true })).toBe(DATA);
  });

  it("null girdi → null (her iki yön)", async () => {
    expect(await storeDocument(null)).toBeNull();
    expect(await loadDocument(null)).toBeNull();
    expect(await loadDocument(undefined)).toBeNull();
  });
});

describe("fallback (Blob token yok) — KEK tanımlı → şifreli inline", () => {
  beforeAll(() => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    process.env.DATA_ENCRYPTION_KEK = Buffer.alloc(32, 7).toString("base64");
  });

  it("storeDocument şifreli inline (enc:) döner, loadDocument round-trip eder", async () => {
    const ref = await storeDocument(DATA, { encrypt: true });
    expect(isBlobRef(ref)).toBe(false);
    expect(ref!.startsWith("enc:v1:")).toBe(true);
    expect(ref).not.toContain("base64"); // ciphertext'te düz data URI yok
    expect(await loadDocument(ref, { encrypt: true })).toBe(DATA);
  });

  it("encrypt:false → düz data URI saklar/okur", async () => {
    const ref = await storeDocument(DATA, { encrypt: false });
    expect(ref).toBe(DATA);
    expect(await loadDocument(ref, { encrypt: false })).toBe(DATA);
  });

  it("eski düz 'data:' satırı loadDocument'te no-op döner (kademeli geçiş)", async () => {
    expect(await loadDocument(DATA, { encrypt: true })).toBe(DATA); // enc: değil → decryptField no-op
  });
});
