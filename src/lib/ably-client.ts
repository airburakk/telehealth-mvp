"use client";

// Ably realtime istemci bağlantısı (P1 #6 Faz 2) — token-auth: authUrl sunucudan kanala-özel kısa
// token alır (API anahtarı tarayıcıya GELMEZ). Kanala abone olur; gelen sinyali (yalnız KARŞI taraf)
// onMessage'e verir. Bağlanamazsa (anahtarsız 503 / ağ / WebSocket engeli) sessizce ölür → çağıran
// DB backstop poll'e güvenir. live() bağlantı durumunu verir → çağıran poll hızını ona göre ayarlar.
import * as Ably from "ably";

export type SignalMsg = { id: number; kind: string; data: string; sender?: string };

export function connectAblySignal(
  channelId: string, selfSide: string, onMessage: (m: SignalMsg) => void,
): { close: () => void; live: () => boolean } {
  let client: Ably.Realtime | null = null;
  let connected = false;
  try {
    client = new Ably.Realtime({
      authUrl: `/api/realtime/ably-token?channel=${encodeURIComponent(channelId)}`,
    });
    const conn = client.connection;
    conn.on("connected", () => { connected = true; });
    conn.on("failed", () => { connected = false; });
    conn.on("disconnected", () => { connected = false; });
    conn.on("suspended", () => { connected = false; });
    conn.on("closed", () => { connected = false; });
    const channel = client.channels.get(`sig:${channelId}`);
    channel.subscribe("signal", (msg) => {
      const m = msg.data as SignalMsg;
      // Sunucu her iki tarafın mesajını da kanala yayınlar → kendi tarafının mesajını atla
      // (DB poll'ün sender!=me süzmesiyle aynı semantik). Dedup id ile çağıranda yapılır.
      if (m && m.sender !== selfSide) onMessage(m);
    });
  } catch {
    connected = false;
  }
  return {
    close: () => { try { client?.close(); } catch {} },
    live: () => connected,
  };
}

// Canlı-durum dürtü aboneliği (v6.28) — "live:<topic>" kanalındaki İÇERİKSİZ "nudge" olayını dinler.
// Olay verisi kullanılmaz (PHI Ably'ye çıkmaz); çağıran dürtüde kendi auth'lu fetch'ini tetikler.
// Bağlanamazsa sessizce ölür → çağıranın polling güvenlik ağı taşır; live() poll hızını ayarlar.
export function connectLiveNudge(
  channelName: string, onNudge: () => void,
): { close: () => void; live: () => boolean } {
  let client: Ably.Realtime | null = null;
  let connected = false;
  try {
    client = new Ably.Realtime({
      authUrl: `/api/realtime/ably-token?channel=${encodeURIComponent(channelName)}`,
    });
    const conn = client.connection;
    conn.on("connected", () => { connected = true; });
    conn.on("failed", () => { connected = false; });
    conn.on("disconnected", () => { connected = false; });
    conn.on("suspended", () => { connected = false; });
    conn.on("closed", () => { connected = false; });
    client.channels.get(channelName).subscribe("nudge", () => onNudge());
  } catch {
    connected = false;
  }
  return {
    close: () => { try { client?.close(); } catch {} },
    live: () => connected,
  };
}
