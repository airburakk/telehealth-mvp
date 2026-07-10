"use client";

import Link from "next/link";
import { Stethoscope, Headphones, Scale, Globe, Luggage } from "lucide-react";
import { LoginForm } from "@/components/LoginForm";

// Kurumsal giriş formu — Doktor, Koordinatör, Etik Kurul, Partner Doktor, Sağlık Turizmi Acentesi.
// "use client" ZORUNLU: quick[] lucide ikon FONKSİYONLARI taşır; server component'ten client'a
// prop geçirilemez (RSC serileştirme — tsc/build yakalamaz, runtime kırar; [[rsc-client-module-data-export]] dersi).
const STAFF_QUICK = [
  { email: "doktor@air.test", label: "Doktor", icon: Stethoscope },
  { email: "koordinator@air.test", label: "Koordinatör", icon: Headphones },
  { email: "kurul@air.test", label: "Etik Kurul", icon: Scale },
  { email: "partner@air.test", label: "Partner Doktor", icon: Globe },
  { email: "acente@air.test", label: "Sağlık Turizmi Acentesi", icon: Luggage }, // S3 — FAZ 4 (2026-07-10)
];

export function CorporateLoginForm() {
  return (
    <LoginForm
      title="Kurumsal Giriş"
      subtitle="Doktor · Koordinatör · Etik Kurul · Partner Doktor · Sağlık Turizmi Acentesi"
      quick={STAFF_QUICK}
      footer={
        <div className="mt-4 space-y-1.5 text-center text-sm text-slate-500">
          <p>
            Doktor musunuz? <Link href="/kayit" className="font-semibold text-[#0EA5B2] hover:underline">Kayıt olun</Link>
          </p>
          <p className="text-[13px]">
            Hasta mısınız? <Link href="/giris" className="font-semibold text-[#0EA5B2] hover:underline">Hasta girişi →</Link>
          </p>
        </div>
      }
    />
  );
}
