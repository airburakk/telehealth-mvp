// Rate limiter (T12 — kötüye kullanım/maliyet freni).
// v4.18: Upstash Redis BİRİNCİL (dağıtık/atomik — instance'lar arası koordine; serverless'ta gerçek limit),
// in-memory YEDEK (env yoksa VEYA Upstash hatasında fail-open: kesinti login'i kilitlemesin, en-iyi-çaba korur).
// Semantik her iki yolda AYNI: sabit pencere (INCR + PEXPIRE), pencere dolunca sıfırlanır.
import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

type Verdict = { ok: boolean; retryAfter: number };

// ── Upstash istemcisi (REST; anahtar yoksa null → dormant, in-memory çalışır) ──
// Env adları: Upstash console/Vercel Marketplace = UPSTASH_REDIS_REST_*; eski Vercel KV = KV_REST_API_*.
const restUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const restToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const redis = restUrl && restToken ? new Redis({ url: restUrl, token: restToken }) : null;

// Tek round-trip, atomik sabit-pencere: sayacı artır, ilk vuruşta pencereyi başlat, kalan TTL'i dön.
const WINDOW_LUA = `local c = redis.call("INCR", KEYS[1])
if c == 1 then redis.call("PEXPIRE", KEYS[1], ARGV[1]) end
local t = redis.call("PTTL", KEYS[1])
return {c, t}`;

// ── In-memory yedek (eski T12 davranışı birebir) ──
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function rateLimitMemory(key: string, limit: number, windowMs: number): Verdict {
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

// Sabit pencere sayacı — v4.18'den beri ASYNC (Upstash ağ çağrısı). Çağıran: `const rl = await rateLimit(...)`.
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<Verdict> {
  if (redis) {
    try {
      const [count, ttl] = (await redis.eval(WINDOW_LUA, [`rl:${key}`], [String(windowMs)])) as [number, number];
      if (count > limit) return { ok: false, retryAfter: Math.max(1, Math.ceil((ttl > 0 ? ttl : windowMs) / 1000)) };
      return { ok: true, retryAfter: 0 };
    } catch (e) {
      // Fail-open: Upstash erişilemezse istekleri KİLİTLEME; in-memory en-iyi-çaba devam eder.
      console.warn("rate-limit: Upstash hatası — in-memory yedeğe düşüldü:", e instanceof Error ? e.message : e);
    }
  }
  return rateLimitMemory(key, limit, windowMs);
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
