// İstemci yardımcı: WebRTC ICE sunucularını sunucudan al (/api/realtime/ice).
// Sunucu, yönetilen ephemeral TURN kimlikleri üretir — birincil Cloudflare Realtime TURN
// (CF_TURN_KEY_ID + CF_TURN_API_TOKEN), yedek Metered (METERED_API_KEY + METERED_DOMAIN).
// Cross-network bağlantı (farklı WiFi / mobil veri / simetrik NAT) için TURN relay ŞARTTIR;
// aynı ağda STUN yeter. Sağlayıcı eksik/geçersizse route STUN+OpenRelay demo döner (güvenilmez);
// yalnız ICE ucu tamamen başarısızsa salt-STUN'a düşülür. Bkz. src/app/api/realtime/ice/route.ts.

const STUN_ONLY: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

// turnOk: gerçek (yönetilen) TURN relay geldi mi (cloudflare | metered). Değilse güvenilmez
// OpenRelay demo'sundayız (fallback: sağlayıcı yapılandırılmamış · fallback-error: sağlayıcı
// 401/erişilemez); ICE ucu tamamen başarısızsa salt-STUN (relay hiç yok). Her durumda farklı
// ağlar arası video KOPABİLİR. Çağıran bu bayrağı failed'da operatöre gerçek nedeni söylemek için kullanır.
export async function getIceServers(): Promise<{ iceServers: RTCIceServer[]; turnOk: boolean }> {
  try {
    const r = await fetch("/api/realtime/ice", { cache: "no-store" });
    if (r.ok) {
      const d = await r.json();
      if (Array.isArray(d.iceServers) && d.iceServers.length > 0) {
        const turnOk = d.source === "cloudflare" || d.source === "metered";
        if (!turnOk) console.warn(`[ICE] Gerçek TURN relay yok (source=${d.source ?? "?"}) → güvenilmez OpenRelay demo. Farklı ağlar arası video kopabilir; TURN sağlayıcı anahtarlarını (.env + Vercel: CF_TURN_* / METERED_*) kontrol edin.`);
        return { iceServers: d.iceServers as RTCIceServer[], turnOk };
      }
    }
  } catch {
    /* sessizce STUN'a düş */
  }
  console.warn("[ICE] ICE uç noktası başarısız — yalnız STUN. Farklı ağlar arası video kopabilir.");
  return { iceServers: STUN_ONLY, turnOk: false };
}
