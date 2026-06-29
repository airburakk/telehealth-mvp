import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { checkPassword } from "@/lib/auth";
import { shareState, SHARE_UNLOCK_PREFIX } from "@/lib/share";
import { rateLimit, clientIp, tooMany } from "@/lib/rate-limit";

// POST /api/shares/:id/unlock — doktor erişim şifresini doğrular (girişsiz, public)
// Başarılıysa kısa ömürlü httpOnly çerez set eder; görüntüleyici sayfası bunu kontrol eder.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rl = rateLimit(`unlock:${clientIp(req)}:${id}`, 10, 5 * 60_000); // şifre-deneme freni: 10/5dk/IP/link
  if (!rl.ok) return tooMany(rl.retryAfter);
  const link = await db.shareLink.findUnique({ where: { id } });
  if (!link) return NextResponse.json({ error: "Geçersiz bağlantı." }, { status: 404 });
  if (shareState(link) !== "ACTIVE") {
    return NextResponse.json({ error: "Bağlantı artık aktif değil." }, { status: 410 });
  }

  const b = await req.json().catch(() => ({}));
  if (link.passwordHash) {
    const ok = await checkPassword(String(b.password || ""), link.passwordHash);
    if (!ok) return NextResponse.json({ error: "Şifre hatalı." }, { status: 401 });
  }

  const c = await cookies();
  c.set(`${SHARE_UNLOCK_PREFIX}${link.id}`, "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // T5: HTTPS-only (üretim)
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60, // 1 saat
  });
  return NextResponse.json({ ok: true });
}
