// WebRTC sinyalleşme transport yardımcıları (P1: DB-polling maliyetini azalt).
// Üç oda ortak kullanır (ConsultationRoom · SoVideoRoom · ConsultVideoRoom). Ably'ye geçişte kalkacak.

// Sinyal fetch sarmalayıcı: taraf-token'ını (varsa) x-sig-token başlığında yollar + yanıttan taze
// token'ı yakalayıp ref'e yazar → sonraki istekler sunucuda DB-yetki sorgusunu atlar. Token yoksa/
// süresi geçmişse sunucu full-auth yapıp taze token döner (backward-compatible: bozulursa eski davranış).
export async function signalFetch(
  tokenRef: { current: string | null }, url: string, init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (tokenRef.current) headers.set("x-sig-token", tokenRef.current);
  const res = await fetch(url, { ...init, headers });
  const tok = res.headers.get("x-sig-token");
  if (tok) tokenRef.current = tok;
  return res;
}

// Poll aralığı — bağlantı durumu + canlı aktivite + Ably canlılığına göre adaptif.
// ablyLive: Ably realtime bağlıysa offer/answer/ice/bye ANLIK Ably'den gelir → DB poll yalnız YEDEK
//   (backstop) + transkript taşıyıcısı olur → çok yavaşlatılır. Ably yoksa (503/engel) poll birincildir
//   → eski hızlı adaptif davranış (video yine çalışır, zarif düşüş).
// • Handshake (bağlı değil): Ably taşıyorsa 3000ms backstop yeter; yoksa 700ms hızlı (offer/answer/ice akmalı).
// • hot (transkript aktif): transkript Ably'den GİTMEZ (PHI) → her durumda görece hızlı (1000/1500ms).
// • Sessiz + bağlı: Ably bye'ı anlık taşır → 8000ms backstop; Ably yoksa 2000ms (gizli sekme 4000ms).
export function signalPollDelayMs(pc: RTCPeerConnection | null, hot = false, ablyLive = false): number {
  const live = pc?.connectionState === "connected" ||
    pc?.iceConnectionState === "connected" || pc?.iceConnectionState === "completed";
  if (!live) return ablyLive ? 3000 : 700;
  if (hot) return ablyLive ? 1500 : 1000;
  if (ablyLive) return 8000;
  const hidden = typeof document !== "undefined" && document.hidden;
  return hidden ? 4000 : 2000;
}
