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
// ── TAM CSP — ENFORCE (2026-07-29; v6.25'ten beri Report-Only'deydi) ──
// Enforce'a geçiş log izleme ile DEĞİL, KOD KANITIYLA yapıldı: Vercel Hobby'de runtime log saklama
// süresi 1 saat (2026-09-02'den beri Pro: 1 gün — karar yine kod kanıtına dayanır) + üretimde henüz gerçek kullanıcı trafiği yok → "raporları 1-2 hafta izle" planı
// yapısal olarak çalışmıyordu. Onun yerine prod bundle'ının 80 chunk'ı `Function(...)`/`eval(...)`
// için tarandı (minified desen dahil — `new Function` araması yanlış negatif verir):
//   · CharLS (JPEG-LS)  → embind `Function("body", …)`, modül yüklemede ÇALIŞIR = gerçek ihlal
//     ⇒ ÇÖZÜM: codec tarayıcıdan ÇIKARILDI, sunucu çözüyor (lib/dicom-pixels.toViewerSafeDicom)
//   · OpenJPEG (JPEG2000) → yalnız `Function("return this")` globalThis polyfill'i (kısa devre)
//   · React/core-js       → aynı polyfill deseni, `||` zincirinin sonunda (kısa devre)
//   · Gemini Live         → SDK https base URL'i `wss`'e çevirir (getWebsocketBaseUrl) ⇒ connect-src'de
//     https://generativelanguage.googleapis.com'a GEREK YOK, wss satırı yeterli.
const cspEnforced = [
  "default-src 'self'",
  // 'unsafe-inline': Next App Router her HTML'e inline RSC/hydration script'i (self.__next_f) gömer;
  // nonce alternatifi TÜM sayfaları dinamik render'a zorlar → statik 9-dil vitrin kararıyla çelişir.
  // 'wasm-unsafe-eval': JPEG 2000 (OpenJPEG) tarayıcıda WASM derler — kod ÜRETMEZ, eval'den farklıdır.
  // ⚠️ 'unsafe-eval' ÜRETİMDE YOK ve EKLENMEMELİ: tek gerekçesi CharLS'ti, o da sunucuya taşındı.
  //    Yeniden ihtiyaç duyulursa doğru çözüm codec'i sunucuya almaktır, eval iznini açmak değil.
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""}`,
  // SSR'lanan style="" attribute'ları (~44 kullanım) + JSX <style> blokları + next/font @font-face.
  "style-src 'self' 'unsafe-inline'",
  // data: → post-op foto (canvas.toDataURL) + belge önizlemeleri (readAsDataURL).
  // *.blob.vercel-storage.com → doktor profil fotoğrafı (public Blob, client-upload — 2026-08-14).
  // v6.99.2 haber görselleri (2026-08-16): Doctorium haber DETAYI kaynağın kendi görselini
  // hotlink'ler — host listesi lib/doctorium-sources.ts NEWS_IMAGE_HOSTS ile SÖZLEŞMELİDİR
  // (birim test kilitli: doctorium-filtreler.test.ts). Buraya host eklerken ORADA da ekle;
  // genel "https:" genişletmesi BİLİNÇLİ yapılmadı (dar-CSP disiplini, v6.98 deseni).
  "img-src 'self' data: https://*.blob.vercel-storage.com https://www.istabip.org.tr https://www.ohsad.org https://cdn.who.int https://www.who.int https://scx1.b-cdn.net https://www.ttb.org.tr https://img.medscapestatic.com",
  // blob: → DoctorVideoCard VTT altyazı track'i (createObjectURL). WebRTC srcObject CSP'ye tabi değil.
  // *.blob.vercel-storage.com → doktor tanıtım videosu (public Blob — 2026-08-14).
  "media-src 'self' blob: https://*.blob.vercel-storage.com",
  "font-src 'self'", // next/font build'de self-host eder — Google Fonts origin'i EKLEME (gereksiz genişletme)
  // Ably realtime (birincil + *.ably-realtime.com: fallback a-e, internet-up, ws-up) + Gemini Live wss.
  // TURN/STUN connect-src'ye TABİ DEĞİL (WebRTC). KLİNİK belgeler istemciye Blob'dan İNMEZ
  // (/api proxy — şifreli private store); İSTİSNA: profil medyası (foto/video, PHI DEĞİL)
  // client-upload'la DOĞRUDAN Blob'a çıkar (2026-08-14) → vercel.com (token değişimi) +
  // *.blob.vercel-storage.com (PUT/multipart) bu yüzden listede.
  // https://generativelanguage.googleapis.com KASITLI YOK — SDK kanıtı için üstteki blok notuna bak.
  `connect-src 'self' https://vercel.com https://*.blob.vercel-storage.com wss://main.realtime.ably.net https://main.realtime.ably.net wss://*.ably-realtime.com https://*.ably-realtime.com wss://generativelanguage.googleapis.com${isDev ? " ws://localhost:* ws://127.0.0.1:*" : ""}`,
  "worker-src 'self'", // tek worker /sw.js; DICOM codec'leri worker'sız build (blob: GEREKMEZ)
  "manifest-src 'self'",
  "frame-src 'none'", // iframe sıfır; Google OAuth iframe değil tam-sayfa redirect
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'", // tek native form GET /operasyon/kayit-defteri; OAuth form değil anchor+302
  // frame-ancestors artık YALNIZ burada: enforce'ta İKİ ayrı CSP başlığı KESİŞİM uygular; ayrı
  // "frame-ancestors 'none'" başlığı bırakılsaydı politikalar kesişir, teşhisi zor davranış çıkardı.
  // Clickjacking koruması aynen sürüyor (+ X-Frame-Options: DENY yedeği duruyor).
  "frame-ancestors 'none'",
  "report-uri /api/csp-report", // legacy alıcılar
  "report-to csp-endpoint", // modern Reporting API (Reporting-Endpoints başlığı aşağıda)
].join("; ");
const securityHeaders = [
  // Not: HSTS preload BİLİNÇLİ eklenmedi — preload listesine girmek kalıcı taahhüt; custom domain
  // kararından sonra ayrıca değerlendirilir. max-age + includeSubDomains güvenli ve geri alınabilir.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" }, // eski tarayıcı yedeği; asıl koruma CSP frame-ancestors
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
  // Tam CSP — ENFORCE (2026-07-29 kullanıcı kararı). İhlaller hem ENGELLENİR hem /api/csp-report'a
  // raporlanır. Geri alma: bu satırın key'ini "Content-Security-Policy-Report-Only" yapmak yeterli.
  { key: "Content-Security-Policy", value: cspEnforced },
  { key: "Reporting-Endpoints", value: 'csp-endpoint="/api/csp-report"' },
];

// ── AURA↔Doctorium ayrışması Faz A (2026-08-24) — İKİ VERCEL PROJESİ, AYNI REPO ──
// Doctorium projesi BRAND_MODE=doctorium ile build alır: kökü Doctorium landing'e rewrite eder,
// AURA vitrin/hasta yüzeylerini AURA'nın kanonik köküne yönlendirir. AURA projesinde BRAND_MODE
// tanımsız → bu iki liste BOŞ döner, davranış birebir eski hali. Uygulama-içi eş sabitler
// src/lib/brand.ts'te (config '@' alias'ını çözemediği için değerler burada tekrarlanır —
// değiştirirken İKİSİNİ birlikte güncelle).
const IS_DOCTORIUM_DEPLOY = process.env.BRAND_MODE === "doctorium";
const AURA_CANONICAL_URL = "https://auraglobalcare.com";
// AURA'ya devredilen yüzeyler: vitrin + hasta hunisi + AURA giriş/kayıt + locale kökleri.
// ⚠️ /doktor ağacı ile /onam BİLİNÇLİ listede DEĞİL: Doctorium kayıt akışı (onam → baslangic
// diploma yüklemesi) ve portal bu projede yaşar; klinik rotaların asıl kapısı zaten rol +
// hasClinicalAccess (sunucu tarafı). Locale listesi lib/aura-landing/copy.ts LANG_CODES ile
// SÖZLEŞMELİ — dil eklenince buraya da yaz.
const AURA_ONLY_PREFIXES = [
  "/giris", "/kurumsal-giris", "/kayit", "/ogrenci",
  "/triyaj", "/vaka", "/vakalarim", "/takip", "/paylasimlarim", "/paylasim",
  "/paket", "/teklif", "/rezervasyon", "/sikayet", "/gorusme", "/hesap", "/erisim-kaydi",
  "/second-opinion", "/ucretsiz-saglik", "/saglik-turizmi", "/doktorlar", "/konsultasyon",
  "/how-it-works", "/v2", "/for-clinicians", "/guven-ve-gizlilik", "/trust",
  "/en", "/tr", "/ru", "/ar", "/fa", "/az", "/de", "/fr", "/bg",
];

const nextConfig: NextConfig = {
  // Sürüm parmak izini gizle (X-Powered-By: Next.js başlığı — 2026-07-18 denetimi P3).
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Doctorium deploy'unda kök = Doctorium landing (URL çubuğu temiz kalır; sayfanın canonical'ı
  // /doctorium — tek kanonik korunur). AURA deploy'unda boş.
  async rewrites() {
    if (!IS_DOCTORIUM_DEPLOY) return [];
    return { beforeFiles: [{ source: "/", destination: "/doctorium" }], afterFiles: [], fallback: [] };
  },
  // Rename (Pro Bono → Ücretsiz Sağlık Hizmeti): eski sayfa URL'leri — tarayıcı geçmişi,
  // yer imleri ve DB'deki Notification.href satırları kırılmasın (redirect'ler proxy'den ÖNCE koşar).
  async redirects() {
    // Doctorium deploy'u: AURA yüzeyleri kanonik AURA köküne (307 — domain kararı netleşene
    // dek kalıcı işaretlenmez). AURA deploy'undaki kalıcı rename redirect'leri her iki projede
    // de zararsızdır ama Doctorium'da ilgili rotalar zaten AURA'ya gittiğinden erişilmez.
    if (IS_DOCTORIUM_DEPLOY) {
      return [
        // Kanonik host = doctorium.tr (kullanıcı kararı 2026-08-24; iki gerçek domain alındı).
        // com.tr + www varyantları kalıcı (308) tek köke toplanır — SEO tek kanonik; SSL/alias
        // üçünde de Vercel'de. NEXT_PUBLIC_SITE_URL de https://doctorium.tr.
        { source: "/:path*", has: [{ type: "host" as const, value: "doctorium.com.tr" }], destination: "https://doctorium.tr/:path*", permanent: true },
        { source: "/:path*", has: [{ type: "host" as const, value: "www.doctorium.tr" }], destination: "https://doctorium.tr/:path*", permanent: true },
        ...AURA_ONLY_PREFIXES.flatMap((p) => [
          { source: p, destination: `${AURA_CANONICAL_URL}${p}`, permanent: false },
          { source: `${p}/:path*`, destination: `${AURA_CANONICAL_URL}${p}/:path*`, permanent: false },
        ]),
      ];
    }
    return [
      { source: "/pro-bono", destination: "/ucretsiz-saglik", permanent: true },
      { source: "/pro-bono/basvur", destination: "/ucretsiz-saglik/basvur", permanent: true },
      { source: "/pro-bono/bekleme", destination: "/ucretsiz-saglik/bekleme", permanent: true },
      { source: "/doktor/pro-bono", destination: "/doktor/ucretsiz-saglik", permanent: true },
      // Güven ve Gizlilik sayfası (2026-07-15): kanonik rota Türkçe; /trust
      // kısa/İngilizce yolu tek kanonik URL'e toplanır (8 dil zaten tek URL'de).
      { source: "/trust", destination: "/guven-ve-gizlilik", permanent: true },
      // Rename ("hekim" → "doktor" terim kuralı, kullanıcı kararı 2026-08-17): dizin ve profil
      // rotaları /hekimler·/hekim/[id]'den /doktorlar·/doktorlar/[id]'ye taşındı; admin onay
      // kuyruğu /admin/hekim-onay → /admin/doktor-onay. Eski URL'ler yer imlerinde, tarayıcı
      // geçmişinde ve DB'deki Notification.href satırlarında yaşıyor → 308 ile korunur.
      { source: "/hekimler", destination: "/doktorlar", permanent: true },
      { source: "/hekim/:id", destination: "/doktorlar/:id", permanent: true },
      { source: "/admin/hekim-onay", destination: "/admin/doktor-onay", permanent: true },
    ];
  },
  // v6.37 — burned-in PHI maskeleme SUNUCUDA piksel çözer (lib/dicom-pixels): JPEG-LS/JPEG 2000 için
  // CharLS/OpenJPEG .wasm ikilileri runtime'da fs ile okunur. Statik import olmadığından Next'in dosya
  // izleyicisi bunları kendiliğinden bulamaz → serverless bundle'a AÇIKÇA dahil edilir.
  // ⚠️ Bu blok silinirse sıkıştırılmış görüntülerde maskeleme üretimde fail-closed olur (dosya reddedilir).
  outputFileTracingIncludes: {
    "/api/dicom/redact-preview": ["./node_modules/@cornerstonejs/codec-*/dist/*.wasm"],
    "/api/partner/consultation-requests": ["./node_modules/@cornerstonejs/codec-*/dist/*.wasm"],
    "/api/cases/[id]/consult-pool": ["./node_modules/@cornerstonejs/codec-*/dist/*.wasm"],
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
