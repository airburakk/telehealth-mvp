import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { notifyUser } from "@/lib/notify";
import { recordAccess, reqMeta } from "@/lib/audit";

// POST /api/admin/doctors/[id]/verify — ADMIN / Etik Kurul doktoru doğrular (self-signup onayı).
// verified:true → doktor public dizinde görünür + eşleştirmelere dahil olur. Doktora bildirim gider.
// Karar DOCTOR_VERIFY olarak denetim zincirine düşer (kim/ne zaman onayladı — özen yükümlülüğü ispatı).
const ETHICS_ROLES = ["ETHICS", "ADMIN"];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !ETHICS_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const { id } = await params;
  const doctor = await db.doctor.findUnique({ where: { id }, select: { id: true, verified: true } });
  if (!doctor) return NextResponse.json({ error: "Doktor bulunamadı." }, { status: 404 });
  if (doctor.verified) return NextResponse.json({ ok: true, alreadyVerified: true });

  await db.doctor.update({ where: { id }, data: { verified: true } });

  const u = await db.user.findFirst({ where: { doctorId: id }, select: { id: true } });
  await recordAccess({
    actor: user, action: "DOCTOR_VERIFY", resourceType: "DOCTOR", resourceId: id,
    subjectUserId: u?.id ?? null, detail: "hekim doğrulama onayı (verified:true)", ...reqMeta(req),
  });

  // Doktora bildirim (kullanıcı hesabı varsa).
  if (u) {
    await notifyUser(u.id, {
      type: "ACCOUNT_VERIFIED",
      title: "✅ Hesabınız doğrulandı",
      body: "Profiliniz onaylandı; artık doktor dizininde görünür ve hasta eşleştirmelerine dahil edilirsiniz.",
      href: "/doktor/profil",
    });
  }
  return NextResponse.json({ ok: true });
}
