import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { brandRoleHome, type Role } from "@/lib/roles";
import { gateConsentVersion } from "@/lib/doctorium-consent";
import { reqMeta } from "@/lib/audit";
import { recordLogin } from "@/lib/login-activity";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { canUseLoginLink, hashLoginToken, loginTokenMatches } from "@/lib/login-link";

export const dynamic = "force-dynamic";

// GET /api/auth/verify-login-link?uid=..&token=.. — e-postadaki giriş bağlantısı (üç katman Faz A3).
// Oturum GEREKMEZ: yetkiyi TOKEN taşır → her adım savunma katmanıdır.
//
// reset-password'den FARKI (bilinçli): burada OTURUM AÇILIR — deneme hesabının parolası YOKTUR, posta
// kutusu tek kimliktir (Google/Apple ile aynı güven modeli). Bu yüzden kapı iki kilitlidir: token
// eşleşmesi (sabit zamanlı + 20 dk TTL) VE canUseLoginLink (yalnız parolasız DOCTOR, silinmemiş).
// Parolalı hesaba hiç bağlantı üretilmez (lib/login-link) ama üretilmiş olsa bile burada reddedilir.
//
// TEK KULLANIM ATOMİK: updateMany({where:{id, loginTokenHash}}) — aynı bağlantıyı iki sekmede/yarışta
// açan ikinci istek count=0 alır ve oturum kuramaz. Başarıda e-posta doğrulanmış damgalanır (bağlantı
// yalnız o kutuya gitti). İlk girişte proxy /onam'a (Doctorium seti) düşürür — mevcut mekanizma.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const back = (status: string) => NextResponse.redirect(new URL(`/doctorium/kayit?link=${status}`, origin));

  // Token tahmin/tarama freni (verify-email ile aynı cömertlik): 20/5dk/IP.
  const rl = await rateLimit(`verify-login-link:${clientIp(req)}`, 20, 5 * 60_000);
  if (!rl.ok) return back("invalid");

  const uid = (url.searchParams.get("uid") ?? "").slice(0, 64);
  const token = (url.searchParams.get("token") ?? "").slice(0, 128);
  if (!uid || !token) return back("invalid");

  const user = await db.user.findUnique({
    where: { id: uid },
    select: {
      id: true, email: true, name: true, role: true, deletedAt: true, passwordSetAt: true,
      emailVerifiedAt: true, loginTokenHash: true, loginTokenSentAt: true,
    },
  });
  // Geçersiz/süresi dolmuş/kullanılmış token, parolalı hesap ve silinmiş kabuk AYNI yanıtı alır.
  if (!user || !canUseLoginLink(user) || !loginTokenMatches(user, token)) return back("invalid");

  const consumed = await db.user.updateMany({
    where: { id: user.id, loginTokenHash: hashLoginToken(token) },
    data: {
      loginTokenHash: null,
      loginTokenSentAt: null,
      emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
      emailVerifyTokenHash: null,
    },
  });
  if (consumed.count !== 1) return back("invalid"); // yarış: bağlantı bir saniye önce kullanıldı

  const cv = await gateConsentVersion(user.id, "DOCTOR");
  const session = { id: user.id, email: user.email, name: user.name, role: "DOCTOR" as Role, cv };
  await createSession(session);
  const meta = reqMeta(req);
  await recordLogin(session, "baglanti", meta.ip, meta.userAgent);

  return NextResponse.redirect(new URL(brandRoleHome("DOCTOR"), origin));
}
