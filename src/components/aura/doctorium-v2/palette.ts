import type { CSSProperties } from "react";

// V2 landing bölüm paletleri (2026-08-23). Koyu kök = doctorium-brand.tsx DOCTORIUM_PALETTE
// (tek kaynak); burada yalnız AÇIK ve DERİN varyantlar. v1'in LIGHT seti birebir korunur
// (.aura-light rol değerleri; zümrüt #047857 beyazda AA) + v1'de EKSİK olan --dl-rose açık
// karşılığı eklendi (rose-700; beyazda 5.9:1) — açık bölüme hukuk rengi taşınırsa AA düşmesin.
export const DOCTORIUM_LIGHT = {
  "--dl-bg": "#ffffff",
  "--dl-panel": "#f7f8f5",
  "--dl-ink": "#171a18",
  "--dl-muted": "#6b6660",
  "--dl-body": "#57534e",
  "--dl-line": "rgba(0,0,0,.1)",
  "--dl-emerald": "#047857",
  "--dl-rose": "#be123c",
  "--dl-amber": "#8a6a26",
  "--dl-cyan": "#0d6470",
} as CSSProperties;

/** Manifesto bandı — kök koyudan bir ton daha derin (v1 Hukuk bölümünün #101113'ü). */
export const DOCTORIUM_DEEP = {
  "--dl-bg": "#101113",
  "--dl-panel": "#161719",
} as CSSProperties;
