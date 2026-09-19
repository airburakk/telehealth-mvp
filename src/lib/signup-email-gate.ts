// Kayıt rotaları için e-posta doğrulama kapısı (kontrol raporu 2026-09-17 K08, P2).
//
// Sorun: signup-* rotaları `isEmailConfigured()` false ise hesabı KAYIT ANINDA doğrulanmış damgalayıp oturum
// açıyordu (dormant kolaylığı) ve üretim ortamını ayırmıyordu: canlıda RESEND_API_KEY eksilse/silinse doğrulanmamış
// adresler "doğrulanmış" sayılırdı (fail-open). Artık kolaylık YALNIZ geliştirme/test ortamında (ya da açık bayrakla)
// çalışır; üretimde sağlayıcı yoksa kayıt güvenli hata (503) + operasyon alarmı üretir ve hesap HİÇ açılmaz.
// (login rotası 2026-08-03'ten beri aynı ilkeyle çalışır: üretimde doğrulama kapısı her hâlükârda açık + alarm.)
import { NextResponse } from "next/server";
import { isEmailConfigured } from "./email";
import { sendAlert } from "./alerts";

/** Doğrulanmamış adresi "doğrulanmış" damgalama kolaylığına izin var mı? Sağlayıcı varsa gerek yok (false).
 *  Üretimde (VERCEL_ENV ya da NODE_ENV production) yalnız açık `ALLOW_UNVERIFIED_SIGNUP=1` ile (prova/ön-izleme). */
export function unverifiedSignupAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.RESEND_API_KEY) return false;
  if (env.ALLOW_UNVERIFIED_SIGNUP === "1") return true;
  return env.VERCEL_ENV !== "production" && env.NODE_ENV !== "production";
}

/** Kayıt rotasının BAŞINDA (hesap yazılmadan): doğrulama e-postası gönderilemiyor VE bypass'a izin yoksa → 503 + alarm. */
export function signupEmailBlocked(route: string): NextResponse | null {
  if (isEmailConfigured() || unverifiedSignupAllowed()) return null;
  void sendAlert(
    "email-provider-missing",
    "Üretimde e-posta sağlayıcısı yapılandırılmamış — kayıt kapalı, doğrulama e-postası gönderilemiyor (SEV-2)",
    route,
  );
  return NextResponse.json(
    { error: "Kayıt şu anda geçici olarak kapalı; lütfen daha sonra tekrar deneyin.", code: "EMAIL_PROVIDER_MISSING" },
    { status: 503 },
  );
}
