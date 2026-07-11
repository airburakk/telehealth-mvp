import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";
import { consentedVersion } from "@/lib/consent";
import { createDoctorAccount } from "@/lib/doctor-signup";
import { BRANCH_LABELS } from "@/lib/procedures";
import { LANGUAGES } from "@/lib/constants";
import { isEmailConfigured } from "@/lib/email";
import { issueVerificationEmail } from "@/lib/email-verification";

// M5 — Doktor e-posta kaydı. Hesap oluşturulur (verified:false, inaktif) → oturum açılır →
// proxy /onam (KVKK) → /doktor → onboarding kapısı (FHIR uzmanlık + işlem + diploma + MMSS).
const TITLES = new Set(["Prof. Dr.", "Doç. Dr.", "Op. Dr.", "Uzm. Dr."]);
const BRANCH_SET = new Set(Object.values(BRANCH_LABELS));
const LANG_SET = new Set(LANGUAGES);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const name = String(b.name ?? "").trim().slice(0, 120);
  const email = String(b.email ?? "").trim().toLowerCase();
  const password = String(b.password ?? "");
  const title = String(b.title ?? "").trim();
  const branch = String(b.branch ?? "").trim();
  const city = String(b.city ?? "").trim().slice(0, 80);
  // Cep telefonu (FAZ 5, 2026-07-10) — opsiyonel; WhatsApp/SMS bildirim kanalı hedefi.
  // Gevşek normalizasyon: rakam/+/boşluk dışını at, 7-20 karakter değilse yok say.
  const phoneRaw = String(b.phone ?? "").replace(/[^\d+ ]/g, "").trim().slice(0, 20);
  const phone = phoneRaw.replace(/\s+/g, " ").length >= 7 ? phoneRaw : null;
  const languages = Array.isArray(b.languages)
    ? [...new Set((b.languages as unknown[]).filter((l): l is string => typeof l === "string" && LANG_SET.has(l)))]
    : [];

  // Doğrulama
  if (name.length < 2) return NextResponse.json({ error: "Ad soyad girin." }, { status: 400 });
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Geçerli bir e-posta girin." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Parola en az 8 karakter olmalı." }, { status: 400 });
  if (!TITLES.has(title)) return NextResponse.json({ error: "Geçerli bir ünvan seçin." }, { status: 400 });
  if (!BRANCH_SET.has(branch)) return NextResponse.json({ error: "Geçerli bir branş seçin." }, { status: 400 });
  if (city.length < 2) return NextResponse.json({ error: "Şehir girin." }, { status: 400 });
  if (languages.length === 0) return NextResponse.json({ error: "En az bir hizmet dili seçin." }, { status: 400 });

  // E-posta benzersiz mi?
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return NextResponse.json({ error: "Bu e-posta zaten kayıtlı. Giriş yapın." }, { status: 409 });

  const passwordHash = await hashPassword(password);
  const user = await createDoctorAccount({ name, email, passwordHash, title, branch, city, languages: languages.join(","), phone });

  // E-posta doğrulama (v5.6): yapılandırılmışsa oturum AÇILMAZ — doğrulama bağlantısı gönderilir,
  // giriş doğrulama sonrasına kalır. Dormant'ken (RESEND_API_KEY yok) hesap kayıt anında doğrulanmış
  // damgalanır ve bugünkü akış (otomatik giriş → /onam → onboarding) birebir sürer.
  if (isEmailConfigured()) {
    await issueVerificationEmail({ id: user.id, email: user.email, name: user.name }, new URL(req.url).origin);
    return NextResponse.json({ ok: true, needsVerification: true });
  }
  await db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });

  // Yeni hesap: henüz onam yok (cv=0) → proxy /onam'a yönlendirir, sonra /doktor → onboarding kapısı.
  const cv = await consentedVersion(user.id);
  await createSession({ id: user.id, email: user.email, name: user.name, role: "DOCTOR", cv });

  return NextResponse.json({ ok: true, home: "/doktor" });
}
