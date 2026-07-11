import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { verifyTokenMatches } from "@/lib/email-verification";

// GET /api/auth/verify-email?uid=..&token=.. — e-postadaki doğrulama bağlantısı (v5.6).
// Kimliksiz uç (kullanıcı henüz giriş yapamıyor) → token tek yetki kaynağıdır: DB'de yalnız sha256
// hash'i durur, sabit-zamanlı kıyas + 24 saat TTL (lib/email-verification). Sonuç ne olursa olsun
// role uygun giriş sayfasına yönlendirilir (?verify=ok|invalid|already) — API gövdesi sızdırılmaz.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (path: string, status: string) => NextResponse.redirect(new URL(`${path}?verify=${status}`, url.origin));

  // Token tahmin/tarama freni (bağlantı tıklamaları için cömert): 20/5dk/IP
  const rl = await rateLimit(`verify-email:${clientIp(req)}`, 20, 5 * 60_000);
  if (!rl.ok) return back("/giris", "invalid");

  const uid = (url.searchParams.get("uid") ?? "").slice(0, 64);
  const token = (url.searchParams.get("token") ?? "").slice(0, 128);
  if (!uid || !token) return back("/giris", "invalid");

  const user = await db.user.findUnique({
    where: { id: uid },
    select: { id: true, role: true, emailVerifiedAt: true, emailVerifyTokenHash: true, emailVerifySentAt: true },
  });
  const loginPath = user?.role === "PATIENT" ? "/giris" : "/kurumsal-giris"; // doktor girişi kurumsal ekranda

  if (!user) return back("/giris", "invalid");
  if (user.emailVerifiedAt) return back(loginPath, "already");
  if (!verifyTokenMatches(user, token)) return back(loginPath, "invalid");

  await db.user.update({
    where: { id: user.id },
    data: { emailVerifiedAt: new Date(), emailVerifyTokenHash: null },
  });
  return back(loginPath, "ok");
}
