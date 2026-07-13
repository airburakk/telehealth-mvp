import { Suspense } from "react";
import { CorporateLoginForm } from "@/components/CorporateLoginForm";

// Kurumsal e-posta girişi — Doktor, Koordinatör, Etik Kurul, Partner Doktor, Acente.
// /kurumsal-giris vitrin kapısının "Girişe devam" hedefi (kapı/form ayrımı 2026-07-12;
// önceden bu form /kurumsal-giris'in kendisiydi). Halka açık (proxy matcher dışı);
// hasta girişi /giris/e-posta'da ayrıdır. Form içeriği CorporateLoginForm'da
// ("use client" — ikon fonksiyonları server'dan geçirilemez).
export default function CorporateEmailLoginPage() {
  return (
    <div className="grid min-h-[calc(100vh-8rem)] place-items-center bg-[var(--c-bg)] px-5 py-10">
      <Suspense fallback={<div className="text-sm text-[var(--c-ink-3)]">Yükleniyor…</div>}>
        <CorporateLoginForm />
      </Suspense>
    </div>
  );
}
