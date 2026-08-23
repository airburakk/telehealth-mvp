import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { isGoogleConfigured, googleAuthUrl, googleRedirectUri, isSafeNextPath } from "@/lib/oauth";

// GET /api/auth/google/start?intent=patient|doctor&next=/hedef — Google OAuth başlat.
// Yapılandırılmamışsa intent'e uygun sayfaya dormant uyarısıyla döner; aksi halde CSRF state +
// intent (+ varsa next) cookie'leri set edip Google onay ekranına yönlendirir. intent: yeni
// hesabın rolünü belirler (callback okur). next: mevcut kullanıcı girişte döneceği sayfa (kapı
// e-posta formunun ?next davranışıyla aynı — önceden yalnız o yolda korunuyordu).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const intent = url.searchParams.get("intent") === "patient" ? "patient" : "doctor";
  if (!isGoogleConfigured()) {
    // ?oauth banner'ı kapı-içi formda çizilir (2026-08-06 — /e-posta alt rotası kaldırıldı)
    const back = intent === "patient" ? "/giris?oauth=unavailable" : "/kayit?oauth=unavailable";
    return NextResponse.redirect(new URL(back, origin));
  }
  const state = randomBytes(16).toString("hex");
  const c = await cookies();
  const opts = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 600 };
  c.set("g_oauth_state", state, opts);
  c.set("g_oauth_intent", intent, opts); // state deseni değişmez — niyet ayrı cookie'de taşınır
  const next = url.searchParams.get("next");
  if (isSafeNextPath(next)) c.set("g_oauth_next", next, opts);
  return NextResponse.redirect(googleAuthUrl(state, googleRedirectUri(origin)));
}
