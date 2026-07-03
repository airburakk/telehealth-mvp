// RFC 3161 onam-ispat — zaman damgası katmanı (dijital-onam-zaman-damgasi).
// Hash → güvenilir zaman + imza → token; bağımsız doğrulanabilir. Verinin belirli bir tarihte var olduğunu
// ve sonradan DEĞİŞMEDİĞİNİ ispatlar (KVKK/GDPR ispat yükümlülüğü, GDPR Art.7).
//
// ⚠️ ÜRETİM-TSA PARK (kullanıcı kararı 2026-06-22 + hukuk): aşağıdaki imzalayıcı yalnız MEKANİZMAYI
// gösteren bir SİMÜLE (yerel) zaman damgasıdır — sunucu sırrıyla HMAC; sunucu işleticisi kuramen
// zamanı değiştirebileceğinden BAĞIMSIZ/yasal-geçerli DEĞİLDİR. Gerçek RFC 3161 (freeTSA.org / TÜBİTAK
// BİLGEM Kamu SM / özel ESHS) `requestRfc3161Token` swap noktasından takılır (DER TimeStampReq/Resp).
import { createHash, createHmac, timingSafeEqual } from "crypto";

export const TSA_AUTHORITY = "SIMULATED-LOCAL (RFC 3161 placeholder)";

// Eski dev/demo sırrı — YENİ imzada kullanılmaz; yalnız bu sırla imzalanmış TARİHİ token'ların
// doğrulanması için tutulur (legacy köprüsü, aşağıda). Kod herkese açık olduğundan bu sırla atılan
// imzaların kanıt değeri zaten yoktu; güçlü sırra geçiş eski kayıtları "tamper" gibi göstermemeli.
const LEGACY_DEV_TSA_SECRET = "aura-dev-tsa-secret-not-for-production";

// Zaman damgası HMAC sırrı (P1 #8 ilk adım). ÜRETİMDE eksik/varsayılan/kısa ise BOOT DURUR
// (SESSION_SECRET/T4 ile aynı desen — herkese açık sabitle imzalanan "kanıt" token'ını engeller).
// Dev'de değer yoksa eski fallback + yüksek sesli uyarı (çalışan dev'i kırmaz).
// ⚠️ Deploy ön-koşulu: Vercel'de güçlü TSA_SECRET set olmalı (openssl rand -base64 32) — yerel
// .env ile AYNI değer; yoksa üretim boot'ta çöker — bu kasıtlı.
function resolveTsaSecret(): string {
  const s = process.env.TSA_SECRET;
  const weak = !s || s === LEGACY_DEV_TSA_SECRET || s.length < 16;
  if (weak) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "TSA_SECRET üretimde zorunlu ve güçlü olmalı (eksik/varsayılan/<16 karakter) — boot durduruldu. " +
        "Vercel ortam değişkenine `openssl rand -base64 32` çıktısı atayın (yerel .env ile aynı değer)."
      );
    }
    console.warn(
      "⚠️ TSA_SECRET eksik/zayıf — yalnız DEV fallback kullanılıyor (kanıt değeri yok). " +
      "ÜRETİMDE boot durur. .env'e güçlü bir TSA_SECRET ekleyin."
    );
    return LEGACY_DEV_TSA_SECRET;
  }
  return s;
}
const TSA_SECRET = resolveTsaSecret();

export function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export interface TimestampToken {
  authority: string;
  time: Date; // TSA'nın güvenilir zamanı
  token: string; // imzalı token (entryHash + time üzerinde)
}

// Bir veri hash'i için zaman damgası token'ı al. (SİMÜLE — gerçek RFC 3161 swap'ı için requestRfc3161Token.)
export function getTimestampToken(dataHashHex: string): TimestampToken {
  const time = new Date();
  const token = signToken(dataHashHex, time.toISOString());
  return { authority: TSA_AUTHORITY, time, token };
}

// Token doğrula: token, eldeki dataHash + kaydedilen zamandan yeniden üretilenle eşleşiyor mu?
// (Gerçek RFC 3161'de: token'daki TSA imzası + içindeki hash, veriden yeniden hesaplanan hash ile karşılaştırılır.)
// Legacy köprüsü: güçlü sırra geçişten ÖNCE yazılmış kayıtlar eski dev sırıyla imzalı — onlar da
// geçerli sayılır (yoksa tüm tarihî onam/audit token'ları yanlış "tamper" alarmı verir). Yeni imza
// her zaman güçlü sırla atılır; eski sır yalnız okuma yolunda denenir.
export function verifyTimestampToken(dataHashHex: string, time: Date, token: string): boolean {
  try {
    const iso = time.toISOString();
    if (tokenMatches(signToken(dataHashHex, iso), token)) return true;
    return TSA_SECRET !== LEGACY_DEV_TSA_SECRET &&
      tokenMatches(signTokenWith(LEGACY_DEV_TSA_SECRET, dataHashHex, iso), token);
  } catch {
    return false;
  }
}

function tokenMatches(expectedHex: string, tokenHex: string): boolean {
  const a = Buffer.from(expectedHex, "hex");
  const b = Buffer.from(tokenHex, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

// ── Zincir mührü v2 (audit + onam hash-zincirleri, P1 #8) ─────────────────────────────────────────
// v1 mühür anahtarsız sha256 idi → DB'ye yazma erişimi olan biri kaydı değiştirip mührü de "tamir"
// edebilirdi. v2: HMAC-SHA256(TSA_SECRET, domain + "\n" + canonical) → anahtar olmadan tamir imkânsız.
// Biçim: "v2:<kid>:<mac>" — kid = anahtarın SHA-256'sının ilk 8 hex'i (sır İFŞA ETMEZ; hangi anahtarla
// mühürlendiğini işaretler). Karma-ortam zincirlerinde (dev branch: yerel=güçlü sır, CI=dev fallback)
// doğrulayıcı bilmediği kid'i "bozuk" değil "bu ortamda doğrulanamaz" diye ayırt eder — sayaçla raporlanır.
function kidOf(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex").slice(0, 8);
}
const KID_CURRENT = kidOf(TSA_SECRET);

export type SealCheck = "valid" | "broken" | "unknown-key";

function sealMac(secret: string, domain: string, canonical: string): string {
  return createHmac("sha256", secret).update(`${domain}\n${canonical}`, "utf8").digest("hex");
}

// Kanonik metni etkin sırla mühürle → "v2:<kid>:<mac>".
export function chainSeal(domain: string, canonical: string): string {
  return `v2:${KID_CURRENT}:${sealMac(TSA_SECRET, domain, canonical)}`;
}

// v2 mühür doğrula. YALNIZ aktif ortam anahtarı kesin karar verebilir (valid/broken); diğer HER kid →
// "unknown-key" (görünür sayaçla raporlanır, "geçerli" SAYILMAZ). Halka-açık dev fallback sırrı burada
// bilerek doğrulayıcı DEĞİL: aksi halde DB-yazma erişimli saldırgan mührü o sırla yeniden basıp "valid"
// alırdı (adversarial inceleme bulgusu). Dev/CI ortamı zaten fallback'i AKTİF anahtar olarak kullanır →
// kendi yazdığını kendi doğrular; güçlü-anahtarlı ortam fallback-mühürlü satırı yalnız "unknown-key" görür.
export function verifyChainSeal(domain: string, canonical: string, seal: string): SealCheck {
  const m = /^v2:([0-9a-f]{8}):([0-9a-f]{64})$/.exec(seal);
  if (!m) return "broken";
  const [, kid, mac] = m;
  if (kid !== KID_CURRENT) return "unknown-key";
  try {
    return tokenMatches(sealMac(TSA_SECRET, domain, canonical), mac) ? "valid" : "broken";
  } catch {
    return "broken";
  }
}

export function isV2Seal(h: string | null | undefined): boolean {
  return !!h && h.startsWith("v2:");
}

function signToken(dataHashHex: string, isoTime: string): string {
  return signTokenWith(TSA_SECRET, dataHashHex, isoTime);
}

function signTokenWith(secret: string, dataHashHex: string, isoTime: string): string {
  return createHmac("sha256", secret).update(`${dataHashHex}|${isoTime}`, "utf8").digest("hex");
}

// 🔌 GERÇEK RFC 3161 SWAP NOKTASI (üretim — hukuk onayından sonra):
// async function requestRfc3161Token(dataHashHex: string): Promise<TimestampToken> {
//   // 1) DER-kodlu TimeStampReq oluştur (SHA-256 messageImprint) — örn. @peculiar/asn1-tsp
//   // 2) POST https://freetsa.org/tsr (veya TÜBİTAK BİLGEM) Content-Type application/timestamp-query
//   // 3) TimeStampResp token'ını (base64/DER) sakla; doğrulama TSA sertifika zinciriyle yapılır
//   throw new Error("RFC 3161 üretim TSA henüz bağlanmadı (üretim-TSA park).");
// }
