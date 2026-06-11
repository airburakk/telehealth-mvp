import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import { PwaRegister } from "@/components/PwaRegister";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "portamed — Sağlık Turizmi & Teletıp",
  description:
    "Triyaj, uzman görüşü ve sağlık turizmi paketlerini birleştiren uçtan uca dijital sağlık platformu (MVP).",
  manifest: "/manifest.webmanifest",
  icons: { apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "portamed", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0A3F39",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  return (
    <html lang="tr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <PwaRegister />
        <Header user={user ? { name: user.name, role: user.role } : null} />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
