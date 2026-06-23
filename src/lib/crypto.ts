// Uygulama-katmanı alan şifreleme — E2EE Faz 1 / increment 1 ([[hasta-verisi-uctan-uca-sifreleme]] §6.1).
// AES-256-GCM envelope: her kayıt için rastgele DEK (data encryption key); DEK, KEK (env master key) ile
// sarılır. Sunucu KEK'i tuttuğundan veriyi ÇÖZEBİLİR → "varsayılan sıfır-erişim" (saf sıfır-bilgi DEĞİL;
// §6.1 karar X). Kazanç = defense-in-depth: DB-dump sızıntısı + KEK'i tutmayan operatör/DBA düz metni göremez.
//
// Envelope biçimi (alanlar base64; ayraç ":" — base64 alfabesinde ":" yok → güvenli ayrışır):
//   enc:v1:<wrappedDEK>:<iv>:<tag>:<ct>
//     wrappedDEK = wrapIv(12) ‖ wrapTag(16) ‖ wrappedKey(32)   → DEK'in KEK ile AES-256-GCM sarımı
//     iv(12) · tag(16) · ct                                     → içeriğin DEK ile AES-256-GCM şifresi
//
// Kademeli geçiş (canlı-DB güvenli, sıfır kesinti): decryptField "enc:" ön-eki YOKSA düz metni aynen
// döndürür (eski satırlar / "" / null). Yeni yazımlar hep şifreli. Backfill: scripts/encrypt-existing.ts.
//
// ⚠️ KEK KAYBI = VERİ KAYBI. DATA_ENCRYPTION_KEK üretimde escrow/yedekli saklanmalı.
// ⚠️ Yerel + üretim AYNI Neon DB → KEK her ortamda AYNI değer olmalı (farklı KEK = çapraz çözememe).
//
// 🔌 KMS SWAP NOKTASI (üretim — vendor kararından sonra; timestamp.ts RFC 3161 swap deseni): yalnız DEK'in
// sarılması/açılması (wrapDek/unwrapDek) AWS KMS / GCP KMS / HSM çağrılarıyla değiştirilir. İçerik şifreleme
// (AES-256-GCM + per-record DEK) aynı kalır → DEK ham KEK yerine KMS'te sarılır, sunucu DEK'i RAM'de görür.
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const PREFIX = "enc:v1:";

let warnedNoKek = false;

// KEK'i tembel oku (build/import sırasında env yoksa patlamasın — yalnız gerçek encrypt/decrypt anında gerekir).
// 32-byte base64 bekler (`openssl rand -base64 32`).
function getKek(): Buffer | null {
  const raw = process.env.DATA_ENCRYPTION_KEK;
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("DATA_ENCRYPTION_KEK 32 byte (base64) olmalı — `openssl rand -base64 32` ile üretin.");
  }
  return key;
}

// DEK'i KEK ile sar (AES-256-GCM). 🔌 KMS swap noktası: bu iki fonksiyon KMS Encrypt/Decrypt ile değişir.
function wrapDek(dek: Buffer, kek: Buffer): Buffer {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", kek, iv);
  const ct = Buffer.concat([c.update(dek), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]); // 12 + 16 + 32 = 60 byte
}

function unwrapDek(wrapped: Buffer, kek: Buffer): Buffer {
  const d = createDecipheriv("aes-256-gcm", kek, wrapped.subarray(0, 12));
  d.setAuthTag(wrapped.subarray(12, 28));
  return Buffer.concat([d.update(wrapped.subarray(28)), d.final()]);
}

function encryptRaw(plain: string, kek: Buffer): string {
  const dek = randomBytes(32);
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", dek, iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  const fields = [wrapDek(dek, kek), iv, c.getAuthTag(), ct];
  return PREFIX + fields.map((b) => b.toString("base64")).join(":");
}

function decryptRaw(stored: string, kek: Buffer): string {
  const parts = stored.slice(PREFIX.length).split(":");
  if (parts.length !== 4) throw new Error("Bozuk şifreli alan biçimi (4 alan bekleniyordu).");
  const [wrapped, iv, tag, ct] = parts.map((p) => Buffer.from(p, "base64"));
  const dek = unwrapDek(wrapped, kek);
  const d = createDecipheriv("aes-256-gcm", dek, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}

/** Değer şifreli envelope mi (enc:v1: ön-ekli)? */
export function isEncrypted(v: string | null | undefined): boolean {
  return typeof v === "string" && v.startsWith(PREFIX);
}

// Yazımda çağır. null/undefined/"" → değişmeden döner; zaten şifreliyse aynen döner (idempotent → backfill güvenli).
// KEK yoksa düz metni döndürür + bir kez uyarır (yerel dev env'siz çalışsın diye; üretimde KEK set edilmeli).
export function encryptField(plain: string): string;
export function encryptField(plain: null): null;
export function encryptField(plain: undefined): undefined;
export function encryptField(plain: string | null): string | null;
export function encryptField(plain: string | null | undefined): string | null | undefined;
export function encryptField(plain: string | null | undefined): string | null | undefined {
  if (plain == null || plain === "" || plain.startsWith(PREFIX)) return plain;
  const kek = getKek();
  if (!kek) {
    if (!warnedNoKek) {
      console.warn("[crypto] DATA_ENCRYPTION_KEK tanımsız — alan DÜZ METİN saklanıyor (yalnız geliştirme; üretimde KEK şart).");
      warnedNoKek = true;
    }
    return plain;
  }
  return encryptRaw(plain, kek);
}

// Okumada çağır. "enc:" ön-eki yoksa aynen döner (eski düz satırlar / "" / null — kademeli geçiş).
// Şifreli veri var ama KEK yoksa → patlar (anahtar kaybı sessizce yutulmasın).
export function decryptField(stored: string): string;
export function decryptField(stored: null): null;
export function decryptField(stored: undefined): undefined;
export function decryptField(stored: string | null): string | null;
export function decryptField(stored: string | null | undefined): string | null | undefined;
export function decryptField(stored: string | null | undefined): string | null | undefined {
  if (stored == null || !stored.startsWith(PREFIX)) return stored;
  const kek = getKek();
  if (!kek) throw new Error("Şifreli veri var ama DATA_ENCRYPTION_KEK tanımsız — çözülemiyor (anahtar kayıp/yanlış ortam?).");
  return decryptRaw(stored, kek);
}
