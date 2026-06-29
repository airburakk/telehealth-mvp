import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { transitionSoCase, logSoEvent, SoError } from "@/lib/second-opinion-service";
import { notifyUser } from "@/lib/notify";
import { encryptField } from "@/lib/crypto";

// POST /api/second-opinion/cases/[id]/opinion — atanmış doktor yazılı ikinci görüşü sunar.
// ASSIGNED → OPINION_DELIVERED (opinionDeliveredAt = video penceresi başlangıcı §11). E-imza PARK.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  if (!["DOCTOR", "ADMIN"].includes(user.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });

  const c = await db.secondOpinionCase.findUnique({ where: { id } });
  if (!c) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });

  // §8: doktor yalnız kendisine atanmış vakaya görüş yazabilir
  if (user.role === "DOCTOR") {
    const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
    if (!me?.doctorId || me.doctorId !== c.assignedDoctorId) {
      return NextResponse.json({ error: "Bu vaka size atanmamış." }, { status: 403 });
    }
  }
  if (!c.assignedDoctorId) return NextResponse.json({ error: "Vakaya atanmış doktor yok." }, { status: 409 });
  if (c.status !== "ASSIGNED") return NextResponse.json({ error: "Görüş yalnız inceleme (atanmış) aşamasında sunulabilir." }, { status: 409 });

  const body = await req.json().catch(() => ({}));
  const content = String(body.content ?? "").trim();
  if (content.length < 20) return NextResponse.json({ error: "Görüş metni çok kısa." }, { status: 400 });
  const structured = body.structured ? JSON.stringify(body.structured).slice(0, 20000) : null;

  // SO yazılı görüş (content + yapılandırılmış JSON) at-rest şifrelenir (E2EE Faz 1).
  const encContent = encryptField(content.slice(0, 20000));
  const encStructured = encryptField(structured);
  await db.secondOpinion.upsert({
    where: { caseId: id },
    create: { caseId: id, doctorId: c.assignedDoctorId, content: encContent, structured: encStructured },
    update: { content: encContent, structured: encStructured, submittedAt: new Date() },
  });

  try {
    await transitionSoCase(id, "OPINION_DELIVERED", { actorId: user.id, actorRole: user.role, data: { opinionDeliveredAt: new Date() } });
  } catch (e) {
    if (e instanceof SoError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  await logSoEvent(id, { actorId: user.id, actorRole: user.role, action: "OPINION_SUBMIT" });
  await notifyUser(c.patientId, {
    type: "SO_OPINION",
    title: "📝 İkinci görüşünüz hazır",
    body: "Uzman doktor yazılı değerlendirmesini sundu.",
    href: `/second-opinion/vaka/${id}`,
  });
  return NextResponse.json({ ok: true, status: "OPINION_DELIVERED" });
}
