import type { NextConfig } from "next";

// DICOM WASM codec'leri (@cornerstonejs/codec-openjpeg, codec-charls) Emscripten glue içerir;
// glue'da `require("fs")`/`require("path")`/`crypto` Node-fallback'i var (tarayıcıda
// ENVIRONMENT_IS_NODE false olduğundan çalışmaz). Bu node-builtin'leri tarayıcı derlemesinde
// boş modüle yönlendir; sunucu (SSR/Node) tarafında gerçek modüller kullanılır.
const browserStub = { browser: "./src/empty-module.js" };

const nextConfig: NextConfig = {
  // Rename (Pro Bono → Ücretsiz Sağlık Hizmeti): eski sayfa URL'leri — tarayıcı geçmişi,
  // yer imleri ve DB'deki Notification.href satırları kırılmasın (redirect'ler proxy'den ÖNCE koşar).
  async redirects() {
    return [
      { source: "/pro-bono", destination: "/ucretsiz-saglik", permanent: true },
      { source: "/pro-bono/basvur", destination: "/ucretsiz-saglik/basvur", permanent: true },
      { source: "/pro-bono/bekleme", destination: "/ucretsiz-saglik/bekleme", permanent: true },
      { source: "/doktor/pro-bono", destination: "/doktor/ucretsiz-saglik", permanent: true },
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
