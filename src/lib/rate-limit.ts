// Hafif, in-memory rate limiter (T12 — kötüye kullanım/maliyet freni).
// ⚠️ EN İYİ-ÇABA: Vercel serverless'te her instance AYRI bellek tutar → instance'lar arası
// koordine OLMAZ (yalnız sıcak instance'a gelen hızlı patlamayı sınırlar). Üretimde dağıtık/atomik
// limit için Upstash Redis (@upstash/ratelimit) önerilir — swap noktası burası.
import { NextResponse } from "next/server";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

// Sabit pencere sayacı. Pencere dolunca sıfırlanır. Bellek sınırlı tutulur (süresi geçmiş kovalar budanır).
export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  if (buckets.size > 5000) for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count++;
  if (b.count > limit) return { ok: false, retryAfter: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
  return { ok: true, retryAfter: 0 };
}

// İstemci IP'si (proxy başlıklarından). Anahtar üretimi için.
export function clientIp(req: Request): string {
  const h = req.headers;
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

// 429 yanıtı kısayolu (Retry-After saniye cinsinden).
export function tooMany(retryAfter: number): NextResponse {
  return NextResponse.json(
    { error: `Çok fazla istek — lütfen ${retryAfter} sn sonra tekrar deneyin.` },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}
