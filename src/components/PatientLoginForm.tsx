"use client";

import Link from "next/link";
import { UserRound } from "lucide-react";
import { LoginForm } from "@/components/LoginForm";
import { SocialAuthButtons } from "@/components/social-auth";

// Hasta girişi (/giris) — Google (intent=patient, dormant) / Apple ("Yakında") / e-posta girişi +
// üye olma. Kurumsal roller /kurumsal-giris'e yönlendirilir; yine de e-posta formu rol-agnostiktir
// (personel derin linki buraya düşerse kilitlenmez).
export function PatientLoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  return (
    <LoginForm
      title="Hasta Girişi"
      subtitle="Sağlık yolculuğunuza güvenle devam edin"
      social={<SocialAuthButtons googleEnabled={googleEnabled} intent="patient" />}
      quick={[{ email: "hasta@air.test", label: "Hasta (demo)", icon: UserRound }]}
      footer={
        <div className="mt-4 space-y-1.5 text-center text-sm text-slate-500">
          <p>
            Hesabınız yok mu? <Link href="/kayit/hasta" className="font-semibold text-[#0EA5B2] hover:underline">Üye olun</Link>
          </p>
          <p className="text-[13px]">
            Doktor, koordinatör veya kurum çalışanı mısınız?{" "}
            <Link href="/kurumsal-giris" className="font-semibold text-[#0EA5B2] hover:underline">Kurumsal giriş →</Link>
          </p>
        </div>
      }
    />
  );
}
