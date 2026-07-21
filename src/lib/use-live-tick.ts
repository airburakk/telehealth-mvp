"use client";

// Canlı-durum tick hook'u (v6.28) — 3sn körlemesine polling'in yerine: Ably "live:" dürtü kanalı +
// adaptif güvenlik-ağı polling. Dürtü İÇERİKSİZDİR (PHI/veri Ably'ye çıkmaz) — veri daima çağıranın
// kendi auth'lu fetch'iyle gelir; kanal yalnız "şimdi yenile" der (sinyalleşmedeki signal-poll.ts
// adaptif deseninin UI eşleniği). Ably canlıyken polling SAFETY_MS güvenlik ağına iner; Ably
// yok/kopuksa FAST_MS ile bugünkü davranış aynen sürer (zarif düşüş — kırılma riski yok).
// tick ref'te tutulur → çağıranın render'ında değişen closure effect'i YENİDEN KURMAZ
// (useT texts-race dersinin genel hali: efekt bağımlılığı yalnız topic+enabled).
import { useEffect, useRef } from "react";
import { connectLiveNudge } from "./ably-client";
import type { LiveTopic } from "./ably-server";

const FAST_MS = 3000; // Ably yok — mevcut 3sn davranış korunur (fallbackMs verilmezse)
const SAFETY_MS = 30_000; // Ably canlı — dürtü kaçarsa bile en geç 30sn'de tazelenir

// fallbackMs (v6.33): Ably yok/kopukken kullanılacak aralık — ESKİ poller aralığı aynen verilir
// (örn. çan 30sn · video 10sn · sohbet/status 8sn) ⇒ Ably'siz ortamda davranış BİREBİR korunur;
// misafir kullanıcı (token alamaz) hızlandırılmış polling'e DÜŞMEZ. Verilmezse 3sn (v6.28 üçlüsü).
export function useLiveTick(topic: LiveTopic, tick: () => void | Promise<void>, enabled: boolean, fallbackMs: number = FAST_MS): void {
  const tickRef = useRef(tick);
  tickRef.current = tick;

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
      if (stopped) return;
      try {
        await tickRef.current();
      } catch {
        /* tick kendi hatasını yönetir — döngü sürer */
      }
      if (stopped) return;
      timer = setTimeout(run, nudge.live() ? Math.max(SAFETY_MS, fallbackMs) : fallbackMs);
    };

    // Dürtü: bekleyen zamanlayıcıyı iptal edip HEMEN çek (run sonda zamanlayıcıyı yeniden kurar).
    const nudge = connectLiveNudge(`live:${topic}`, () => {
      if (stopped) return;
      if (timer) clearTimeout(timer);
      void run();
    });

    void run();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      nudge.close();
    };
  }, [topic, enabled, fallbackMs]);
}
