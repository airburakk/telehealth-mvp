import Link from "next/link";
import type { CSSProperties } from "react";
import { DoctoriumFooter } from "@/components/aura/doctorium-footer";

// Doctorium kayıt kabuğu (AURA↔Doctorium ayrışması Faz B, 2026-08-24) — /doctorium/kayit +
// /doctorium/ogrenci ortak sarmalayıcısı. Landing'in "Doctorium'unu oluştur" CTA'sı artık AURA
// kromlu /kayit'a değil buraya gelir; AURA'nın kendi /kayit + /ogrenci sayfaları AURA tarafından
// gelenler için AYNEN durur (form bileşenleri ortak — brand prop'u yalnız görünümü seçer).
//
// GECE-KİLİTLİ (theme-dark): kapılarla aynı koyu vitrin ailesi — zemin Doctorium marka koyusu
// #0d0e10 (DOCTORIUM_PALETTE --dl-bg). Global AURA kromu chrome-routes.ts'te gizlenir.
//
// Vurgu ezmesi: --c-accent* burada TURKUAZ→ZÜMRÜT remap edilir — DoctorSignupForm /
// StudentGateForm / SocialAuthButtons hiçbir renk prop'u almadan zümrüt vurguyla çizilir
// (tek nokta; bileşen bileşen renk taşımak drift üretirdi). Buton metinleri text-[var(--c-bg)]
// okuduğundan zümrüt dolgu üstüne #0d0e10 düşer — landing CTA diliyle aynı.
const EMERALD_VARS = {
  "--c-bg": "#0d0e10",
  "--c-accent": "#34d399",
  "--c-accent-strong": "#2bb583",
  "--c-accent-stronger": "#6ee7b7",
} as CSSProperties;

export function DoctoriumSignupShell({ children }: { children: React.ReactNode }) {
  return (
    <div lang="tr" className="theme-dark flex min-h-dvh flex-col bg-[var(--c-bg)]" style={EMERALD_VARS}>
      <div className="mx-auto w-full max-w-md flex-1 px-5 py-10">
        <Link
          href="/doctorium"
          className="aura-mono text-[13px] text-[var(--c-ink-3)] transition-colors duration-200 hover:text-[var(--c-accent)]"
        >
          ← Doctorium&apos;a dön
        </Link>
        <div className="mt-6">{children}</div>
      </div>
      <DoctoriumFooter />
    </div>
  );
}
