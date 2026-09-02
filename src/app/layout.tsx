import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono, Noto_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { SiteFooter } from "@/components/SiteFooter";
import { PwaRegister } from "@/components/PwaRegister";
import { AuraAnimPause } from "@/components/aura/anim-pause";
import { AppChrome } from "@/components/AppChrome";
import { SITE_URL } from "@/lib/aura-landing/seo";
import { IS_DOCTORIUM_DEPLOY } from "@/lib/brand";
import { LANDING_META } from "@/lib/doctorium-landing/content";

// Uygulama geneli tipografi — vitrin (aura-health) ile aynı aile: Inter gövde + Space Grotesk
// display (--font-serif değişken adı tarihsel; display yuvası olarak kullanılır) + JetBrains Mono
// mikro/durak. `subsets` YALNIZ PRELOAD'u belirler — @font-face kuralları diğer subset'leri de
// içerir ve unicode-range ile talep üzerine iner. Inter Kiril kapsar → RU/KK/KY/BG markalı (ölçüldü
// 2026-07-15: gerçek Inter face'i U+400-45F'i kapsıyor). Space Grotesk Kiril kapsamaz → RU/BG
// başlıkları fallback (kabul; Google Fonts'ta Kiril subset'i yok).
const sans = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-sans", display: "swap" });
// preload:false (2026-08-28 denetimi): Doctorium landing (above-the-fold/LCP en kritik yüzey)
// yalnız Inter kullanır — Space Grotesk/JetBrains Mono orada hiç referanslanmadığı halde (yalnız
// AURA'nın iç form sayfalarında geçer) root layout ortak olduğu için ikisi de preload ediliyordu
// (6 WOFF2'nin 5'i). Arabic'teki aynı desen: preload:false → tarayıcı yalnız gerçek kullanım
// anında (@font-face tetiklenince) çeker; above-the-fold artık yalnız Inter'i bekler.
const serif = Space_Grotesk({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700"], variable: "--font-serif", display: "swap", preload: false });
const mono = JetBrains_Mono({ subsets: ["latin", "latin-ext"], variable: "--font-mono", display: "swap", preload: false });
// Arapça/Farsça (v6.9): Inter/Space Grotesk/JetBrains Mono'nun HİÇBİRİ Arap alfabesini kapsamıyordu
// → ar/fa denetimsiz sistem fallback'indeydi (tasarım sistemi kuralı: öncelikli RTL pazarları
// kontrolsüz fallback'e bırakılmaz). Noto Sans Arabic gövde VE başlıkta kullanılır (kullanıcı kararı;
// Space Grotesk'in Arapça muadili yok).
//
// `preload: false` KASITLI: 9 dilin yalnız 2'si bu fontu kullanır → Latin kullanıcıya indirilmez;
// tarayıcı yalnız Arapça glif çizilecekse çeker (ar/fa'da "loaded", diğer dillerde hiç istenmez —
// ölçüldü). Yığına genel olarak DEĞİL, `:lang(ar)/:lang(fa)` altında bağlanır — nedeni globals.css'te
// (next/font'un "<Aile> Fallback" face'i U+0-10FFFF kapsar ve sıralamayı iki yönlü bozar).
const arabic = Noto_Sans_Arabic({ subsets: ["arabic"], variable: "--font-arabic", display: "swap", preload: false });

export const metadata: Metadata = {
  // metadataBase: canonical + OpenGraph göreli URL'lerini mutlaklaştırır (yoksa Next uyarı verir).
  metadataBase: new URL(SITE_URL),
  // Sekme başlığı sadeleştirildi (2026-07-12, kullanıcı kararı): üst banttaki yalın-logo diliyle hizalı.
  // Sayfalar kendi title'ını verebilir; landing/how-it-works zengin başlık taşır.
  // ⚠️ MARKA-DUYARLI ŞABLON (v6.195): Doctorium deploy'unda KÖK şablon da Doctorium olmalı.
  // /doctorium ve /admin ağaçları kendi şablonlarını taşıdığı için sorun uzun süre görünmedi;
  // KÖK seviyeye paylaşımlı bir rota eklenince (v6.194 /sifremi-unuttum) doctorium.tr'de sekme
  // "Parolamı unuttum · AURA" oldu — gövde temizken META'dan sızan marka izi (vitrin kuralı:
  // "görünür metin yetmez, meta/OG ayrı tara"). Kökü düzeltmek gelecekteki paylaşımlı rotaları da
  // kapsar; sayfa-başına `absolute` yamalamak aynı hatayı her yeni rotada tekrarlatırdı.
  title: IS_DOCTORIUM_DEPLOY
    ? { default: "Doctorium", template: "%s · Doctorium" }
    : { default: "AURA Health", template: "%s · AURA" },
  // "uçtan uca" bilinçli YOK (vitrin iddia disiplini v6.8/v6.18 — ana sayfayla hizalı; kullanıcı onayı 2026-07-18).
  // Marka-duyarlı (T2 takip, 2026-09-02): kök description da title gibi deploy'a göre seçilir.
  // Doctorium deploy'unda AURA'ya devredilmeyen fallback yüzeyler (404/hata + paylaşımlı rotalar)
  // kök description'ı miras alır — AURA'nın "sağlık turizmi" metni Doctorium meta'sına sızıyordu
  // (title zaten switch'liydi, description unutulmuştu). Landing'in claim-onaylı metniyle tek kaynak.
  description: IS_DOCTORIUM_DEPLOY
    ? LANDING_META.description
    : "Triyaj, uzman görüşü ve sağlık turizmi paketlerini birleştiren dijital sağlık platformu (MVP).",
  manifest: "/manifest.webmanifest",
  // Sekme ikonu AÇIKÇA burada bağlanır — `src/app/favicon.ico` dosya konvansiyonu BİLİNÇLİ YOK.
  // Sebep (2026-08-19): kök favicon.ico varken alt segmentteki `icon.ico` <link> olarak BASILMIYOR
  // (dosya rota olarak servis ediliyor ama link kök favicon'u gösteriyor) → Doctorium yüzeyleri
  // zümrüt ikonu alamıyordu. metadata.icons alt layout'ta override EDİLEBİLİR; kullanılan yol bu.
  // Üretim: `python scripts/gen-icons.py`. AURA yüzeyleri = TURKUAZ dolu daire (#28C8D8) +
  // tam siyah amblem; Doctorium yüzeyleri zümrüt alır (her marka kendi tonu).
  // 🪤 `?v=` ŞART — dosya konvansiyonu bırakılınca kaybettiğimiz cache-kırıcının yerine geçer:
  // Next `app/favicon.ico` konvansiyonunda URL'e içerik hash'i ekliyordu
  // (`/favicon.ico?favicon.<hash>.ico`), metadata.icons ile bağlarken bu OTOMATİK GELMEZ.
  // Hash olmayınca Chrome bir kez yüklediği favicon'u uzun süre yeniden istemez ve sekmede
  // ESKİ ikon kalır (2026-08-19: Doctorium'da turkuaz görünmesinin sebebi buydu).
  // ⚠️ İKONLARI HER DEĞİŞTİRDİĞİNDE bu sürümü ARTIR (üç layout'ta birlikte).
  // apple-touch-icon + manifest ikonları da 2026-08-21'de aynı gerekçeyle versiyonlandı
  // (yalnız favicon/icon-doctorium'da vardı; iOS ana ekran ikonu ve push bildirimi ikonu
  // versiyonsuz kaldığı için aynı "eski ikon takılı kalma" riskini taşıyordu).
  // v=3 (2026-08-23, v6.137): marka seti v2 — küre favicon (koyu disk) + PWA kare ikonları.
  icons: { icon: "/favicon.ico?v=3", apple: "/apple-touch-icon.png?v=3" },
  // iOS ana ekran adı da marka-duyarlı (aynı sızıntı ekseni: Doctorium'a eklenen kısayol
  // "AURA" adıyla kaydediliyordu).
  appleWebApp: { capable: true, title: IS_DOCTORIUM_DEPLOY ? "Doctorium" : "AURA", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0d0e10", // gece varsayılanı (v6.22) — mobil tarayıcı kromu zeminle uyumlu
};

// no-flash tema script'i (2026-08-28, P0-3 denetimi) — kök layout artık `cookies()` ÇAĞIRMAZ:
// Next.js'te route ağacının HERHANGİ bir yerinde cookies()/headers() kullanılması TÜM ağacı
// dynamic'e zorluyordu (`/doctorium` sayfasındaki `export const revalidate = 600` bu yüzden
// etkisizdi — canlıda `cache-control: private, no-cache, no-store` ölçüldü). SSR'de sabit
// theme-dark yazılır; bu senkron <head> script'i (render-blocking, body parse edilmeden önce
// çalışır) cookie'yi CLIENT'ta okuyup gerekirse class'ı theme-light'a çevirir — FOUC yok.
// Cookie adı ("theme") ThemeToggle.tsx'teki THEME_COOKIE ile birebir aynı tutulmalı — o
// dosya "use client" olduğundan sabitini buraya import ETMİYORUZ (client-module veri exportu
// server component'te sorunlu; bkz. hafıza [[rsc-client-module-data-export]]), string'i burada
// tekrarlıyoruz. Kullanıcı/oturum bilgisi de aynı gerekçeyle client-side'a taşındı: AppChrome.tsx
// mount'ta /api/auth/me'yi çeker — Header zaten yalnız kozmetik, güvenlik kapısı orada değil.
const NO_FLASH_THEME_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )theme=([^;]*)/);if(m&&decodeURIComponent(m[1])==="light"){document.documentElement.classList.remove("theme-dark");document.documentElement.classList.add("theme-light");}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr" className={`theme-dark h-full antialiased ${sans.variable} ${serif.variable} ${mono.variable} ${arabic.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME_SCRIPT }} />
      </head>
      {/* data-brand (v6.203): "use client" fallback sayfaları (404/hata) BRAND_MODE'u okuyamaz —
          marka CSS token'ına (--c-cta, globals.css) bu öznitelikten iner. */}
      <body className="min-h-full flex flex-col" data-brand={IS_DOCTORIUM_DEPLOY ? "doctorium" : "aura"}>
        <PwaRegister />
        {/* Ekran dışına çıkan sürekli dekoratif animasyonları duraklatır. Kökte: landing'in
            yanı sıra uygulama içi Header/spinner sembollerini de kapsar. Render etmez (null). */}
        <AuraAnimPause />
        <AppChrome doctoriumDeploy={IS_DOCTORIUM_DEPLOY} />
        <main className="flex-1">{children}</main>
        <SiteFooter doctoriumDeploy={IS_DOCTORIUM_DEPLOY} />
      </body>
    </html>
  );
}
