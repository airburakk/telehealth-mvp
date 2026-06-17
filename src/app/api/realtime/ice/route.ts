import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

// WebRTC ICE sunucuları — Metered ephemeral TURN kimlikleri.
// Cross-network görüşme (farklı WiFi / mobil veri / simetrik NAT) için TURN relay ŞART;
// aynı ağda STUN yeter. Ham METERED_API_KEY sunucuda kalır; istemci yalnız kısa ömürlü
// kimlikleri alır. Env: METERED_API_KEY (gizli) + METERED_DOMAIN (ör: "uygulama.metered.live").
// Anahtar yoksa STUN + (geriye dönük) ücretsiz OpenRelay demo döner — demo güvenilmezdir,
// üretimde cross-network çoğu zaman başarısız olur; bu yüzden kendi Metered anahtarınızı ekleyin.

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

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const key = process.env.METERED_API_KEY;
  const domain = process.env.METERED_DOMAIN;

  // Anahtar yapılandırılmadıysa: STUN + güvenilmez OpenRelay demo (geriye dönük davranış)
  if (!key || !domain) {
    return NextResponse.json({ iceServers: [...STUN, ...OPENRELAY_FALLBACK], source: "fallback" });
  }

  try {
    const r = await fetch(
      `https://${domain}/api/v1/turn/credentials?apiKey=${encodeURIComponent(key)}`,
      { cache: "no-store" },
    );
    if (!r.ok) throw new Error(`metered ${r.status}`);
    const servers = (await r.json()) as RTCIceServer[];
    if (!Array.isArray(servers) || servers.length === 0) throw new Error("boş yanıt");
    // Metered listesi STUN+TURN içerir; Google STUN'unu da ekleyip döndür
    return NextResponse.json({ iceServers: [...STUN, ...servers], source: "metered" });
  } catch (e) {
    // Metered erişilemezse demoya düş (yine de bağlantı denensin)
    return NextResponse.json({
      iceServers: [...STUN, ...OPENRELAY_FALLBACK],
      source: "fallback-error",
      detail: e instanceof Error ? e.message : "bilinmeyen",
    });
  }
}
