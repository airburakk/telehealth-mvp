import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

// WebRTC ICE sunucuları — yönetilen ephemeral TURN kimlikleri.
// Cross-network görüşme (farklı WiFi / mobil veri / simetrik NAT) için TURN relay ŞART;
// aynı ağda STUN yeter. Sağlayıcı sırları sunucuda kalır; istemci yalnız kısa ömürlü kimlikleri alır.
// Sağlayıcı sırası (v4.29): 1) Cloudflare Realtime TURN (CF_TURN_KEY_ID + CF_TURN_API_TOKEN —
// ücretsiz katman, birincil) → 2) Metered (METERED_API_KEY + METERED_DOMAIN — yedek; anahtar
// 2026-07 itibarıyla ölü, düzelirse kendiliğinden devreye girer) → 3) STUN + OpenRelay demo
// (güvenilmez; üretimde cross-network çoğu zaman başarısız — yalnız son çare).
// İstemci tarafı `lib/ice.ts` `source` alanından turnOk türetir (cloudflare|metered = gerçek relay).

export const dynamic = "force-dynamic"; // gizli/taze içerik — statik cache YASAK

const STUN: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const OPENRELAY_FALLBACK: RTCIceServer[] = [
  { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
];

// Cloudflare Realtime TURN — kısa ömürlü kimlik üretimi (sunucudan, Bearer token'la).
// Yanıt şekli sürüme göre { iceServers: {...} } (tek nesne) veya { iceServers: [...] } (dizi)
// olabilir → ikisi de normalize edilir.
async function cloudflareIce(keyId: string, token: string): Promise<RTCIceServer[]> {
  const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    // ttl: kimlik süresi dolunca TURN allocation YENİLENEMEZ → relay'li görüşme kopar; 4 saat
    // uzun konsültasyonları da kapsar (her oda-katılımında taze çekilir, hasat penceresi sınırlı).
    body: JSON.stringify({ ttl: 14400 }),
    signal: AbortSignal.timeout(5000), // CF asılırsa yedek kaskadı (Metered/fallback) beklemesin
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`cloudflare ${r.status}`);
  const d = await r.json();
  const list: RTCIceServer[] = Array.isArray(d.iceServers) ? d.iceServers : d.iceServers ? [d.iceServers] : [];
  if (list.length === 0) throw new Error("cloudflare boş yanıt");
  return list;
}

// Metered ephemeral TURN — eski birincil, artık yedek.
async function meteredIce(key: string, domain: string): Promise<RTCIceServer[]> {
  const r = await fetch(
    `https://${domain}/api/v1/turn/credentials?apiKey=${encodeURIComponent(key)}`,
    { cache: "no-store", signal: AbortSignal.timeout(5000) },
  );
  if (!r.ok) throw new Error(`metered ${r.status}`);
  const servers = (await r.json()) as RTCIceServer[];
  if (!Array.isArray(servers) || servers.length === 0) throw new Error("metered boş yanıt");
  return servers;
}

// detail alanı istemciye döner → yalnız bilinen status-only kalıplar geçer; ham exception
// mesajı (ör. JSON parse snippet'i) iletilmez (ileride mesaja URL/anahtar eklenirse sızmasın).
function sanitizeErr(e: unknown, provider: string): string {
  const msg = e instanceof Error ? e.message : "";
  if (/^(cloudflare|metered) (\d+|boş yanıt)$/.test(msg)) return msg;
  if (e instanceof Error && e.name === "TimeoutError") return `${provider} zaman-aşımı`;
  return `${provider} istek-hatası`;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  // Kimlik-üretimi kota istismarına açık olmasın: kullanıcı başına ılımlı limit
  // (oda-katılımı başına 1 çağrı — 30/dk meşru kullanımı asla kısmaz; Upstash yoksa fail-open).
  const rl = await rateLimit(`ice:${user.id}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Çok fazla istek." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  const errors: string[] = [];

  // 1) Cloudflare (birincil)
  const cfKeyId = process.env.CF_TURN_KEY_ID;
  const cfToken = process.env.CF_TURN_API_TOKEN;
  if (cfKeyId && cfToken) {
    try {
      const servers = await cloudflareIce(cfKeyId, cfToken);
      return NextResponse.json({ iceServers: [...STUN, ...servers], source: "cloudflare" });
    } catch (e) {
      errors.push(sanitizeErr(e, "cloudflare"));
    }
  }

  // 2) Metered (yedek)
  const key = process.env.METERED_API_KEY;
  const domain = process.env.METERED_DOMAIN;
  if (key && domain) {
    try {
      const servers = await meteredIce(key, domain);
      return NextResponse.json({ iceServers: [...STUN, ...servers], source: "metered" });
    } catch (e) {
      errors.push(sanitizeErr(e, "metered"));
    }
  }

  // 3) Hiç sağlayıcı yapılandırılmamış veya hepsi düştü: STUN + güvenilmez OpenRelay demo
  return NextResponse.json({
    iceServers: [...STUN, ...OPENRELAY_FALLBACK],
    source: errors.length ? "fallback-error" : "fallback",
    ...(errors.length ? { detail: errors.join(" | ") } : {}),
  });
}
