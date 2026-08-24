// Doctorium landing V2 — analytics event SÖZLÜĞÜ (DOCV2-010, 2026-08-23). İstemci-güvenli saf veri.
//
// İlke (kullanıcı kararı: first-party AGREGAT sayaç): yalnız {name, placement} gönderilir; çerez,
// IP, UA, oturum, URL, branş/bölüm seçimi, arama sorgusu ASLA gönderilmez — kişisel veri işlenmez,
// bu yüzden anonim ziyaretçiden onam istenmez. Sunucu (api/landing-event) yalnız bu iki allowlist'i
// kabul eder; dışı 204 ile sessizce düşer. Sayım günlük kovada (LandingEvent.day) toplanır.
// lib/alerts.ts "asla-loglama" listesi ve lib/audit.ts "yüksek-frekanslı olay audit edilmez"
// kuralıyla uyumlu: bu olaylar audit zincirine YAZILMAZ.
export const LANDING_EVENT_NAMES = [
  "landing_view",
  "create_doctorium_click",
  "login_click",
  "student_click",
  "how_it_works_click",
  "nav_anchor_click",
  "personalization_demo_start",
  "personalization_demo_update",
  "why_this_item_open",
  "original_source_click",
  "section_view",
  "mobile_menu_open",
  "landing_error_shown",
] as const;
export type LandingEventName = (typeof LANDING_EVENT_NAMES)[number];

/** placement: CTA yeri ya da section id — kategori düzeyi, asla serbest metin. */
export const LANDING_PLACEMENTS = [
  "header", "hero", "sticky", "final", "identity",
  "nasil", "problem", "manifesto", "kisisellestir", "bugun", "akademik", "regulasyon",
  "hukuk", "kongre", "kontrol", "guven", "fark", "basla", "demo", "none",
] as const;
export type LandingPlacement = (typeof LANDING_PLACEMENTS)[number];

export const LANDING_EVENT_ENDPOINT = "/api/landing-event";

export function isLandingEventName(v: unknown): v is LandingEventName {
  return typeof v === "string" && (LANDING_EVENT_NAMES as readonly string[]).includes(v);
}
export function isLandingPlacement(v: unknown): v is LandingPlacement {
  return typeof v === "string" && (LANDING_PLACEMENTS as readonly string[]).includes(v);
}
