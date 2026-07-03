import { Suspense } from "react";
import { CorporateLoginForm } from "@/components/CorporateLoginForm";

// Kurumsal giriş — Doktor, Koordinatör, Etik Kurul, Partner Doktor. Halka açık (proxy matcher dışı);
// hasta girişi /giris'te ayrıdır. Landing üst bandındaki "Kurumsal Giriş" butonu buraya gelir.
// Form içeriği CorporateLoginForm'da ("use client" — ikon fonksiyonları server'dan geçirilemez).
export default function CorporateLoginPage() {
  return (
    <div className="grid min-h-[calc(100vh-8rem)] place-items-center px-5 py-10">
      <Suspense fallback={<div className="text-sm text-slate-400">Yükleniyor…</div>}>
        <CorporateLoginForm />
      </Suspense>
    </div>
  );
}
