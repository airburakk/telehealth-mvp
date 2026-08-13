import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";
import { consentedVersion, recordConsent } from "@/lib/consent";
import { isStaffSignupRole } from "@/lib/roles";
import {
  STAFF_ROLE_CONFIGS,
  STAFF_APPLICATION_CONSENT_SCOPE,
  STAFF_APPLICATION_CONSENT_VERSION,
  STAFF_APPLICATION_CONSENT_TEXT,
} from "@/lib/staff-application-config";
import { createStaffAccount, validateStaffAnswers } from "@/lib/staff-application";
import { isEmailConfigured } from "@/lib/email";
import { issueVerificationEmail } from "@/lib/email-verification";
import { rateLimit, clientIp, tooMany } from "@/lib/rate-limit";
import { reqMeta } from "@/lib/audit";
import { notifyRoles } from "@/lib/notify";
import { ROLE_LABELS } from "@/lib/roles";

// Kurumsal üyelik başvurusu (2026-08-12) — PARTNER / AGENCY / HEALTH_PRO self-signup.
// signup (doktor) rotasının eşleniği: hesap yetkisiz açılır (staffVerifiedAt=null) + PENDING
// StaffApplication (yanıtlar ŞİFRELİ) + başvuru-KVKK onam kaydı (ayrı scope) → e-posta doğrulama
// (dormant'sa oturum) → /onam (GENEL personel onamı) → /kayit/durum. Rol paneli insan onayına
// (/admin/personel-onay) kadar KAPALI. COORDINATOR/ETHICS bu uçtan AÇILAMAZ (yalnız davet).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const rl = await rateLimit(`signup-staff:${clientIp(req)}`, 10, 5 * 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  const b = await req.json().catch(() => ({}));
  const role = String(b.role ?? "");
  if (!isStaffSignupRole(role)) {
    return NextResponse.json({ error: "Geçersiz başvuru rolü." }, { status: 400 });
  }
  const config = STAFF_ROLE_CONFIGS[role];

  const email = String(b.email ?? "").trim().toLowerCase();
  const password = String(b.password ?? "");
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Geçerli bir e-posta girin." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Parola en az 8 karakter olmalı." }, { status: 400 });

  // Başvuru-KVKK onayı (⚖️ TASLAK metin, config'te): kutu işaretlenmeden başvuru İŞLENMEZ.
  if (b.kvkkConsent !== true) {
    return NextResponse.json({ error: "Başvuru için KVKK aydınlatma metnini onaylamanız gerekir." }, { status: 400 });
  }

  const validated = validateStaffAnswers(config, b.answers);
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return NextResponse.json({ error: "Bu e-posta zaten kayıtlı. Giriş yapın." }, { status: 409 });

  const passwordHash = await hashPassword(password);
  const user = await createStaffAccount({ role, email, passwordHash, answers: validated.answers });

  // Başvuru verisi işleme onamı — hesap oluştuktan sonra (userId gerekir), GENEL onamdan AYRI scope.
  // recordConsent fail-closed'dur (yazamazsa throw + alarm): bu uçta 500 döner; hesap açık kalır ve
  // kullanıcı girişte 409→giriş→/onam yoluna düşer — onay kaydı alınmadan başvuru "onaylı" İMZALANMAZ.
  const { ip, userAgent } = reqMeta(req);
  await recordConsent(user.id, ip, userAgent, {
    scope: STAFF_APPLICATION_CONSENT_SCOPE,
    version: STAFF_APPLICATION_CONSENT_VERSION,
    text: STAFF_APPLICATION_CONSENT_TEXT,
  });

  // İnceleme kuyruğuna içeriksiz dürtü — başvuru verisi bildirime YAZILMAZ (yalnız rol etiketi).
  await notifyRoles(["ADMIN", "ETHICS"], {
    type: "STAFF_APPLICATION",
    title: "Yeni kurumsal üyelik başvurusu",
    body: `${ROLE_LABELS[role]} başvurusu incelemeye hazır.`,
    href: "/admin/personel-onay",
  });

  if (isEmailConfigured()) {
    await issueVerificationEmail({ id: user.id, email: user.email, name: user.name }, new URL(req.url).origin);
    return NextResponse.json({ ok: true, needsVerification: true });
  }
  await db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });

  // Yeni hesapta GENEL onam yok (cv=0) → proxy /onam'a düşürür, oradan /kayit/durum'a iner.
  const cv = await consentedVersion(user.id);
  await createSession({ id: user.id, email: user.email, name: user.name, role, cv });

  return NextResponse.json({ ok: true, home: "/kayit/durum" });
}
