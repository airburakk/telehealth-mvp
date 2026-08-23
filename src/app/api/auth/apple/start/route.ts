import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { isAppleConfigured, appleAuthUrl, appleRedirectUri, isSafeNextPath } from "@/lib/oauth";

// GET /api/auth/apple/start?intent=patient|doctor&next=/hedef — "Apple ile devam et" akışını
// başlatır. next: Google start'ının eşleniği (mevcut kullanıcı girişte döneceği sayfa).
// Google start rotasının eşleniği (state + intent cookie → sağlayıcıya 302), iki farkla:
//
//  · NONCE eklenir: Apple kimliği ID token içinde döndürür; nonce o token'ın BU akışa ait olduğunu
//    kanıtlar (state CSRF'i, nonce yeniden-oynatmayı kapatır).
//  · COOKIE'LER SameSite=None; Secure. Sebep: Apple dönüşü `form_post` ile, yani Apple'ın alan
//    adından bize gelen bir POST'la yapar. SameSite=Lax cookie cross-site POST'ta GÖNDERİLMEZ →
//    Google'daki Lax ayarı kopyalansaydı callback her seferinde "state uyuşmadı" ile ölürdü.
//    ⚠️ Bunun bedeli: None → Secure zorunlu (tarayıcı kuralı) → akış YALNIZ HTTPS'te çalışır.
//    Apple zaten http/localhost Return URL kabul etmez; bu akış yerelde denenemez, doğrulaması
//    birim testler + gerçek alan adında canlı turdur.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const intent = url.searchParams.get("intent") === "patient" ? "patient" : "doctor";

  // ?oauth banner'ı kapı-içi formda çizilir (2026-08-06 — /e-posta alt rotası kaldırıldı)
  const back = (reason: string) =>
    intent === "patient"
      ? `/giris?oauth=${reason}&provider=apple`
      : `/kayit?oauth=${reason}&provider=apple`;

  if (!isAppleConfigured()) return NextResponse.redirect(new URL(back("unavailable"), origin));

  const state = randomBytes(16).toString("hex");
  const nonce = randomBytes(16).toString("hex");
  const opts = { httpOnly: true, secure: true, sameSite: "none" as const, path: "/", maxAge: 600 };
  const c = await cookies();
  c.set("a_oauth_state", state, opts);
  c.set("a_oauth_nonce", nonce, opts);
  c.set("a_oauth_intent", intent, opts); // yeni hesabın rolünü belirler (callback okur)
  const next = url.searchParams.get("next");
  if (isSafeNextPath(next)) c.set("a_oauth_next", next, opts);

  return NextResponse.redirect(appleAuthUrl(state, nonce, appleRedirectUri(origin)));
}
