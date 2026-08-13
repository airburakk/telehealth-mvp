import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isStaffSignupRole } from "@/lib/roles";
import { STAFF_ROLE_CONFIGS } from "@/lib/staff-application-config";
import { validateStaffAnswers, resubmitStaffApplication } from "@/lib/staff-application";
import { rateLimit, clientIp, tooMany } from "@/lib/rate-limit";
import { notifyRoles } from "@/lib/notify";

// REJECTED başvuruyu düzeltip yeniden gönderme (2026-08-12) — /kayit/durum düzeltme formu.
// Self-auth: yalnız kendi başvurusu; yalnız REJECTED durumda çalışır (PENDING'te form kilitli).
export async function POST(req: Request) {
  const rl = await rateLimit(`staff-resubmit:${clientIp(req)}`, 10, 5 * 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  const user = await getCurrentUser();
  if (!user || !isStaffSignupRole(user.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const app = await db.staffApplication.findUnique({
    where: { userId: user.id },
    select: { status: true, role: true },
  });
  if (!app) return NextResponse.json({ error: "Başvuru bulunamadı." }, { status: 404 });
  if (app.status !== "REJECTED") {
    return NextResponse.json({ error: "Yalnız düzeltme istenen başvurular yeniden gönderilebilir." }, { status: 400 });
  }

  const config = STAFF_ROLE_CONFIGS[app.role as keyof typeof STAFF_ROLE_CONFIGS];
  const b = await req.json().catch(() => ({}));
  const validated = validateStaffAnswers(config, b.answers);
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });

  await resubmitStaffApplication(user.id, validated.answers);

  // İnceleme kuyruğuna içeriksiz dürtü (yanıt verisi bildirime YAZILMAZ).
  await notifyRoles(["ADMIN", "ETHICS"], {
    type: "STAFF_APPLICATION",
    title: "Kurumsal başvuru güncellendi",
    body: "Düzeltme istenen bir başvuru yeniden gönderildi.",
    href: "/admin/personel-onay",
  });

  return NextResponse.json({ ok: true });
}
