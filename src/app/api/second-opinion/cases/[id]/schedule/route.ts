import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { transitionSoCase, logSoEvent, SoError } from "@/lib/second-opinion-service";
import { notifyUser } from "@/lib/notify";

// POST /api/second-opinion/cases/[id]/schedule — koordinatör video randevusu kurar.
// OPINION_DELIVERED → VIDEO_SCHEDULED. Randevu, izole SO video odasına (appointment.id) bağlanır.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  if (!["COORDINATOR", "ADMIN"].includes(user.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });

  const c = await db.secondOpinionCase.findUnique({ where: { id } });
  if (!c) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });
  if (!c.assignedDoctorId) return NextResponse.json({ error: "Vakaya atanmış doktor yok." }, { status: 409 });
  if (c.status !== "OPINION_DELIVERED") return NextResponse.json({ error: "Randevu yalnız yazılı görüş sunulduktan sonra kurulabilir." }, { status: 409 });

  const body = await req.json().catch(() => ({}));
  const scheduledAt = new Date(String(body.scheduledAt ?? ""));
  if (isNaN(scheduledAt.getTime())) return NextResponse.json({ error: "Geçerli bir tarih/saat girin." }, { status: 400 });
  if (scheduledAt.getTime() < Date.now() - 60_000) return NextResponse.json({ error: "Geçmiş bir zaman seçilemez." }, { status: 400 });

  const appt = await db.secondOpinionAppointment.upsert({
    where: { caseId: id },
    create: { caseId: id, patientId: c.patientId, doctorId: c.assignedDoctorId, scheduledAt, status: "SCHEDULED" },
    update: { scheduledAt, status: "SCHEDULED" },
  });
  // İzole SO video odası = appointment.id (sinyalleşme string-anahtarlı, FK gerektirmez)
  await db.secondOpinionAppointment.update({ where: { id: appt.id }, data: { externalVideoRef: appt.id } });

  try {
    await transitionSoCase(id, "VIDEO_SCHEDULED", { actorId: user.id, actorRole: user.role });
  } catch (e) {
    if (e instanceof SoError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  await logSoEvent(id, { actorId: user.id, actorRole: user.role, action: "VIDEO", detail: `scheduled ${scheduledAt.toISOString()}` });

  const whenStr = scheduledAt.toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" });
  await notifyUser(c.patientId, { type: "SO_VIDEO", title: "📅 Video görüşme randevunuz", body: whenStr, href: `/second-opinion/vaka/${id}` });
  const docUser = await db.user.findFirst({ where: { doctorId: c.assignedDoctorId } });
  if (docUser) await notifyUser(docUser.id, { type: "SO_VIDEO", title: "📅 İkinci görüş video randevusu", body: whenStr, href: `/doktor/ikinci-gorus/${id}` });

  return NextResponse.json({ ok: true, status: "VIDEO_SCHEDULED", appointmentId: appt.id });
}
