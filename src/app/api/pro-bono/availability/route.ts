import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { setDoctorAvailable, matchForDoctor, quotaInfo } from "@/lib/pro-bono";

// POST /api/pro-bono/availability — hekim pro bono müsaitliğini aç/kapa (+ops. kota); açınca eşleşme dener.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const u = await db.user.findUnique({ where: { id: user.id } });
  const doctorId = u?.doctorId;
  if (!doctorId) return NextResponse.json({ error: "Bu hesap bir hekim profiline bağlı değil." }, { status: 400 });

  const body = await req.json().catch(() => ({}));

  // Opsiyonel kontenjan güncelleme (1-10)
  if (typeof body.quota === "number") {
    const quota = Math.min(10, Math.max(1, Math.round(body.quota)));
    await db.doctor.update({ where: { id: doctorId }, data: { proBonoQuota: quota } });
  }

  const available = body.available === true;
  await setDoctorAvailable(doctorId, available);

  let consultationId: string | null = null;
  if (available) {
    const m = await matchForDoctor(doctorId);
    consultationId = m?.consultationId ?? null;
  }

  const d = await db.doctor.findUnique({ where: { id: doctorId } });
  return NextResponse.json({
    state: d?.proBonoState ?? "OFFLINE",
    quota: d ? quotaInfo(d) : null,
    consultationId,
  });
}
