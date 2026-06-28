"use client";

// M5 Faz 3 — presence heartbeat. Mount edildiği yerde ~20 sn'de bir /api/presence/ping çağırır
// (Doctor/PartnerDoctor.lastSeenAt tazelenir → karşı tarafın "online" rozeti). Görsel çıktısı yok.
import { useEffect } from "react";

export function PresencePinger() {
  useEffect(() => {
    const ping = () => { fetch("/api/presence/ping", { method: "POST" }).catch(() => {}); };
    ping();
    const i = setInterval(ping, 20_000);
    return () => clearInterval(i);
  }, []);
  return null;
}
