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
// Ortam ayrımı (Faz 5 Ray B2, 2026-07-16): yerel .env Neon DEVELOPMENT branch'ine + dev'e özgü KEK'e
// bakar; üretim KEK'i yalnız Vercel'de ve PROD_* önekli bilinçli işlemlerde. Yanlış ortam anahtarıyla
// okuma = decrypt hatası (aşağıdaki küme alarmı bunu yakalar).
//
// 🔌 KMS SWAP NOKTASI (üretim — vendor kararından sonra; timestamp.ts RFC 3161 swap deseni): yalnız DEK'in
// sarılması/açılması (wrapDek/unwrapDek) AWS KMS / GCP KMS / HSM çağrılarıyla değiştirilir. İçerik şifreleme
// (AES-256-GCM + per-record DEK) aynı kalır → DEK ham KEK yerine KMS'te sarılır, sunucu DEK'i RAM'de görür.
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { sendAlert, noteDecryptFailure } from "./alerts";

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

// ── KEK ROTASYONU (gate 4, 2026-07-17) ──────────────────────────────────────────────────────────
// Envelope tasarımının karşılığı: içerik DEK ile şifreli, DEK KEK ile sarılı → rotasyon yalnız
// SARIMI değiştirir (unwrap eski KEK → wrap yeni KEK); iv/tag/ct'ye DOKUNULMAZ, içerik hiç
// çözülmez (DEK yalnız RAM'de anlık görünür — normal okuma yolundakiyle aynı maruziyet).
// Kullanan: scripts/rotate-kek.ts (dry-run + prova runbook'u vault [[sir-envanteri]] §3).

/** base64 KEK dizesini doğrulayıp Buffer'a çevir (32 byte şartı — getKek ile aynı kural). */
export function kekFromBase64(raw: string): Buffer {
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("KEK 32 byte (base64) olmalı — `openssl rand -base64 32`.");
  return key;
}

/**
 * Envelope'un DEK sarımını eski KEK'ten yeni KEK'e taşı. İçerik (iv/tag/ct) aynen korunur.
 * Yanlış eski-KEK → unwrapDek GCM auth hatasıyla fırlatır (yanlış anahtarla asla yazılmaz).
 * Dönüş, yeni KEK ile doğrulanmış sarımdır (yazmadan önce ters-kontrol içeride yapılır).
 */
export function rewrapEnvelope(stored: string, oldKek: Buffer, newKek: Buffer): string {
  if (!stored.startsWith(PREFIX)) throw new Error("rewrapEnvelope yalnız enc:v1: envelope kabul eder.");
  const parts = stored.slice(PREFIX.length).split(":");
  if (parts.length !== 4) throw new Error("Bozuk şifreli alan biçimi (4 alan bekleniyordu).");
  const [wrapped, iv, tag, ct] = parts;
  const dek = unwrapDek(Buffer.from(wrapped, "base64"), oldKek);
  const rewrapped = wrapDek(dek, newKek);
  // Yazım öncesi ters-kontrol: yeni sarım yeni KEK ile açılıyor ve AYNI DEK'i veriyor mu?
  if (!unwrapDek(rewrapped, newKek).equals(dek)) {
    throw new Error("rewrap ters-kontrolü başarısız — yazım iptal (beklenmeyen durum).");
  }
  return PREFIX + [rewrapped.toString("base64"), iv, tag, ct].join(":");
}

// Yazımda çağır. null/undefined/"" → değişmeden döner; zaten şifreliyse aynen döner (idempotent → backfill güvenli).
// KEK yoksa: ÜRETİMDE fail-closed (throw — düz-metin PHI yazmaktansa yazımı durdur, P0 #3); dev/test'te
// düz metni döndürür + bir kez uyarır (yerel env'siz çalışsın diye). Üretimde KEK her zaman set edilmeli.
export function encryptField(plain: string): string;
export function encryptField(plain: null): null;
export function encryptField(plain: undefined): undefined;
export function encryptField(plain: string | null): string | null;
export function encryptField(plain: string | null | undefined): string | null | undefined;
export function encryptField(plain: string | null | undefined): string | null | undefined {
  if (plain == null || plain === "" || plain.startsWith(PREFIX)) return plain;
  const kek = getKek();
  if (!kek) {
    // Üretimde KEK zorunlu — yoksa PHI'yi DÜZ METİN yazmak yerine YAZIMI DURDUR (fail-closed, P0 #3).
    // Aksi halde bir env kayması (rotasyon/secret kazası) o penceredeki tüm klinik kayıtları sessizce
    // kalıcı düz-metin yapar ve "enc:" öneki olmadığından sonradan fark edilmez.
    if (process.env.NODE_ENV === "production") {
      // SEV-1 (Ray C): üretimde şifreleme anahtarı erişilemez → anında alarm (yazım zaten durdu).
      void sendAlert("kek-missing", "Üretimde DATA_ENCRYPTION_KEK tanımsız — klinik yazım durduruldu (SEV-1)", "encryptField fail-closed");
      throw new Error(
        "[crypto] DATA_ENCRYPTION_KEK üretimde tanımsız — klinik alan şifrelenemedi; düz-metin yazımı engellendi (fail-closed). Vercel ortam değişkenini ayarlayın.",
      );
    }
    if (!warnedNoKek) {
      console.warn("[crypto] DATA_ENCRYPTION_KEK tanımsız — alan DÜZ METİN saklanıyor (yalnız geliştirme; üretimde KEK şart).");
      warnedNoKek = true;
    }
    return plain;
  }
  return encryptRaw(plain, kek);
}

// Bir Case nesnesinin klinik serbest-metin alanlarını (varsa) yerinde çözer — full-case fetch sınırlarında
// tek çağrı (E2EE Faz 1 inc.2). Select-sınırlı fetch'lerde alan undefined → atlanır (güvenli no-op).
// Açık helper (Prisma-extension DEĞİL): her çağrı görünür/denetlenebilir.
// inc.2c: patientName de eklendi (kimlik şifreleme). Hepsi düz-metin passthrough → KEK öncesi/şifresiz no-op.
// FAZ 8 (2026-07-10): patientPhone eklendi (hasta iletişim — kimlik verisi, intake'lerde toplanır).
type CaseClinical = Partial<Record<"symptoms" | "reasoning" | "extra" | "patientName" | "patientIdentifier" | "patientPhone" | "dischargeReport" | "dischargeStructured", string | null>>;
export function decryptCaseFields<T extends CaseClinical>(c: T): T;
export function decryptCaseFields<T extends CaseClinical>(c: T | null | undefined): T | null | undefined;
export function decryptCaseFields<T extends CaseClinical>(c: T | null | undefined): T | null | undefined {
  if (c == null) return c;
  const out = { ...c };
  if (typeof out.patientName === "string") out.patientName = decryptField(out.patientName);
  if (typeof out.patientIdentifier === "string") out.patientIdentifier = decryptField(out.patientIdentifier);
  if (typeof out.patientPhone === "string") out.patientPhone = decryptField(out.patientPhone);
  if (typeof out.symptoms === "string") out.symptoms = decryptField(out.symptoms);
  if (typeof out.reasoning === "string") out.reasoning = decryptField(out.reasoning);
  if (out.extra != null) out.extra = decryptField(out.extra);
  if (typeof out.dischargeReport === "string") out.dischargeReport = decryptField(out.dischargeReport);
  if (typeof out.dischargeStructured === "string") out.dischargeStructured = decryptField(out.dischargeStructured);
  return out;
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
  if (!kek) {
    // SEV-1 (Ray C): şifreli veri var ama anahtar erişilemez (kayıp KEK / yanlış ortam) → anında alarm.
    void sendAlert("kek-missing", "Şifreli veri var ama DATA_ENCRYPTION_KEK tanımsız — okuma çözülemiyor (SEV-1)", "decryptField");
    throw new Error("Şifreli veri var ama DATA_ENCRYPTION_KEK tanımsız — çözülemiyor (anahtar kayıp/yanlış ortam?).");
  }
  try {
    return decryptRaw(stored, kek);
  } catch (e) {
    // Tek tük hata bozuk satır olabilir; KISA PENCEREDE KÜME = yanlış KEK/ortam → alerts.ts eşikte tek alarm.
    noteDecryptFailure("decryptField");
    throw e;
  }
}
