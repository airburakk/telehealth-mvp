import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Space_Grotesk, Inter, JetBrains_Mono, Noto_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import { PwaRegister } from "@/components/PwaRegister";
import { MasterBar } from "@/components/MasterBar";
import { AuraAnimPause } from "@/components/aura/anim-pause";
import { getCurrentUser } from "@/lib/auth";
import { isMaster } from "@/lib/master";
import { db } from "@/lib/db";
import { SITE_URL } from "@/lib/aura-landing/seo";
import { IS_DOCTORIUM_DEPLOY } from "@/lib/brand";

// Uygulama geneli tipografi — vitrin (aura-health) ile aynı aile: Inter gövde + Space Grotesk
// display (--font-serif değişken adı tarihsel; display yuvası olarak kullanılır) + JetBrains Mono
// mikro/durak. `subsets` YALNIZ PRELOAD'u belirler — @font-face kuralları diğer subset'leri de
// içerir ve unicode-range ile talep üzerine iner. Inter Kiril kapsar → RU/KK/KY/BG markalı (ölçüldü
// 2026-07-15: gerçek Inter face'i U+400-45F'i kapsıyor). Space Grotesk Kiril kapsamaz → RU/BG
// başlıkları fallback (kabul; Google Fonts'ta Kiril subset'i yok).
const sans = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-sans", display: "swap" });
const serif = Space_Grotesk({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700"], variable: "--font-serif", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin", "latin-ext"], variable: "--font-mono", display: "swap" });
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
  title: { default: "AURA Health", template: "%s · AURA" },
  // "uçtan uca" bilinçli YOK (vitrin iddia disiplini v6.8/v6.18 — ana sayfayla hizalı; kullanıcı onayı 2026-07-18).
  description:
    "Triyaj, uzman görüşü ve sağlık turizmi paketlerini birleştiren dijital sağlık platformu (MVP).",
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
  appleWebApp: { capable: true, title: "AURA", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0d0e10", // gece varsayılanı (v6.22) — mobil tarayıcı kromu zeminle uyumlu
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Kök layout HER sayfada (vitrin dahil) çalışır → oturum okuması DB'ye gider. DB erişilemezse
  // (Neon scale-to-zero uyanması / kesinti) buradan fırlayan hata TÜM siteyi error.tsx'e düşürürdü:
  // statik landing bile 500 verirdi (2026-07-15, digest 2661872092). Hata yutulur ve misafir kabuk
  // çizilir. FAIL-CLOSED yöndedir: user=null EN AZ yetkidir, oturum "kurtarılmaz" — korunan
  // sayfa/API kendi getCurrentUser/requireUser kapısında yine reddeder. getCurrentUser'ın sv/rol
  // doğrulaması KASTEN atlanmaz (token'dan devam etmek iptal edilmiş oturumu geçirir = fail-open).
  let user: Awaited<ReturnType<typeof getCurrentUser>> = null;
  try {
    user = await getCurrentUser();
  } catch {
    user = null;
  }
  // Partner doktorun global Header'ı kendi dilinde (diğer roller Türkçe — useT no-op).
  let headerLang = "Türkçe";
  if (user?.role === "PARTNER") {
    // Aynı gerekçe: dil tercihi kozmetiktir, kabuğu düşürmemeli (havuz tükenmesi vb.).
    try {
      const u = await db.user.findUnique({ where: { id: user.id }, select: { partnerId: true } });
      const p = u?.partnerId ? await db.partnerDoctor.findUnique({ where: { id: u.partnerId }, select: { language: true } }) : null;
      headerLang = p?.language || "İngilizce";
    } catch {
      headerLang = "İngilizce";
    }
  }
  // v6.95 — öğrenci hunisi kromu (kullanıcı kararı 2026-08-14): studentTrack hesapta Header bandı
  // yalnız Doctorium, hesap menüsünde Profilim/Finans gizli. PARTNER dil sorgusuyla aynı gerekçeyle
  // try/catch: krom kozmetiktir, DB tökezlerse normal doktor kromuna düşer (kapılar sayfa/API'de).
  // v6.105 — AŞAMA 1 kromu (kullanıcı kararı 2026-08-17): klinik aktivasyonu OLMAYAN doktor
  // (activatedAt boş = AURA üyeliği yok) da sade Doctorium kromu görür — bant boş, hesap
  // menüsünde Profilim/Finans yok, marka toggle'ının AURA yarısı soluk. Öğrenci kendi dalında
  // kalır (studentTrack önce bakılır): ikisi çakışmaz, öğrenci etiketi "Doktor" yazmaz.
  let studentHeader = false;
  let stage1Header = false;
  if (user?.role === "DOCTOR") {
    try {
      const u = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
      const d = u?.doctorId
        ? await db.doctor.findUnique({ where: { id: u.doctorId }, select: { studentTrack: true, activatedAt: true } })
        : null;
      studentHeader = !!d?.studentTrack;
      stage1Header = !!d && !d.studentTrack && !d.activatedAt;
    } catch {
      studentHeader = false;
      stage1Header = false;
    }
  }
  // Tam birleşme (2026-07-12): nav journey'ye bakmaz — hasta nav'ı herkes için aynı,
  // patientJourney sorgusu layout'tan kalktı.
  // GECE VARSAYILAN + tema anahtarı (v6.22, kullanıcı kararı): tercih aura_theme cookie'sinde —
  // SSR ilk boyamada doğru temayı basar (FOUC yok). Cookie yoksa gece. Landing kendi
  // .aura-* token'larında, tema sınıfından bağımsız.
  const themeCookie = (await cookies()).get("aura_theme")?.value;
  const theme = themeCookie === "light" ? "light" : "dark";
  return (
    <html lang="tr" className={`theme-${theme} h-full antialiased ${sans.variable} ${serif.variable} ${mono.variable} ${arabic.variable}`}>
      <body className="min-h-full flex flex-col">
        <PwaRegister />
        {/* Ekran dışına çıkan sürekli dekoratif animasyonları duraklatır. Kökte: landing'in
            yanı sıra uygulama içi Header/spinner sembollerini de kapsar. Render etmez (null). */}
        <AuraAnimPause />
        <Header user={user ? { name: user.name, role: user.role } : null} lang={headerLang} theme={theme} student={studentHeader} stage1={stage1Header} doctoriumDeploy={IS_DOCTORIUM_DEPLOY} />
        {user?.imp ? <MasterBar mode="impersonating" userName={user.name} /> : isMaster(user) ? <MasterBar mode="master" /> : null}
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
