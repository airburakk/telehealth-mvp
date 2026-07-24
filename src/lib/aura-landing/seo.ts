// AURA landing SEO sabitleri (v5.9.1) — SAF VERİ, "use client" YOK (server metadata
// export'ları import eder). Landing 9 dil TEK URL'de sunulur (dil client-side, air_lang);
// klasik hreflang (path-başına-URL) yerine OpenGraph og:locale:alternate ile dil sinyali verilir.
import { LANG_CODES, type Lang } from "./copy";

// Kanonik site kökü — metadataBase + canonical + OpenGraph + sitemap/robots'un TEK kaynağı.
// Domain taşınırsa (aurahealth.clinic) yalnız burası değişir. Saf sabit (db/auth ağacına
// dokunmaz — sitemap.ts/robots.ts bunu güvenle import eder).
export const SITE_URL = "https://telehealth-mvp-roan.vercel.app";

// Landing Lang kodu → OpenGraph locale (dil_ÜLKE). Pazar hedefine göre bölge seçimi:
// ar→SA, fa→IR, az→AZ (RTL/MENA genişlemesi ile hizalı) · bg→BG (Balkan, 2026-07-23).
export const OG_LOCALE: Record<Lang, string> = {
  en: "en_US",
  tr: "tr_TR",
  de: "de_DE",
  fr: "fr_FR",
  ru: "ru_RU",
  ar: "ar_SA",
  fa: "fa_IR",
  az: "az_AZ",
  bg: "bg_BG",
};

// Birincil dışı (landing EN-first) OG locale listesi — og:locale:alternate için.
export const OG_ALTERNATE_LOCALES = LANG_CODES.filter((c) => c !== "en").map((c) => OG_LOCALE[c]);
