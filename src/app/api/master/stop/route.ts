// Bürünmeyi bitir → master kimliğine dön. Aktif oturum bir bürünme oturumu olmalı (imp claim dolu).
// imp'teki master hâlâ geçerli (enabled + allowlist + var) değilse güvenli çıkış yapılır (fail-closed).
import { NextResponse } from "next/server";
import { getCurrentUser, createSession, destroySession } from "@/lib/auth";
import { isMasterEmail, isMasterEnabled } from "@/lib/master";
import { db } from "@/lib/db";
import { recordAccess, reqMeta } from "@/lib/audit";
import { isRole, type Role, type SessionUser } from "@/lib/session";
import { CONSENT_VERSION } from "@/lib/consent-config";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  if (!user.imp) return NextResponse.json({ error: "Bürünme oturumu yok." }, { status: 400 });

  const master = await db.user.findUnique({
    where: { id: user.imp },
    select: { id: true, email: true, name: true, role: true },
  });
  // Master artık geçerli değil (silinmiş / allowlist dışı / env kapalı) → güvenli çıkış.
  if (!master || !isRole(master.role) || !isMasterEnabled() || !isMasterEmail(master.email)) {
    await destroySession();
    return NextResponse.json({ ok: true, redirect: "/giris" });
  }

  const masterUser: SessionUser = {
    id: master.id, email: master.email, name: master.name, role: master.role as Role,
  };
  await createSession({ ...masterUser, cv: CONSENT_VERSION }); // imp yok → master kimliğine dönüş

  const meta = reqMeta(req);
  await recordAccess({
    actor: masterUser, action: "IMPERSONATE_END", resourceType: "user", resourceId: user.id,
    subjectUserId: user.id, detail: `master ${master.email} bürünmeyi bitirdi (${user.email} · ${user.role})`,
    ip: meta.ip, userAgent: meta.userAgent,
  });

  return NextResponse.json({ ok: true, redirect: "/master" });
}
