import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { notifyUser } from "@/lib/notify";

// POST /api/admin/doctors/[id]/verify — ADMIN / Etik Kurul hekimi doğrular (self-signup onayı).
// verified:true → hekim public dizinde görünür + eşleştirmelere dahil olur. Hekime bildirim gider.
const ETHICS_ROLES = ["ETHICS", "ADMIN"];

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !ETHICS_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const { id } = await params;
  const doctor = await db.doctor.findUnique({ where: { id }, select: { id: true, verified: true } });
  if (!doctor) return NextResponse.json({ error: "Hekim bulunamadı." }, { status: 404 });
  if (doctor.verified) return NextResponse.json({ ok: true, alreadyVerified: true });

  await db.doctor.update({ where: { id }, data: { verified: true } });

  // Hekime bildirim (kullanıcı hesabı varsa).
  const u = await db.user.findFirst({ where: { doctorId: id }, select: { id: true } });
  if (u) {
    await notifyUser(u.id, {
      type: "ACCOUNT_VERIFIED",
      title: "✅ Hesabınız doğrulandı",
      body: "Profiliniz onaylandı; artık hekim dizininde görünür ve hasta eşleştirmelerine dahil edilirsiniz.",
      href: "/doktor/profil",
    });
  }
  return NextResponse.json({ ok: true });
}
