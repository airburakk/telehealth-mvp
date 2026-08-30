import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";
import { consentedVersion } from "@/lib/consent";
import { createDoctorAccount, studentTitleFor } from "@/lib/doctor-signup";
import { BRANCH_LABELS } from "@/lib/procedures";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { hashVerifyToken } from "@/lib/email-verification";
import { universitiesFor, domainMatches, type StudentDepartment } from "@/lib/universities";
import { rateLimit, clientIp, tooMany } from "@/lib/rate-limit";

// v6.95 — Tıp/Diş Hekimliği öğrencisi kaydı (/ogrenci hunisi). signup(doktor) rotasının
// SADELEŞMİŞ eşleniği: ünvan/telefon/hizmet dili SORULMAZ (öğrenci hizmet vermez — title bölüme
// göre türetilir, dil varsayılan). Branş = İLGİ branşı (Doctorium haber akışını kişiselleştirir).
// Hesap DOCTOR rolü + studentTrack:true doğar → onboarding öğrenci modunda, HealthTürkiye dizin
// doğrulaması atlanır.
//
// v6.147 (kullanıcı kararı 2026-08-23) — Doctorium erişiminin TEK güvenlik kontrolü artık BURADA:
// üniversite + bölüm seçilir, girilen e-postanın uzantısı lib/universities.ts UNIVERSITIES'teki
// bilinen domain'le eşleşmezse kayıt REDDEDİLİR (eski STUDENT_CERT belge yolu — barkod sonucu
// hiç okunmuyordu, gerçek kapı değildi — tamamen kaldırıldı). Eşleşirse hesap açılır ve doğrulama
// bağlantısı gönderilir; Doctor.studentVerifiedAt YALNIZ o bağlantı tıklanınca damgalanır
// (api/auth/verify-student-email) — ⚠️ Genel hesap e-postası (User.emailVerifiedAt) gibi dormant'ta
// OTOMATİK BYPASS EDİLMEZ; edilseydi bu güvenlik düzeltmesinin bütün amacı boşa çıkardı.
const BRANCH_SET = new Set(Object.values(BRANCH_LABELS));
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEPARTMENTS = new Set<StudentDepartment>(["tip", "dis-hekimligi"]);

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
  const department = String(b.department ?? "") as StudentDepartment;
  const university = String(b.university ?? "").trim();

  if (name.length < 2) return NextResponse.json({ error: "Ad soyad girin." }, { status: 400 });
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Geçerli bir e-posta girin." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Parola en az 8 karakter olmalı." }, { status: 400 });
  if (!BRANCH_SET.has(branch)) return NextResponse.json({ error: "İlgilendiğiniz branşı seçin." }, { status: 400 });
  if (city.length < 2) return NextResponse.json({ error: "Üniversitenizin şehrini girin." }, { status: 400 });
  if (!DEPARTMENTS.has(department)) return NextResponse.json({ error: "Bölümünüzü seçin (Tıp / Diş Hekimliği)." }, { status: 400 });
  if (!universitiesFor(department).some((u) => u.name === university)) {
    return NextResponse.json({ error: "Üniversitenizi listeden seçin." }, { status: 400 });
  }
  if (!domainMatches(email, university)) {
    return NextResponse.json({
      error: `Girdiğiniz e-posta "${university}" için beklenen öğrenci uzantısıyla eşleşmiyor. Üniversitenizin size verdiği kurumsal (...edu.tr) e-postayla kaydolun.`,
    }, { status: 400 });
  }

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return NextResponse.json({ error: "Bu e-posta zaten kayıtlı. Giriş yapın." }, { status: 409 });

  const passwordHash = await hashPassword(password);
  const user = await createDoctorAccount({
    name, email, passwordHash,
    title: studentTitleFor(department), branch, city,
    languages: "Türkçe", phone: null,
    studentTrack: true, studentUniversity: university, studentDepartment: department,
    passwordSet: true,
  });

  // Genel hesap e-postası: dormant'ta diğer TÜM kayıt yollarıyla AYNI davranış (auto-stamp,
  // giriş kilitlenmesin — login route'u emailGateActive'de prod'da bile bunu bekler). Yapılandırılmışsa
  // BİLEREK göndermiyoruz: aşağıdaki öğrenci-özel bağlantı zaten aynı adresi kanıtlar, tıklanınca
  // ikisini birden damgalar (bkz. verify-student-email) — aynı adrese iki ayrı doğrulama e-postası
  // gitmesin.
  if (!isEmailConfigured()) {
    await db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
  }

  // Öğrenci-özel doğrulama — HER ZAMAN gönderilir/üretilir, dormant'ta da BYPASS EDİLMEZ
  // (email-verification.ts deseni, ayrı token alanı: studentVerifyTokenHash/studentVerifySentAt).
  const token = randomBytes(32).toString("hex");
  await db.doctor.update({
    where: { id: user.doctorId! }, // createDoctorAccount her zaman doctorId'li User döner
    data: { studentVerifyTokenHash: hashVerifyToken(token), studentVerifySentAt: new Date() },
  });
  const link = `${new URL(req.url).origin}/api/auth/verify-student-email?uid=${encodeURIComponent(user.id)}&token=${token}`;
  await sendEmail({
    to: email,
    subject: "Üniversite e-postanızı doğrulayın — Doctorium",
    text: `Merhaba ${name},\n\nDoctorium öğrenci üyeliğinizi etkinleştirmek için üniversite e-postanızı doğrulayın:\n${link}\n\nBağlantı 24 saat geçerlidir.`,
    html: `<p>Merhaba ${escapeHtml(name)},</p><p>Doctorium öğrenci üyeliğinizi etkinleştirmek için üniversite e-postanızı doğrulayın:</p><p><a href="${link}">E-postamı doğrula</a></p><p style="font-size:12px;color:#64748b">Bağlantı 24 saat geçerlidir.</p>`,
  });

  const cv = await consentedVersion(user.id);
  await createSession({ id: user.id, email: user.email, name: user.name, role: "DOCTOR", cv });

  return NextResponse.json({ ok: true, home: "/doktor/baslangic", needsStudentVerification: true });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
