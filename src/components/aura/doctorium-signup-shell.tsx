import Link from "next/link";
import type { CSSProperties } from "react";
import { LandingFooterV3 } from "@/components/aura/doctorium-v3/Footer";

// Doctorium kayıt kabuğu (AURA↔Doctorium ayrışması Faz B, 2026-08-24) — /doctorium/kayit +
// /doctorium/ogrenci ortak sarmalayıcısı. Landing'in "Doctorium'unu oluştur" CTA'sı buraya
// gelir; AURA'nın kendi /kayit + /ogrenci sayfaları AURA tarafından gelenler için AYNEN durur
// (form bileşenleri ortak — brand prop'u yalnız görünümü seçer).
//
// v3 hizalama (2026-08-26, "GECE-KİLİTLİ" süpersede): kabuk AÇIK — landing V3'ün zebra'sız
// dünyasıyla aynı zemin (#fbfbfa). Formlar --c-* konuştuğu için `theme-light` sınıfı yeter;
// vurgu ezmesi zümrütte kalır ama AÇIK-AA değerlerle (#047857 ailesi — eski #34d399 açık
// zeminde AA altı). Buton metni sözleşmesi (text-[var(--c-bg)]) açıkta da doğru çalışır:
// koyu zümrüt dolgu üstüne --c-bg'nin açık değeri düşer.
const EMERALD_VARS = {
  "--c-bg": "#fbfbfa",
  "--c-accent": "#047857",
  "--c-accent-strong": "#065f46",
  "--c-accent-stronger": "#059669",
} as CSSProperties;

export function DoctoriumSignupShell({ children }: { children: React.ReactNode }) {
  return (
    <div lang="tr" className="theme-light flex min-h-dvh flex-col bg-[var(--c-bg)]" style={EMERALD_VARS}>
      <div className="mx-auto w-full max-w-md flex-1 px-5 py-10">
        <Link
          href="/doctorium"
          className="text-[13px] text-[var(--c-ink-3)] transition-colors duration-200 hover:text-[var(--c-accent)]"
        >
          ← Doctorium&apos;a dön
        </Link>
        <div className="mt-6">{children}</div>
      </div>
      <LandingFooterV3 />
    </div>
  );
}
