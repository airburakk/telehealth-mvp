import type { CSSProperties } from "react";

// V3 landing paleti (modernizasyon turu, 2026-08-26). Kullanıcı kararı: marka rengi/logo/wordmark
// SABİT kalır — DOCTORIUM_PALETTE (doctorium-brand.tsx) hero için aynen kullanılır, buradan yeni
// bir renk İCAT EDİLMEZ. Bu dosya yalnız "zebra"nın yerini alan tek açık zemini tanımlar: saf
// #fff değil, Apple'ın "hafif kırık" tonu — derinlik gölgeyle değil --dl3-panel/--dl3-line
// katmanlarıyla verilir. Aksan rengi hep zümrüt (v2 DOCTORIUM_LIGHT ile aynı ton, AA'da ölçülü).
export const V3_LIGHT = {
  "--dl-bg": "#fbfbfa",
  "--dl-panel": "#f3f3f1",
  "--dl-ink": "#18181b",
  "--dl-muted": "#6b6b68",
  "--dl-body": "#4b4b48",
  "--dl-line": "rgba(24,24,27,.08)",
  "--dl-emerald": "#047857",
} as CSSProperties;
