// MASTER → bir kullanıcıya bürünme. Yalnız (bürünmemiş) master geçer (requireMaster: env + allowlist).
// Oturum kimliği hedef kullanıcıya döner; gerçek master kimliği imp claim'inde saklanır (banner + geri
// dönüş + audit). Her bürünme başı değiştirilemez audit zincirine yazılır.
//
// Hedef üç biçimde verilebilir:
//  • { userId }    → doğrudan bir User (giriş hesabı olan herkes).
//  • { doctorId }  → bir Doctor profili. Bağlı User varsa ona bürünür; YOKSA "gölge hesap" (giriş
//                    yapılamayan bir User, role=DOCTOR + doctorId) lazy oluşturulur → dummy/seed
//                    doktorlar da bürünülebilir olur ([[master-account-impersonation]]).
//  • { partnerId } → bir PartnerDoctor profili. Aynı mantık, role=PARTNER + partnerId.
// Gölge hesap idempotenttir (doctorId/partnerId ile önce aranır) ve GİRİŞ YAPILAMAZ (sentinel
// passwordHash + .local e-posta) → yalnız master bürünebilir, kimse parolayla/Google ile giremez.
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireMaster } from "@/lib/master-guard";
import { createSession, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { recordAccess, reqMeta } from "@/lib/audit";
import { isRole, roleHome, type Role } from "@/lib/session";
import { CONSENT_VERSION } from "@/lib/consent-config";

type Target = { id: string; email: string; name: string; role: string };

// Gölge (impersonation-only) hesap parolası: rastgele → hiçbir parola eşleşmez (proje deseni: Google
// callback de böyle yapar). E-posta @doctor.local → gerçek kayıt/OAuth ile çakışmaz. Giriş imkânsız;
// yalnız master bürünebilir.
function noLoginHash() {
  return hashPassword(randomBytes(24).toString("hex"));
}

export async function POST(req: Request) {
  const { user: master, error } = await requireMaster();
  if (error) return error;

  let body: { userId?: unknown; doctorId?: unknown; partnerId?: unknown };
  try { body = await req.json(); } catch { body = {}; }
  const userId = typeof body.userId === "string" ? body.userId : "";
  const doctorId = typeof body.doctorId === "string" ? body.doctorId : "";
  const partnerId = typeof body.partnerId === "string" ? body.partnerId : "";

  let target: Target | null = null;
  let shadowCreated = false;

  if (userId) {
    target = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true },
    });
  } else if (doctorId) {
    const doc = await db.doctor.findUnique({ where: { id: doctorId }, select: { id: true, name: true } });
    if (!doc) return NextResponse.json({ error: "Doktor bulunamadı." }, { status: 404 });
    // Bu profile bağlı gerçek giriş hesabı var mı? (self-signup doktor → onun oturumu kullanılır)
    target = await db.user.findFirst({
      where: { doctorId: doc.id },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!target) {
      // Gölge hesap: giriş yapılamayan bir DOCTOR User'ı bu profile bağlanır (idempotent — bir dahaki
      // sefere findFirst yakalar). Böylece dummy/seed doktorun tüm doktor ekranları çalışır.
      target = await db.user.create({
        data: {
          email: `dr.${doc.id}@doctor.local`,
          name: doc.name,
          role: "DOCTOR",
          doctorId: doc.id,
          passwordHash: await noLoginHash(),
          emailVerifiedAt: new Date(),
        },
        select: { id: true, email: true, name: true, role: true },
      });
      shadowCreated = true;
    }
  } else if (partnerId) {
    const p = await db.partnerDoctor.findUnique({ where: { id: partnerId }, select: { id: true, name: true } });
    if (!p) return NextResponse.json({ error: "Partner Doktor bulunamadı." }, { status: 404 });
    target = await db.user.findFirst({
      where: { partnerId: p.id },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!target) {
      target = await db.user.create({
        data: {
          email: `partner.${p.id}@doctor.local`,
          name: p.name,
          role: "PARTNER",
          partnerId: p.id,
          passwordHash: await noLoginHash(),
          emailVerifiedAt: new Date(),
        },
        select: { id: true, email: true, name: true, role: true },
      });
      shadowCreated = true;
    }
  } else {
    return NextResponse.json({ error: "userId / doctorId / partnerId gerekli." }, { status: 400 });
  }

  if (!target || !isRole(target.role)) {
    return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
  }
  if (target.id === master.id) {
    return NextResponse.json({ error: "Kendinize bürünemezsiniz." }, { status: 400 });
  }

  // Bürünme oturumu: kimlik = hedef; imp = master.id. cv = güncel onam sürümü (master aksiyonu →
  // hedefin onam kapısını atlar). createSession sv'yi hedeften taze çeker (iptal edilmiş hedef bürünemez).
  await createSession({
    id: target.id, email: target.email, name: target.name, role: target.role as Role,
    cv: CONSENT_VERSION, imp: master.id,
  });

  const meta = reqMeta(req);
  await recordAccess({
    actor: master, action: "IMPERSONATE_START", resourceType: "user", resourceId: target.id,
    subjectUserId: target.id,
    detail: `master ${master.email} → ${target.email} (${target.role})${shadowCreated ? " · gölge hesap oluşturuldu" : ""}`,
    ip: meta.ip, userAgent: meta.userAgent,
  });

  return NextResponse.json({ ok: true, redirect: roleHome(target.role as Role) });
}
