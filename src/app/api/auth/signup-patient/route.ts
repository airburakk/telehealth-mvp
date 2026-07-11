import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";
import { consentedVersion } from "@/lib/consent";
import { roleHome } from "@/lib/session";
import { createPatientAccount } from "@/lib/patient-signup";
import { rateLimit, clientIp, tooMany } from "@/lib/rate-limit";
import { isEmailConfigured } from "@/lib/email";
import { issueVerificationEmail } from "@/lib/email-verification";

// Hasta e-posta kaydı. Hesap oluşturulur (role=PATIENT) → oturum açılır → proxy /onam (KVKK) →
// hasta ana akışı (roleHome). Doktor kaydının (signup) sadeleştirilmiş karşılığı.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const rl = await rateLimit(`signup-patient:${clientIp(req)}`, 10, 5 * 60_000); // kötüye kullanım freni: 10/5dk/IP
  if (!rl.ok) return tooMany(rl.retryAfter);

  const b = await req.json().catch(() => ({}));
  const name = String(b.name ?? "").trim().slice(0, 120);
  const email = String(b.email ?? "").trim().toLowerCase();
  const password = String(b.password ?? "");

  if (name.length < 2) return NextResponse.json({ error: "Ad soyad girin." }, { status: 400 });
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Geçerli bir e-posta girin." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Parola en az 8 karakter olmalı." }, { status: 400 });

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return NextResponse.json({ error: "Bu e-posta zaten kayıtlı. Giriş yapın." }, { status: 409 });

  const passwordHash = await hashPassword(password);
  const user = await createPatientAccount({ name, email, passwordHash });

  // E-posta doğrulama (v5.6): yapılandırılmışsa oturum AÇILMAZ — doğrulama bağlantısı gönderilir.
  // Dormant'ken hesap kayıt anında doğrulanmış damgalanır, bugünkü akış birebir sürer.
  if (isEmailConfigured()) {
    await issueVerificationEmail({ id: user.id, email: user.email, name: user.name }, new URL(req.url).origin);
    return NextResponse.json({ ok: true, needsVerification: true });
  }
  await db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });

  // Yeni hesap: henüz onam yok (cv=0) → proxy /onam'a yönlendirir, sonra hasta ana akışı.
  const cv = await consentedVersion(user.id);
  await createSession({ id: user.id, email: user.email, name: user.name, role: "PATIENT", cv });

  return NextResponse.json({ ok: true, home: roleHome("PATIENT") });
}
