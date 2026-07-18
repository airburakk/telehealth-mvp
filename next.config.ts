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
//
// ── Tam CSP: REPORT-ONLY fazında (2026-07-18 akşam — denetim P2 "Tam CSP" kalemi) ──
// Aşağıdaki politika HİÇBİR ŞEYİ ENGELLEMEZ; ihlaller /api/csp-report'a raporlanır (Vercel log:
// `[csp-report]`). Enforce = ayrı kullanıcı kararı: raporlar bir süre izlenir → politika buradaki
// enforce edilen `Content-Security-Policy` başlığıyla BİRLEŞTİRİLİR (iki ayrı enforce CSP başlığı
// kesişim uygular — enforce'a geçerken frame-ancestors satırı tam politikanın İÇİNE taşınır).
// Envanter: 9 ajanlı origin süpürmesi, her kalem dosya:satır kanıtlı (vault: wiki/log.md 2026-07-18).
const isDev = process.env.NODE_ENV === "development";
const cspReportOnly = [
  "default-src 'self'",
  // 'unsafe-inline': Next App Router her HTML'e inline RSC/hydration script'i (self.__next_f) gömer;
  // nonce alternatifi TÜM sayfaları dinamik render'a zorlar → statik 8-dil vitrin kararıyla çelişir.
  // 'wasm-unsafe-eval': DICOM codec'leri tarayıcıda WASM derler (DicomViewer openjpeg/charls).
  // ⚠️ 'unsafe-eval' PROD'A BİLİNÇLİ KONMADI: charlswasm.js glue'sunda 2 adet `new Function` var
  // (JPEG-LS yolu) → Report-Only tam da bu ihlali ölçecek; enforce öncesi karar kalemi.
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""}`,
  // SSR'lanan style="" attribute'ları (~44 kullanım) + JSX <style> blokları + next/font @font-face.
  "style-src 'self' 'unsafe-inline'",
  // data: → post-op foto (canvas.toDataURL) + belge önizlemeleri (readAsDataURL). Harici img hostu yok.
  "img-src 'self' data:",
  // blob: → DoctorVideoCard VTT altyazı track'i (createObjectURL). WebRTC srcObject CSP'ye tabi değil.
  "media-src 'self' blob:",
  "font-src 'self'", // next/font build'de self-host eder — Google Fonts origin'i EKLEME (gereksiz genişletme)
  // Ably realtime (birincil + *.ably-realtime.com: fallback a-e, internet-up, ws-up) + Gemini Live wss.
  // TURN/STUN connect-src'ye TABİ DEĞİL (WebRTC); Vercel Blob istemciye sızmaz (/api proxy'den iner).
  // İZLEME: https://generativelanguage.googleapis.com bilinçli DIŞARIDA (yalnız wss kanıtlı) —
  // Report-Only raporu gösterirse enforce öncesi eklenir.
  `connect-src 'self' wss://main.realtime.ably.net https://main.realtime.ably.net wss://*.ably-realtime.com https://*.ably-realtime.com wss://generativelanguage.googleapis.com${isDev ? " ws://localhost:* ws://127.0.0.1:*" : ""}`,
  "worker-src 'self'", // tek worker /sw.js; DICOM codec'leri worker'sız build (blob: GEREKMEZ)
  "manifest-src 'self'",
  "frame-src 'none'", // iframe sıfır; Google OAuth iframe değil tam-sayfa redirect
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'", // tek native form GET /operasyon/kayit-defteri; OAuth form değil anchor+302
  "frame-ancestors 'none'", // enforce'u ayrı başlıkta ZATEN canlı; enforce-adayı politikayla parite için burada da
  "report-uri /api/csp-report", // legacy alıcılar
  "report-to csp-endpoint", // modern Reporting API (Reporting-Endpoints başlığı aşağıda)
].join("; ");
const securityHeaders = [
  // Not: HSTS preload BİLİNÇLİ eklenmedi — preload listesine girmek kalıcı taahhüt; custom domain
  // kararından sonra ayrıca değerlendirilir. max-age + includeSubDomains güvenli ve geri alınabilir.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
  // Tam CSP — Report-Only (engellemez, raporlar; enforce ayrı kullanıcı kararı — üstteki blok notu).
  { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
  { key: "Reporting-Endpoints", value: 'csp-endpoint="/api/csp-report"' },
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
