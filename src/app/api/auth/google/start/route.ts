import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { isGoogleConfigured, googleAuthUrl, googleRedirectUri } from "@/lib/oauth";

// GET /api/auth/google/start — Google OAuth başlat. Yapılandırılmamışsa kayıt sayfasına dormant
// uyarısıyla döner; aksi halde CSRF state cookie set edip Google onay ekranına yönlendirir.
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  if (!isGoogleConfigured()) {
    return NextResponse.redirect(new URL("/kayit?oauth=unavailable", origin));
  }
  const state = randomBytes(16).toString("hex");
  const c = await cookies();
  c.set("g_oauth_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 600 });
  return NextResponse.redirect(googleAuthUrl(state, googleRedirectUri(origin)));
}
