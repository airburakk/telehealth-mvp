import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import { PwaRegister } from "@/components/PwaRegister";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { effectiveNavJourney } from "@/lib/nav";

// Uygulama geneli tipografi — vitrin (aura-health) ile aynı aile: Inter gövde + Space Grotesk
// display (--font-serif değişken adı tarihsel; display yuvası olarak kullanılır) + JetBrains Mono
// mikro/durak. Inter, Hanken'in aksine Kiril kapsar (RU pazarı markalı kalır; Arapça hâlâ fallback).
const sans = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-sans", display: "swap" });
const serif = Space_Grotesk({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700"], variable: "--font-serif", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin", "latin-ext"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "AURA — Sağlık Turizmi & Teletıp",
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
  // Hasta yolculuğu (başvurulan akışta damgalanır — lib/patient-journey) → nav bileşimi (SO hastasında Paylaşımlarım gizli, Vakalarım→SO).
  // Karma-kulvar: SO damgalı hastanın GENERAL vakası da varsa SO daraltması uygulanmaz (lib/nav
  // effectiveNavJourney) — count sorgusu yalnız SO-damgalı hastada koşar.
  let journey: string | null = null;
  if (user?.role === "PATIENT") {
    const u = await db.user.findUnique({ where: { id: user.id }, select: { patientJourney: true } });
    const generalCount = u?.patientJourney === "SECOND_OPINION" ? await db.case.count({ where: { userId: user.id } }) : 0;
    journey = effectiveNavJourney(u?.patientJourney, generalCount > 0);
  }
  return (
    <html lang="tr" className={`h-full antialiased ${sans.variable} ${serif.variable} ${mono.variable}`}>
      <body className="min-h-full flex flex-col">
        <PwaRegister />
        <Header user={user ? { name: user.name, role: user.role } : null} lang={headerLang} journey={journey} />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
