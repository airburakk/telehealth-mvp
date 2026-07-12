import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import { PwaRegister } from "@/components/PwaRegister";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { SITE_URL } from "@/lib/aura-landing/seo";

// Uygulama geneli tipografi — vitrin (aura-health) ile aynı aile: Inter gövde + Space Grotesk
// display (--font-serif değişken adı tarihsel; display yuvası olarak kullanılır) + JetBrains Mono
// mikro/durak. Inter, Hanken'in aksine Kiril kapsar (RU pazarı markalı kalır; Arapça hâlâ fallback).
const sans = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-sans", display: "swap" });
const serif = Space_Grotesk({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700"], variable: "--font-serif", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin", "latin-ext"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  // metadataBase: canonical + OpenGraph göreli URL'lerini mutlaklaştırır (yoksa Next uyarı verir).
  metadataBase: new URL(SITE_URL),
  // Sekme başlığı sadeleştirildi (2026-07-12, kullanıcı kararı): üst banttaki yalın-logo diliyle hizalı.
  // Sayfalar kendi title'ını verebilir; landing/how-it-works zengin başlık taşır.
  title: { default: "AURA Health", template: "%s · AURA" },
  description:
    "Triyaj, uzman görüşü ve sağlık turizmi paketlerini birleştiren uçtan uca dijital sağlık platformu (MVP).",
  manifest: "/manifest.webmanifest",
  icons: { apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "AURA", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0D0E10",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  // Partner doktorun global Header'ı kendi dilinde (diğer roller Türkçe — useT no-op).
  let headerLang = "Türkçe";
  if (user?.role === "PARTNER") {
    const u = await db.user.findUnique({ where: { id: user.id }, select: { partnerId: true } });
    const p = u?.partnerId ? await db.partnerDoctor.findUnique({ where: { id: u.partnerId }, select: { language: true } }) : null;
    headerLang = p?.language || "İngilizce";
  }
  // Tam birleşme (2026-07-12): nav journey'ye bakmaz — hasta nav'ı herkes için aynı,
  // patientJourney sorgusu layout'tan kalktı.
  return (
    <html lang="tr" className={`h-full antialiased ${sans.variable} ${serif.variable} ${mono.variable}`}>
      <body className="min-h-full flex flex-col">
        <PwaRegister />
        <Header user={user ? { name: user.name, role: user.role } : null} lang={headerLang} />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
