// Marka-deploy kimliği (AURA↔Doctorium ayrışması Faz A, 2026-08-24).
//
// AYNI repo iki Vercel projesine bağlıdır: AURA (mevcut, BRAND_MODE tanımsız) ve Doctorium
// (BRAND_MODE=doctorium). Doctorium projesi kendi URL'inde yalnız Doctorium yüzeylerini sunar:
//   · next.config.ts — "/" → /doctorium rewrite'ı + AURA vitrin/hasta rotalarının AURA'ya redirect'i
//   · sitemap.ts — yalnız Doctorium girdileri
//   · api/cron/* — no-op (cron'lar YALNIZ AURA projesinde koşar; vercel.json iki projede de
//     cron kaydeder, çift koşum burada kesilir)
//   · SITE_URL (lib/aura-landing/seo.ts) — NEXT_PUBLIC_SITE_URL env'iyle proje-başına çözülür.
// Veritabanı/hesap modeli ORTAK (kullanıcı kararı 2026-08-24: içerik boru hattı tek yerde,
// ileride-birleştirme korunur). Detay: output/doctorium-teknik-ayristirma-plani-2026-08-24.md.
//
// ⚠️ Saf sabit modül (db/auth ağacına dokunmaz) — sitemap/robots/config yakını güvenle import eder.
export const IS_DOCTORIUM_DEPLOY = process.env.BRAND_MODE === "doctorium";

// AURA'nın kanonik kökü — Doctorium deploy'undaki redirect hedefi. seo.ts SITE_URL fallback'i ile
// aynı değer; next.config.ts kendi kopyasını taşır (config '@' alias'ını çözemez — yorumla bağlı).
export const AURA_CANONICAL_URL = "https://telehealth-mvp-roan.vercel.app";
