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

// Poll aralığı — bağlantı durumu + canlı aktiviteye göre adaptif.
// • Handshake (bağlı değil): offer/answer/ice akmalı → HIZLI (700ms).
// • hot: bu turda transkript geldi = karşı taraf KONUŞUYOR → canlı altyazı hissi için hızlı kal
//   (1000ms; eski sabit 1200ms'den bile hızlı → transkript gecikmesinde gerileme YOK; sekme gizli
//   olsa da tercüman sesi çalıyor olabilir → çarpan uygulanmaz).
// • Sessiz + bağlı: yalnız bye/gecikmeli transkript beklenir → YAVAŞ (2000ms; gizli sekme 4000ms).
export function signalPollDelayMs(pc: RTCPeerConnection | null, hot = false): number {
  const live = pc?.connectionState === "connected" ||
    pc?.iceConnectionState === "connected" || pc?.iceConnectionState === "completed";
  if (!live) return 700;
  if (hot) return 1000;
  const hidden = typeof document !== "undefined" && document.hidden;
  return hidden ? 4000 : 2000;
}
