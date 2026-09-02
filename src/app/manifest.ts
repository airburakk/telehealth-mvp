import type { MetadataRoute } from "next";
import { IS_DOCTORIUM_DEPLOY } from "@/lib/brand";
import { LANDING_META } from "@/lib/doctorium-landing/content";

// PWA manifest — MARKA-DUYARLI (Faz E, 2026-09-03; teknik ayrışma planı 2026-08-24 "ikon/manifest").
//
// Eskiden `public/manifest.webmanifest` statikti ve iki Vercel projesi de AURA manifest'ini sunuyordu:
// doctorium.tr'ye eklenen ana ekran kısayolu "AURA Health" adı + turkuaz ikonla kuruluyordu (QA 02.09
// "marka sızıntısı" ailesi — görünür metin temizken PWA kabuğundan sızan iz). BRAND_MODE build-time
// env'dir, her proje kendi build'ini alır → bu rota build'de sabitlenir (force-static), runtime yok.
//
// 🪤 `public/manifest.webmanifest` GERİ EKLENMEZ — aynı yolu gölgeler (tests/unit/pwa-brand.test kilitler).
// 🪤 İkon `?v=`: dosya değişince ARTIR (favicon dersi 2026-08-19 — tarayıcı ikon önbelleği inatçı);
//    `sw.js` PRECACHE + VERSION birlikte. AURA seti `?v=3` (v6.137), Doctorium seti `?v=1` (bu tur).
// Vitrin iddia disiplini: "uçtan uca" iki manifest'te de YOK (v6.137'de AURA'dan çıkarılmıştı).
export const dynamic = "force-static";

const PNG = "image/png";

export default function manifest(): MetadataRoute.Manifest {
  if (IS_DOCTORIUM_DEPLOY) {
    return {
      name: "Doctorium",
      short_name: "Doctorium",
      description: LANDING_META.description, // landing/kök meta ile TEK kaynak (claim-onaylı metin)
      id: "/",
      start_url: "/", // Doctorium deploy'unda kök → /doctorium rewrite (next.config)
      scope: "/",
      display: "standalone",
      orientation: "portrait",
      background_color: "#0d0e10", // Doctorium koyu zemin (--dl-bg) — AURA gece zeminiyle aynı değer
      theme_color: "#0d0e10",
      lang: "tr",
      categories: ["medical", "education", "news"],
      icons: [
        { src: "/icon-doctorium-192.png?v=1", sizes: "192x192", type: PNG, purpose: "any" },
        { src: "/icon-doctorium-512.png?v=1", sizes: "512x512", type: PNG, purpose: "any" },
        { src: "/icon-doctorium-192.png?v=1", sizes: "192x192", type: PNG, purpose: "maskable" },
        { src: "/icon-doctorium-512.png?v=1", sizes: "512x512", type: PNG, purpose: "maskable" },
      ],
    };
  }
  // AURA — eski statik dosyayla BİREBİR (v6.137 marka seti v2; "uçtan uca" yok).
  return {
    name: "AURA Health",
    short_name: "AURA",
    description: "Triyaj, uzman görüşü ve sağlık turizmi paketlerini birleştiren dijital sağlık platformu (MVP).",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0d0e10",
    theme_color: "#0d0e10",
    lang: "tr",
    categories: ["health", "medical"],
    icons: [
      { src: "/icon-192.png?v=3", sizes: "192x192", type: PNG, purpose: "any" },
      { src: "/icon-512.png?v=3", sizes: "512x512", type: PNG, purpose: "any" },
      { src: "/icon-192.png?v=3", sizes: "192x192", type: PNG, purpose: "maskable" },
      { src: "/icon-512.png?v=3", sizes: "512x512", type: PNG, purpose: "maskable" },
    ],
  };
}
