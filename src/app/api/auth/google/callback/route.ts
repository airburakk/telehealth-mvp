import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { roleHome, type Role } from "@/lib/session";
import { consentedVersion } from "@/lib/consent";
import { isGoogleConfigured, exchangeGoogleCode, googleRedirectUri } from "@/lib/oauth";
import { createDoctorAccount } from "@/lib/doctor-signup";

// GET /api/auth/google/callback — Google dönüşü. State (CSRF) doğrula → kod takası → email/ad.
// Mevcut kullanıcı → giriş (mevcut rol). Yeni → doktor hesabı (kimlik onboarding'de tamamlanır).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  if (!isGoogleConfigured()) return NextResponse.redirect(new URL("/kayit?oauth=unavailable", origin));

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const c = await cookies();
  const saved = c.get("g_oauth_state")?.value;
  c.delete("g_oauth_state");
  if (!code || !state || !saved || state !== saved) {
    return NextResponse.redirect(new URL("/kayit?oauth=error", origin));
  }

  const info = await exchangeGoogleCode(code, googleRedirectUri(origin));
  if (!info) return NextResponse.redirect(new URL("/kayit?oauth=error", origin));

  let user = await db.user.findUnique({ where: { email: info.email } });
  if (!user) {
    // Yeni doktor — Google yalnız ad/e-posta verir; branş/şehir/dil onboarding'de tamamlanır.
    // Parola girişi devre dışı (rastgele hash); verified:false (admin onayı bekler).
    const passwordHash = await hashPassword(randomBytes(24).toString("hex"));
    user = await createDoctorAccount({
      name: info.name, email: info.email, passwordHash,
      title: "Uzm. Dr.", branch: "", city: "", languages: "Türkçe",
    });
  }

  const cv = await consentedVersion(user.id);
  await createSession({ id: user.id, email: user.email, name: user.name, role: user.role as Role, cv });
  return NextResponse.redirect(new URL(roleHome(user.role as Role), origin));
}
