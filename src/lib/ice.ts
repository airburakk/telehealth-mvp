// İstemci yardımcı: WebRTC ICE sunucularını sunucudan al (/api/realtime/ice).
// Sunucu, Metered ephemeral TURN kimliklerini üretir (METERED_API_KEY + METERED_DOMAIN).
// Cross-network bağlantı (farklı WiFi / mobil veri / simetrik NAT) için TURN relay ŞARTTIR;
// aynı ağda STUN yeter. Hata/anahtarsız durumda STUN'a düşer (aynı ağda çalışır, farklı ağda
// çalışmayabilir). Bkz. src/app/api/realtime/ice/route.ts.

const STUN_ONLY: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export async function getIceServers(): Promise<RTCIceServer[]> {
  try {
    const r = await fetch("/api/realtime/ice", { cache: "no-store" });
    if (r.ok) {
      const d = await r.json();
      if (Array.isArray(d.iceServers) && d.iceServers.length > 0) {
        return d.iceServers as RTCIceServer[];
      }
    }
  } catch {
    /* sessizce STUN'a düş */
  }
  return STUN_ONLY;
}
