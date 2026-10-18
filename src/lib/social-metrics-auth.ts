// /api/social-metrics Bearer kapısı — anahtar ayıklama + sabit zamanlı karşılaştırma (sunucu-yalnız: node:crypto).
//
// v6.353 (👤 2026-10-18): ilk canlı gönderim 401 aldı — n8n Header Auth değeri ile Vercel env'i birebir aynı değildi
// (iki değer de maskeli; en olası nedenler: "Bearer " öneki eksik ya da yapıştırmada kalan boşluk/satır sonu). Kapı bu
// yüzden İKİ yazım hatasına toleranslıdır, güvenliği düşürmeden:
//   · baştaki/sondaki boşluk ve satır sonu kırpılır (başlıkta da env'de de),
//   · "Bearer " öneki büyük-küçük harf duyarsız ve İSTEĞE BAĞLIdır (yalın anahtar da kabul edilir; env'e yanlışlıkla
//     "Bearer …" yazılmışsa o da ayıklanır).
// Anahtarın KENDİSİ yine birebir ve sabit zamanlı eşleşmek zorundadır; boş anahtar hiçbir zaman eşleşmez.
import { timingSafeEqual } from "node:crypto";

const BEARER = /^bearer\s+/i;

/** Ham başlık/env değerinden anahtarı ayıklar: kırp → isteğe bağlı "Bearer " önekini at → kırp. */
export function normalizeSocialToken(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  return BEARER.test(t) ? t.replace(BEARER, "").trim() : t;
}

/** İstek başlığı env anahtarıyla eşleşiyor mu (sabit zamanlı; ikisi de normalize edilir). */
export function socialTokenMatches(authorizationHeader: string | null | undefined, secret: string | null | undefined): boolean {
  const given = normalizeSocialToken(authorizationHeader);
  const want = normalizeSocialToken(secret);
  if (!given || !want) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}
