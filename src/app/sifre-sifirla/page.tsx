import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/aura/password-reset-forms";

export const dynamic = "force-dynamic";

// Parola sıfırlama — e-postadaki bağlantının indiği sayfa (v6.194).
// uid/token SUNUCUDA okunup prop olarak geçilir: client'ta useSearchParams kullanmak Suspense
// sınırı ister ve statik prerender'da sessizce boş fallback'te kalırdı (bkz. 2026-08-28 kapı
// regresyonu). force-dynamic + prop geçişi o sınıfı tamamen dışarıda bırakır.
export const metadata: Metadata = {
  title: "Parola sıfırlama",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ uid?: string; token?: string }>;
}) {
  const sp = await searchParams;
  return <ResetPasswordForm uid={sp.uid ?? ""} token={sp.token ?? ""} />;
}
