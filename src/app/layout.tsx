import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "AIR Telehealth — Sağlık Turizmi Platformu",
  description:
    "Triyaj, uzman görüşü ve sağlık turizmi paketlerini birleştiren uçtan uca dijital sağlık platformu (MVP).",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  return (
    <html lang="tr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
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
