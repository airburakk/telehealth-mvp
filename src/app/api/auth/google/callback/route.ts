import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { roleHome, type Role } from "@/lib/session";
import { patientHome } from "@/lib/patient-journey";
import { consentedVersion } from "@/lib/consent";
import { isGoogleConfigured, exchangeGoogleCode, googleRedirectUri } from "@/lib/oauth";
import { createDoctorAccount } from "@/lib/doctor-signup";
import { createPatientAccount } from "@/lib/patient-signup";

// GET /api/auth/google/callback — Google dönüşü. State (CSRF) doğrula → kod takası → email/ad.
// Mevcut kullanıcı → giriş (mevcut rol; intent YOK SAYILIR — rol karışması olmaz). Yeni →
// intent=patient ise hasta hesabı, aksi halde doktor hesabı (kimlik onboarding'de tamamlanır).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;

  const c = await cookies();
  const intent = c.get("g_oauth_intent")?.value === "patient" ? "patient" : "doctor";
  c.delete("g_oauth_intent");
  // ?oauth banner'ı formda çizilir → /e-posta form rotası (kapı/form ayrımı 2026-07-12)
  const errBack = intent === "patient" ? "/giris/e-posta?oauth=error" : "/kayit?oauth=error";

  if (!isGoogleConfigured()) {
    const back = intent === "patient" ? "/giris/e-posta?oauth=unavailable" : "/kayit?oauth=unavailable";
    return NextResponse.redirect(new URL(back, origin));
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const saved = c.get("g_oauth_state")?.value;
  c.delete("g_oauth_state");
  if (!code || !state || !saved || state !== saved) {
    return NextResponse.redirect(new URL(errBack, origin));
  }

  const info = await exchangeGoogleCode(code, googleRedirectUri(origin));
  if (!info) return NextResponse.redirect(new URL(errBack, origin));

  let user = await db.user.findUnique({ where: { email: info.email } });
  if (!user) {
    // Google yalnız ad/e-posta verir; parola girişi devre dışı (rastgele hash).
    const passwordHash = await hashPassword(randomBytes(24).toString("hex"));
    if (intent === "patient") {
      user = await createPatientAccount({ name: info.name, email: info.email, passwordHash });
    } else {
      // Yeni doktor — branş/şehir/dil onboarding'de tamamlanır; verified:false (admin onayı bekler).
      user = await createDoctorAccount({
        name: info.name, email: info.email, passwordHash,
        title: "Uzm. Dr.", branch: "", city: "", languages: "Türkçe",
      });
    }
  }
  // Google e-postayı zaten doğrular (exchangeGoogleCode email_verified şartı) → hesap doğrulanmış
  // damgalanır (v5.6). E-posta kaydıyla açılıp doğrulanmadan Google ile girene de geçerli: aynı
  // posta kutusunun sahibi olduğu Google'ca kanıtlandı; bekleyen token temizlenir.
  if (!user.emailVerifiedAt) {
    await db.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date(), emailVerifyTokenHash: null },
    });
  }

  const cv = await consentedVersion(user.id);
  await createSession({ id: user.id, email: user.email, name: user.name, role: user.role as Role, cv });
  // Faz 5: dönen hasta vaka merkezine iner (başvurusu yoksa /triyaj)
  const home = user.role === "PATIENT" ? await patientHome(user.id) : roleHome(user.role as Role);
  return NextResponse.redirect(new URL(home, origin));
}
