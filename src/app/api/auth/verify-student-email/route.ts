import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { verifyTokenMatches } from "@/lib/email-verification";

// GET /api/auth/verify-student-email?uid=..&token=.. — üniversite e-postasındaki doğrulama
// bağlantısı (v6.147). api/auth/verify-email'in AYNI deseni (kimliksiz uç, token tek yetki
// kaynağı, sabit-zamanlı kıyas + 24s TTL — verifyTokenMatches doğrudan yeniden kullanılır, yalnız
// Doctor.studentVerify* alan çiftine REMAP edilir) ama BİLEREK AYRI rota: bu, Doctorium'un TEK
// güvenlik kapısını (Doctor.studentVerifiedAt) damgalıyor — genel hesap-doğrulama rotasının
// gelecekteki bir değişikliği (edge-case, bypass) bu güvenlik-kritik yolu YANLIŞLIKLA etkilemesin.
//
// Başarılıysa User.emailVerifiedAt'i de damgalar (varsa) — öğrenci aynı adrese İKİNCİ bir "hesap
// e-postanı doğrula" e-postası ALMAZ (signup-student route bunu bilerek atlar); giriş kapısı
// (login route emailGateActive) bu tek tıklamayla birlikte açılır.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (status: string) => NextResponse.redirect(new URL(`/kurumsal-giris?verify=${status}`, url.origin));

  // Token tahmin/tarama freni (bağlantı tıklamaları için cömert): 20/5dk/IP — verify-email ile aynı.
  const rl = await rateLimit(`verify-student-email:${clientIp(req)}`, 20, 5 * 60_000);
  if (!rl.ok) return back("invalid");

  const uid = (url.searchParams.get("uid") ?? "").slice(0, 64);
  const token = (url.searchParams.get("token") ?? "").slice(0, 128);
  if (!uid || !token) return back("invalid");

  const user = await db.user.findUnique({ where: { id: uid }, select: { id: true, doctorId: true } });
  if (!user?.doctorId) return back("invalid");

  const doctor = await db.doctor.findUnique({
    where: { id: user.doctorId },
    select: { studentVerifiedAt: true, studentVerifyTokenHash: true, studentVerifySentAt: true },
  });
  if (!doctor) return back("invalid");
  if (doctor.studentVerifiedAt) return back("already");

  const matches = verifyTokenMatches(
    { emailVerifyTokenHash: doctor.studentVerifyTokenHash, emailVerifySentAt: doctor.studentVerifySentAt },
    token,
  );
  if (!matches) return back("invalid");

  await Promise.all([
    db.doctor.update({
      where: { id: user.doctorId },
      data: { studentVerifiedAt: new Date(), studentVerifyTokenHash: null },
    }),
    db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } }),
  ]);

  return back("ok");
}
