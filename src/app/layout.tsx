import type { Metadata, Viewport } from "next";
import { Newsreader, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import { PwaRegister } from "@/components/PwaRegister";
import { getCurrentUser } from "@/lib/auth";

// Uygulama geneli tipografi — landing ile aynı aile (Hanken Grotesk gövde + Newsreader başlık).
// Önceden uygulama içi Segoe UI/system-ui kullanıyordu; bu, landing↔uygulama kalite uçurumunu kapatır.
const sans = Hanken_Grotesk({ subsets: ["latin", "latin-ext"], weight: ["300", "400", "500", "600", "700"], variable: "--font-sans", display: "swap" });
const serif = Newsreader({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600"], variable: "--font-serif", display: "swap" });

export const metadata: Metadata = {
  title: "AURA — Sağlık Turizmi & Teletıp",
  description:
    "Triyaj, uzman görüşü ve sağlık turizmi paketlerini birleştiren uçtan uca dijital sağlık platformu (MVP).",
  manifest: "/manifest.webmanifest",
  icons: { apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "AURA", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#101010",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  return (
    <html lang="tr" className={`h-full antialiased ${sans.variable} ${serif.variable}`}>
      <body className="min-h-full flex flex-col">
        <PwaRegister />
        <Header user={user ? { name: user.name, role: user.role } : null} />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
