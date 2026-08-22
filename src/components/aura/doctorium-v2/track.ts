// Landing analytics istemci yardımcısı (2026-08-23). Yalnız istemci bileşenlerinden çağrılır.
// Gönderilen TEK şey {name, placement} — kimlik, URL, tercih, sorgu YOK (events.ts ilkesi).
// sendBeacon: rota değişiminden önce kuyruklanır, navigasyonu geciktirmez; yoksa keepalive fetch.
import { LANDING_EVENT_ENDPOINT, type LandingEventName, type LandingPlacement } from "@/lib/doctorium-landing/events";

export function track(name: LandingEventName, placement: LandingPlacement): void {
  if (typeof window === "undefined") return;
  const body = JSON.stringify({ name, placement });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(LANDING_EVENT_ENDPOINT, new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch(LANDING_EVENT_ENDPOINT, { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } }).catch(() => {});
  } catch {
    // telemetri asla sayfayı bozmaz
  }
}
