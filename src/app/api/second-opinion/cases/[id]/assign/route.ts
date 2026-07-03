import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { transitionSoCase, logSoEvent, SoError } from "@/lib/second-opinion-service";
import { notifyRoles, notifyUser } from "@/lib/notify";

// POST /api/second-opinion/cases/[id]/assign — koordinatör doktora atar.
// PENDING_REVIEW (belgeler yeterli) → READY_FOR_ASSIGNMENT (readyAt = rapor SLA başlangıcı §11) → ASSIGNED.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  if (!["COORDINATOR", "ADMIN"].includes(user.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const doctorId = String(body.doctorId ?? "");
  if (!doctorId) return NextResponse.json({ error: "Bir doktor seçin." }, { status: 400 });

  const doctor = await db.doctor.findUnique({ where: { id: doctorId } });
  if (!doctor) return NextResponse.json({ error: "Doktor bulunamadı." }, { status: 404 });
  // v4.19 verified simetrisi: diğer tüm eşleşme yolları (autoAssign/accept/ücretsiz-hizmet) doğrulanmış şart koşar;
  // doğrulanmamışa manuel atama, doktorun belgelere erişemeyeceği (canSoCaseBeAccessedBy 403) kilitli vaka üretirdi.
  if (!doctor.verified) return NextResponse.json({ error: "Yalnız doğrulanmış (admin onaylı) doktora atama yapılabilir." }, { status: 403 });

  const c = await db.secondOpinionCase.findUnique({ where: { id } });
  if (!c) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });

  try {
    if (c.status === "PENDING_REVIEW") {
      await transitionSoCase(id, "READY_FOR_ASSIGNMENT", { actorId: user.id, actorRole: user.role, data: { readyAt: new Date() } });
    }
    const cur = await db.secondOpinionCase.findUnique({ where: { id }, select: { status: true } });
    if (cur?.status !== "READY_FOR_ASSIGNMENT") {
      return NextResponse.json({ error: "Atama bu aşamada yapılamaz." }, { status: 409 });
    }
    await transitionSoCase(id, "ASSIGNED", { actorId: user.id, actorRole: user.role, data: { assignedDoctorId: doctorId, assignedAt: new Date() } });
  } catch (e) {
    if (e instanceof SoError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  await logSoEvent(id, { actorId: user.id, actorRole: user.role, action: "ASSIGN", detail: doctor.name });

  const docUser = await db.user.findFirst({ where: { doctorId } });
  const n = { type: "SO_ASSIGNED" as const, title: "🩺 Yeni İkinci Görüş ataması", body: `${doctor.branch} · dosya inceleme bekliyor`, href: `/doktor/ikinci-gorus/${id}` };
  if (docUser) await notifyUser(docUser.id, n);
  else await notifyRoles(["DOCTOR"], n);

  return NextResponse.json({ ok: true, status: "ASSIGNED", doctor: doctor.name });
}
