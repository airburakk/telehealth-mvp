// MASTER → bir kullanıcıya bürünme. Yalnız (bürünmemiş) master geçer (requireMaster: env + allowlist).
// Oturum kimliği hedef kullanıcıya döner; gerçek master kimliği imp claim'inde saklanır (banner + geri
// dönüş + audit). Her bürünme başı değiştirilemez audit zincirine yazılır.
import { NextResponse } from "next/server";
import { requireMaster } from "@/lib/master";
import { createSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { recordAccess, reqMeta } from "@/lib/audit";
import { isRole, roleHome, type Role } from "@/lib/session";
import { CONSENT_VERSION } from "@/lib/consent-config";

export async function POST(req: Request) {
  const { user: master, error } = await requireMaster();
  if (error) return error;

  let body: { userId?: unknown };
  try { body = await req.json(); } catch { body = {}; }
  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!userId) return NextResponse.json({ error: "userId gerekli." }, { status: 400 });
  if (userId === master.id) return NextResponse.json({ error: "Kendinize bürünemezsiniz." }, { status: 400 });

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true },
  });
  if (!target || !isRole(target.role)) {
    return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
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
    subjectUserId: target.id, detail: `master ${master.email} → ${target.email} (${target.role})`,
    ip: meta.ip, userAgent: meta.userAgent,
  });

  return NextResponse.json({ ok: true, redirect: roleHome(target.role as Role) });
}
