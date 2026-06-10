import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { PwaRegister } from "@/components/PwaRegister";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "AIR Telehealth — Sağlık Turizmi Platformu",
  description:
    "Triyaj, uzman görüşü ve sağlık turizmi paketlerini birleştiren uçtan uca dijital sağlık platformu (MVP).",
  manifest: "/manifest.webmanifest",
  icons: { apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "AIR Telehealth", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0f2a4a",
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
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-5 py-5 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
            <span>AIR Telehealth · MVP v0.1 · Demo amaçlıdır</span>
            <span>S1 Yazılım · S2 Operasyon · S3 Acenta</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
