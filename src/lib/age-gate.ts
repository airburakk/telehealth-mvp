// Hasta 18+ kapısı — OAuth yolu için kısa ömürlü "yaş kapısı geçildi" damgası (kod Paket D, 2026-09-19; A01 madde 3.2,
// 👤 S3). Sorun: Google/Apple ile kayıt formsuz açılır (callback → createPatientAccount), doğum tarihi sorulmaz.
// Doğum tarihi URL/state'e KONMAZ (kişisel veri URL'de taşınmaz, sunucu loglarına düşer). Çözüm: /kayit/hasta formu
// doğum tarihini POST /api/auth/age-gate'e verir; sunucu yaşı hesaplar, TARİHİ SAKLAMAZ, yalnız imzalı "geçildi"
// damgasını (exp + HMAC) httpOnly çerezle yazar (15 dk). OAuth dönüşü YENİ hasta hesabı açmadan önce bu damgayı ister;
// yoksa hesap açmaz, forma ?oauth=age ile döner. Mevcut hesabın girişi (intent=patient, /giris) ETKİLENMEZ — kapı
// yalnız HESAP AÇILIŞINDA. İmza anahtarı = SESSION_SECRET (lib/session sessionSecretKey; üretimde zayıf sır boot'u
// zaten durdurur). Damga yaş/tarih TAŞIMAZ; çalınsa bile tek söylediği "bu tarayıcı 15 dk içinde kapıyı geçti"dir.
import { createHmac, timingSafeEqual } from "crypto";
import { sessionSecretKey } from "./session";

export const AGE_GATE_COOKIE = "p_age_gate";
export const AGE_GATE_TTL_SEC = 15 * 60;

function sign(exp: number): string {
  return createHmac("sha256", Buffer.from(sessionSecretKey())).update(`age-gate:${exp}`).digest("base64url");
}

/** İmzalı damga: "<exp-unix-sn>.<hmac>". */
export function issueAgeGateToken(now: Date = new Date()): string {
  const exp = Math.floor(now.getTime() / 1000) + AGE_GATE_TTL_SEC;
  return `${exp}.${sign(exp)}`;
}

/** Damga geçerli mi? Süresi dolmuş, biçimsiz ya da imzası uymayan → false (fail-closed; sabit-zamanlı karşılaştırma). */
export function verifyAgeGateToken(token: string | undefined | null, now: Date = new Date()): boolean {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const exp = Number(token.slice(0, dot));
  const sig = token.slice(dot + 1);
  if (!Number.isInteger(exp) || !sig) return false;
  if (exp * 1000 <= now.getTime()) return false;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(exp));
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Çerez seçenekleri. sameSite "none": Apple dönüşü appleid.apple.com'dan CROSS-SITE form POST'tur — "lax" çerez o
 * istekte gönderilmez, kapı Apple'da hep kapalı kalırdı (a_oauth_* çerezleriyle aynı gerekçe). "none" → secure ŞART;
 * dev'de (http) tarayıcı secure çerezi yazmaz → dev'de lax (Apple yerelde zaten çalışmaz, Google lax ile döner).
 */
export function ageGateCookieOptions(maxAge: number = AGE_GATE_TTL_SEC) {
  const prod = process.env.NODE_ENV === "production";
  return { httpOnly: true, secure: prod, sameSite: (prod ? "none" : "lax") as "none" | "lax", path: "/", maxAge };
}
