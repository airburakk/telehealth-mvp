import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/aura/password-reset-forms";

export const dynamic = "force-dynamic";

// "Şifremi unuttum" — sıfırlama bağlantısı isteme sayfası (v6.194).
// Kimlik kurtarma yüzeyi arama sonuçlarında yer almaz (giriş kapılarıyla aynı karar).
export const metadata: Metadata = {
  title: "Parolamı unuttum",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
