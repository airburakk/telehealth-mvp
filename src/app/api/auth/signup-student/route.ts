import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";
import { consentedVersion } from "@/lib/consent";
import { createDoctorAccount, STUDENT_TITLE } from "@/lib/doctor-signup";
import { BRANCH_LABELS } from "@/lib/procedures";
import { isEmailConfigured } from "@/lib/email";
import { issueVerificationEmail } from "@/lib/email-verification";
import { rateLimit, clientIp, tooMany } from "@/lib/rate-limit";

// v6.95 — Tıp öğrencisi kaydı (/ogrenci hunisi). signup(doktor) rotasının SADELEŞMİŞ eşleniği:
// ünvan/telefon/hizmet dili SORULMAZ (öğrenci hizmet vermez — title sabit STUDENT_TITLE, dil
// varsayılan). Branş = İLGİ branşı (Doctorium haber akışını kişiselleştirir), şehir = profil
// kapısını (branch/city boş → profil-tamamla) geçmek için zorunlu. Hesap DOCTOR rolü +
// studentTrack:true doğar → onboarding öğrenci modunda (klinik belge blokları hiç görünmez),
// HealthTürkiye dizin doğrulaması atlanır. Doctorium erişimi belge (STUDENT_CERT) yüklenince.
const BRANCH_SET = new Set(Object.values(BRANCH_LABELS));
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  // Kötüye kullanım freni: 10/5dk/IP (signup/signup-patient ile aynı desen), doğrulamadan ÖNCE.
  const rl = await rateLimit(`signup-student:${clientIp(req)}`, 10, 5 * 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  const b = await req.json().catch(() => ({}));
  const name = String(b.name ?? "").trim().slice(0, 120);
  const email = String(b.email ?? "").trim().toLowerCase();
  const password = String(b.password ?? "");
  const branch = String(b.branch ?? "").trim();
  const city = String(b.city ?? "").trim().slice(0, 80);

  if (name.length < 2) return NextResponse.json({ error: "Ad soyad girin." }, { status: 400 });
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Geçerli bir e-posta girin." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Parola en az 8 karakter olmalı." }, { status: 400 });
  if (!BRANCH_SET.has(branch)) return NextResponse.json({ error: "İlgilendiğiniz branşı seçin." }, { status: 400 });
  if (city.length < 2) return NextResponse.json({ error: "Üniversitenizin şehrini girin." }, { status: 400 });

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return NextResponse.json({ error: "Bu e-posta zaten kayıtlı. Giriş yapın." }, { status: 409 });

  const passwordHash = await hashPassword(password);
  const user = await createDoctorAccount({
    name, email, passwordHash,
    title: STUDENT_TITLE, branch, city,
    languages: "Türkçe", phone: null,
    studentTrack: true,
  });

  // E-posta doğrulama davranışı doktor kaydıyla AYNI: yapılandırılmışsa oturum açılmaz (bağlantı
  // gönderilir); dormant'ken hesap doğrulanmış damgalanır ve akış sürer (/onam → öğrenci onboarding).
  if (isEmailConfigured()) {
    await issueVerificationEmail({ id: user.id, email: user.email, name: user.name }, new URL(req.url).origin);
    return NextResponse.json({ ok: true, needsVerification: true });
  }
  await db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });

  const cv = await consentedVersion(user.id);
  await createSession({ id: user.id, email: user.email, name: user.name, role: "DOCTOR", cv });

  return NextResponse.json({ ok: true, home: "/doktor/baslangic" });
}
