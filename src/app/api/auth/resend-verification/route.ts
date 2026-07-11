import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit, clientIp, tooMany } from "@/lib/rate-limit";
import { isEmailConfigured } from "@/lib/email";
import { issueVerificationEmail, RESEND_COOLDOWN_MS } from "@/lib/email-verification";

// POST /api/auth/resend-verification {email} — doğrulama e-postasını yeniden gönder (v5.6).
// Kimliksiz uç (doğrulanmamış kullanıcı giriş YAPAMAZ) → yanıt daima jenerik: hesabın var
// olup olmadığı / doğrulanma durumu SIZDIRILMAZ (hesap-keşfi yüzeyi açılmaz). Gerçek gönderim
// yalnız (hesap var + doğrulanmamış + soğuma geçti) ise olur; eski token yenisiyle geçersizleşir.
export async function POST(req: Request) {
  const rl = await rateLimit(`resend-verify:${clientIp(req)}`, 5, 10 * 60_000); // 5/10dk/IP
  if (!rl.ok) return tooMany(rl.retryAfter);

  const generic = NextResponse.json({
    ok: true,
    message: "Bu adrese kayıtlı doğrulanmamış bir hesap varsa doğrulama bağlantısı gönderildi.",
  });

  if (!isEmailConfigured()) return generic; // dormant: sessiz no-op

  const b = await req.json().catch(() => ({}));
  const email = String(b.email ?? "").trim().toLowerCase().slice(0, 200);
  if (!email) return generic;

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, emailVerifiedAt: true, emailVerifySentAt: true },
  });
  if (!user || user.emailVerifiedAt) return generic;
  if (user.emailVerifySentAt && Date.now() - user.emailVerifySentAt.getTime() < RESEND_COOLDOWN_MS) {
    return generic; // soğuma: 2 dk içinde tekrar üretme (posta bombardımanı freni)
  }

  await issueVerificationEmail({ id: user.id, email: user.email, name: user.name }, new URL(req.url).origin);
  return generic;
}
