import type { NextConfig } from "next";

// DICOM WASM codec'leri (@cornerstonejs/codec-openjpeg, codec-charls) Emscripten glue içerir;
// glue'da `require("fs")`/`require("path")`/`crypto` Node-fallback'i var (tarayıcıda
// ENVIRONMENT_IS_NODE false olduğundan çalışmaz). Bu node-builtin'leri tarayıcı derlemesinde
// boş modüle yönlendir; sunucu (SSR/Node) tarafında gerçek modüller kullanılır.
const browserStub = { browser: "./src/empty-module.js" };

// HTTP güvenlik başlıkları (2026-07-18 denetimi P1). Tüm rotalara uygulanır.
// KAPSAM NOTU: burada CLICKJACKING (frame-ancestors/X-Frame-Options), TRANSPORT (HSTS),
// REFERER SIZINTISI (özellikle /paylasim/[token] — strict-origin-when-cross-origin ile cross-origin
// navigasyonda yalnız origin gider, token yolu gitmez), MIME-sniffing ve izin yüzeyi kapatılır.
// Tam `default-src`/`script-src` CSP BİLİNÇLİ EKLENMEDİ: WebRTC (Cloudflare TURN) + Ably websocket +
// Vercel Blob + Google OAuth + font origin'lerinin allowlist'i ayrı, sayfa-sayfa test isteyen bir iş;
// yanlış CSP üretimde sessizce görüşme/font/harita kırar. Ayrı kalem (todo).
const securityHeaders = [
  // Not: HSTS preload BİLİNÇLİ eklenmedi — preload listesine girmek kalıcı taahhüt; custom domain
  // kararından sonra ayrıca değerlendirilir. max-age + includeSubDomains güvenli ve geri alınabilir.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Sürüm parmak izini gizle (X-Powered-By: Next.js başlığı — 2026-07-18 denetimi P3).
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Rename (Pro Bono → Ücretsiz Sağlık Hizmeti): eski sayfa URL'leri — tarayıcı geçmişi,
  // yer imleri ve DB'deki Notification.href satırları kırılmasın (redirect'ler proxy'den ÖNCE koşar).
  async redirects() {
    return [
      { source: "/pro-bono", destination: "/ucretsiz-saglik", permanent: true },
      { source: "/pro-bono/basvur", destination: "/ucretsiz-saglik/basvur", permanent: true },
      { source: "/pro-bono/bekleme", destination: "/ucretsiz-saglik/bekleme", permanent: true },
      { source: "/doktor/pro-bono", destination: "/doktor/ucretsiz-saglik", permanent: true },
      // Güven ve Gizlilik sayfası (2026-07-15): kanonik rota Türkçe; /trust
      // kısa/İngilizce yolu tek kanonik URL'e toplanır (8 dil zaten tek URL'de).
      { source: "/trust", destination: "/guven-ve-gizlilik", permanent: true },
    ];
  },
  // Turbopack (Next 16 varsayılan builder)
  turbopack: {
    resolveAlias: { fs: browserStub, path: browserStub, crypto: browserStub },
  },
  // webpack ile build (`next build --webpack`) yapılırsa aynı stub
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve = config.resolve || {};
      config.resolve.fallback = { ...(config.resolve.fallback || {}), fs: false, path: false, crypto: false };
    }
    return config;
  },
};

export default nextConfig;
