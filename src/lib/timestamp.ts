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

// Demo/dev sırrı; üretimde gerçek TSA kullanılacağı için bu yalnız mekanizma doğrulaması içindir.
const TSA_SECRET = process.env.TSA_SECRET || "aura-dev-tsa-secret-not-for-production";

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
export function verifyTimestampToken(dataHashHex: string, time: Date, token: string): boolean {
  try {
    const expected = signToken(dataHashHex, time.toISOString());
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(token, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function signToken(dataHashHex: string, isoTime: string): string {
  return createHmac("sha256", TSA_SECRET).update(`${dataHashHex}|${isoTime}`, "utf8").digest("hex");
}

// 🔌 GERÇEK RFC 3161 SWAP NOKTASI (üretim — hukuk onayından sonra):
// async function requestRfc3161Token(dataHashHex: string): Promise<TimestampToken> {
//   // 1) DER-kodlu TimeStampReq oluştur (SHA-256 messageImprint) — örn. @peculiar/asn1-tsp
//   // 2) POST https://freetsa.org/tsr (veya TÜBİTAK BİLGEM) Content-Type application/timestamp-query
//   // 3) TimeStampResp token'ını (base64/DER) sakla; doğrulama TSA sertifika zinciriyle yapılır
//   throw new Error("RFC 3161 üretim TSA henüz bağlanmadı (üretim-TSA park).");
// }
