// İstemci yardımcı: WebRTC ICE sunucularını sunucudan al (/api/realtime/ice).
// Sunucu, Metered ephemeral TURN kimliklerini üretir (METERED_API_KEY + METERED_DOMAIN).
// Cross-network bağlantı (farklı WiFi / mobil veri / simetrik NAT) için TURN relay ŞARTTIR;
// aynı ağda STUN yeter. Anahtar eksik/geçersizse route STUN+OpenRelay demo döner (güvenilmez);
// yalnız ICE ucu tamamen başarısızsa salt-STUN'a düşülür. Bkz. src/app/api/realtime/ice/route.ts.

const STUN_ONLY: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

// turnOk: gerçek (yönetilen) TURN relay geldi mi. source==="metered" değilse güvenilmez OpenRelay
// demo'sundayız (fallback: anahtar yok · fallback-error: Metered 401/erişilemez); ICE ucu tamamen
// başarısızsa salt-STUN (relay hiç yok). Her üç durumda da farklı ağlar arası video KOPABİLİR.
// Çağıran bu bayrağı, bağlantı başarısız olduğunda operatöre gerçek nedeni söylemek için kullanır.
export async function getIceServers(): Promise<{ iceServers: RTCIceServer[]; turnOk: boolean }> {
  try {
    const r = await fetch("/api/realtime/ice", { cache: "no-store" });
    if (r.ok) {
      const d = await r.json();
      if (Array.isArray(d.iceServers) && d.iceServers.length > 0) {
        const turnOk = d.source === "metered";
        if (!turnOk) console.warn(`[ICE] Gerçek TURN relay yok (source=${d.source ?? "?"}) → güvenilmez OpenRelay demo. Farklı ağlar arası video kopabilir; METERED_API_KEY'i (.env + Vercel) kontrol edin.`);
        return { iceServers: d.iceServers as RTCIceServer[], turnOk };
      }
    }
  } catch {
    /* sessizce STUN'a düş */
  }
  console.warn("[ICE] ICE uç noktası başarısız — yalnız STUN. Farklı ağlar arası video kopabilir.");
  return { iceServers: STUN_ONLY, turnOk: false };
}
