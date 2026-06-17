import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { transitionSoCase, logSoEvent, SoError } from "@/lib/second-opinion-service";
import { notifyUser } from "@/lib/notify";

// POST /api/second-opinion/cases/[id]/complete-video — görüşme tamamlandı.
// VIDEO_SCHEDULED → VIDEO_COMPLETED → CLOSED (tek adımda). Doktor (atanmış) veya koordinatör.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  if (!["COORDINATOR", "DOCTOR", "ADMIN"].includes(user.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });

  const c = await db.secondOpinionCase.findUnique({ where: { id } });
  if (!c) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });
  if (user.role === "DOCTOR") {
    const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
    if (!me?.doctorId || me.doctorId !== c.assignedDoctorId) return NextResponse.json({ error: "Bu vaka size atanmamış." }, { status: 403 });
  }
  if (!["VIDEO_SCHEDULED", "VIDEO_COMPLETED"].includes(c.status)) {
    return NextResponse.json({ error: "Bu aşamada görüşme tamamlanamaz." }, { status: 409 });
  }

  try {
    if (c.status === "VIDEO_SCHEDULED") await transitionSoCase(id, "VIDEO_COMPLETED", { actorId: user.id, actorRole: user.role });
    await transitionSoCase(id, "CLOSED", { actorId: user.id, actorRole: user.role, data: { closedAt: new Date() } });
  } catch (e) {
    if (e instanceof SoError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  await db.secondOpinionAppointment.updateMany({ where: { caseId: id }, data: { status: "COMPLETED" } });
  await logSoEvent(id, { actorId: user.id, actorRole: user.role, action: "VIDEO", detail: "completed + closed" });
  await notifyUser(c.patientId, {
    type: "SO_VIDEO",
    title: "✅ İkinci görüş süreci tamamlandı",
    body: "Video görüşmeniz tamamlandı, süreç kapandı.",
    href: `/second-opinion/vaka/${id}`,
  });
  return NextResponse.json({ ok: true, status: "CLOSED" });
}
