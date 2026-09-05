import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";
import { brandRoleHome } from "@/lib/roles";
import { gateConsentVersion } from "@/lib/doctorium-consent";
import { createDoctorAccount } from "@/lib/doctor-signup";
import { BRANCH_LABELS } from "@/lib/procedures";
import { isAllowedCity } from "@/lib/cities";
import { rateLimit, clientIp, tooMany } from "@/lib/rate-limit";
import { isTrialEnabled } from "@/lib/doctorium-trial-flag";
import { TRIAL_TITLE } from "@/lib/doctorium-tiers";
import {
  canUseLoginLink, issueExistingAccountEmail, issueLoginLinkEmail,
  loginLinkChannelReady, loginLinkCooldownActive,
} from "@/lib/login-link";

export const dynamic = "force-dynamic";

// POST /api/auth/signup-trial — DENEME doktor kaydı / parolasız giriş isteği (üç katman Faz A3,
// kullanıcı kararı 2026-09-05). Oturum GEREKMEZ. Gövde: name · email · branch · city (parola YOK).
//
// Akış: yeni adres → hesap açılır (TRIAL_TITLE, gölge parola hash'i, passwordSet=false; deneme damgası
// createAccountTx içinde bayrağa bağlı) + giriş bağlantısı e-postası. Mevcut adres → parolasız DOCTOR
// ise giriş bağlantısı; parolalı/hasta/personel ise token'sız bilgilendirme e-postası (giriş + parola
// sıfırlama). Silinmiş kabuk hiçbir şey almaz.
//
// 🔒 HESAP KEŞFİ KAPALI: kanal açıkken her dal AYNI gövdeyi döndürür ({ok:true, sent:true}); hangi
// dalın koştuğu yanıttan okunamaz (forgot-password deseni). Girdi doğrulama hataları (400) hesaba
// değil biçime dairdir.
//
// ⚠️ Kanal dormant (RESEND_API_KEY yok): bağlantı teslim EDİLEMEZ → üretimde dürüst 503
// {channelDormant:true} (form klasik parolalı kayda yönlendirir). Dev'de signup rotasının dormant
// dalı emsali: hesap açılır, e-posta doğrulanmış damgalanır, oturum hemen kurulur (canlı prova).
const BRANCH_SET = new Set(Object.values(BRANCH_LABELS));
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ExistingUser = {
  id: string; email: string; name: string; role: string;
  passwordSetAt: Date | null; deletedAt: Date | null; loginTokenSentAt: Date | null;
};

const SENT = { ok: true, sent: true } as const;

export async function POST(req: Request) {
  if (!isTrialEnabled()) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });

  // Dışa dönük (e-posta) + hesap-keşfi yüzeyi: forgot-password ile aynı fren (5/15dk/IP).
  const rl = await rateLimit(`signup-trial:${clientIp(req)}`, 5, 15 * 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  const b = await req.json().catch(() => ({}));
  const name = String(b.name ?? "").trim().slice(0, 120);
  const email = String(b.email ?? "").trim().toLowerCase().slice(0, 160);
  const branch = String(b.branch ?? "").trim();
  const city = String(b.city ?? "").trim().slice(0, 80);

  if (name.length < 2) return NextResponse.json({ error: "Ad soyad girin." }, { status: 400 });
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Geçerli bir e-posta girin." }, { status: 400 });
  if (!BRANCH_SET.has(branch)) return NextResponse.json({ error: "Geçerli bir branş seçin." }, { status: 400 });
  if (!isAllowedCity(city)) return NextResponse.json({ error: "Şehri listeden seçin." }, { status: 400 });

  const origin = new URL(req.url).origin;
  const existing: ExistingUser | null = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, role: true, passwordSetAt: true, deletedAt: true, loginTokenSentAt: true },
  });

  if (!loginLinkChannelReady()) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ ok: false, channelDormant: true }, { status: 503 });
    }
    // DEV kısayolu — e-posta yokken akış canlı provalanabilsin (api/auth/signup dormant dalı emsali).
    const user = existing ?? (await createTrialAccount({ name, email, branch, city }));
    if (!user || !canUseLoginLink(user)) return NextResponse.json(SENT);
    await db.user.updateMany({ where: { id: user.id, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } });
    const cv = await gateConsentVersion(user.id, "DOCTOR");
    await createSession({ id: user.id, email: user.email, name: user.name, role: "DOCTOR", cv });
    return NextResponse.json({ ok: true, home: brandRoleHome("DOCTOR") });
  }

  if (existing) {
    if (!existing.deletedAt && !loginLinkCooldownActive(existing.loginTokenSentAt)) {
      if (canUseLoginLink(existing)) await issueLoginLinkEmail(existing, origin);
      else await issueExistingAccountEmail(existing, origin);
    }
    return NextResponse.json(SENT);
  }

  const user = await createTrialAccount({ name, email, branch, city });
  if (user) await issueLoginLinkEmail({ id: user.id, email: user.email, name: user.name }, origin);
  // Aynı e-postayla eşzamanlı ikinci istek (P2002) → "mevcut hesap" yoluyla aynı yanıt.
  return NextResponse.json(SENT);
}

async function createTrialAccount(input: { name: string; email: string; branch: string; city: string }): Promise<ExistingUser | null> {
  // Parola girişi devre dışı: rastgele gölge hash (OAuth yoluyla aynı); passwordSet:false →
  // "Hesabım → Şifre" paneli "parola belirle" formunu çizer, giriş bağlantısı bu hesaba açılır.
  const passwordHash = await hashPassword(randomBytes(24).toString("hex"));
  try {
    const u = await createDoctorAccount({
      name: input.name, email: input.email, passwordHash,
      title: TRIAL_TITLE, branch: input.branch, city: input.city, languages: "Türkçe",
      passwordSet: false,
    });
    return { id: u.id, email: u.email, name: u.name, role: u.role, passwordSetAt: null, deletedAt: null, loginTokenSentAt: null };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return null;
    throw e;
  }
}
