import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, revokeUserSessions } from "@/lib/auth";
import { recordAccess, reqMeta } from "@/lib/audit";
import { resetTokenMatches } from "@/lib/password-reset";
import { rateLimit, clientIp, tooMany } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const MIN_LENGTH = 8;

// POST /api/auth/reset-password — e-postadaki bağlantıyla parola belirleme (v6.194). Oturum GEREKMEZ:
// yetkiyi TOKEN taşır. Bu yüzden buradaki her adım savunma katmanıdır.
//
// 🔑 OTURUM AÇILMAZ (bilinçli): başarıyla biten sıfırlama kullanıcıyı içeri ALMAZ, giriş kapısına
// yollar. Sıfırlama bağlantısı paylaşılan/ele geçmiş bir posta kutusundan gelmiş olabilir; "link =
// anında oturum" o kutuyu doğrudan hesap erişimine çevirirdi. Parolayı bilen kişi zaten girebilir.
//
// 🔑 TÜM OTURUMLAR DÜŞER: hesabı ele geçiren birinin açık oturumu varsa, sıfırlama onu da atmalı —
// aksi hâlde meşru sahip parolayı değiştirir ama saldırgan içeride kalırdı.
export async function POST(req: Request) {
  const rl = await rateLimit(`reset-password:${clientIp(req)}`, 10, 15 * 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  const body = await req.json().catch(() => ({}));
  const uid = String(body?.uid ?? "").trim().slice(0, 64);
  const token = String(body?.token ?? "").trim().slice(0, 128);
  const password = String(body?.password ?? "");

  if (password.length < MIN_LENGTH) {
    return NextResponse.json({ error: `Parola en az ${MIN_LENGTH} karakter olmalı.` }, { status: 400 });
  }

  const user = uid
    ? await db.user.findUnique({
        where: { id: uid },
        select: {
          id: true, email: true, name: true, role: true, deletedAt: true,
          emailVerifiedAt: true, passwordResetTokenHash: true, passwordResetSentAt: true,
        },
      })
    : null;

  // Geçersiz/süresi dolmuş/kullanılmış token ile silinmiş hesap AYNI yanıtı alır — hangi uid'in
  // gerçek olduğu buradan öğrenilemesin. Mesaj kullanıcıya ne yapacağını da söyler.
  if (!user || user.deletedAt || !resetTokenMatches(user, token)) {
    return NextResponse.json(
      { error: "Bağlantı geçersiz ya da süresi dolmuş. Lütfen yeniden sıfırlama isteyin." },
      { status: 400 },
    );
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(password),
      passwordSetAt: new Date(),
      // TEK KULLANIMLIK: hash null'lanır → aynı bağlantı ikinci kez çalışmaz.
      passwordResetTokenHash: null,
      passwordResetSentAt: null,
      // ⚠️ E-POSTA DOĞRULAMASI DA DAMGALANIR (akışın çalışması için ŞART, süs değil): giriş ucu
      // `emailGateActive && !emailVerifiedAt` ile doğrulanmamış hesabı REDDEDİYOR. Damgalanmasaydı
      // kullanıcı parolayı sıfırlar ama YİNE giremezdi — kilitlenme kapanmazdı. Dayanak sağlam:
      // bağlantı yalnız o posta kutusuna gitti, açan kişi kutunun denetimini kanıtlamış oldu.
      emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
      emailVerifyTokenHash: null,
    },
  });

  await revokeUserSessions(user.id);

  const meta = reqMeta(req);
  await recordAccess({
    // actor null: istek OTURUMSUZ geldi, kimliği token kanıtladı. Özne alanı hesabın kendisidir.
    actor: null,
    action: "PASSWORD_RESET",
    resourceType: "User",
    resourceId: user.id,
    subjectUserId: user.id,
    detail: "e-posta bağlantısıyla sıfırlandı; tüm oturumlar düşürüldü",
    ...meta,
  });

  return NextResponse.json({ ok: true });
}
