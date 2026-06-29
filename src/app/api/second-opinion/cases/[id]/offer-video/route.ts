import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { transitionSoCase, logSoEvent, SoError } from "@/lib/second-opinion-service";
import { notifyUser } from "@/lib/notify";

// POST /api/second-opinion/cases/[id]/offer-video — raporu yazan hoca video randevu TEKLİF eder.
// OPINION_DELIVERED → VIDEO_OFFERED (İcapçı deseni; koordinatör YOK). Hasta kabul/değişiklik route'u: respond-video.
// Teklif appointment'a status="OFFERED" + önerilen scheduledAt olarak yazılır (şema değişikliği yok).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  if (!["DOCTOR", "ADMIN"].includes(user.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });

  const c = await db.secondOpinionCase.findUnique({ where: { id } });
  if (!c) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });
  if (!c.assignedDoctorId) return NextResponse.json({ error: "Vakaya atanmış doktor yok." }, { status: 409 });

  // §8: yalnız raporu yazan (atanmış) hoca randevu teklif edebilir
  if (user.role === "DOCTOR") {
    const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
    if (!me?.doctorId || me.doctorId !== c.assignedDoctorId) {
      return NextResponse.json({ error: "Bu vaka size atanmamış." }, { status: 403 });
    }
  }
  if (c.status !== "OPINION_DELIVERED") {
    return NextResponse.json({ error: "Randevu yalnız yazılı görüş sunulduktan sonra teklif edilebilir." }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const scheduledAt = new Date(String(body.scheduledAt ?? ""));
  if (isNaN(scheduledAt.getTime())) return NextResponse.json({ error: "Geçerli bir tarih/saat girin." }, { status: 400 });
  if (scheduledAt.getTime() < Date.now() - 60_000) return NextResponse.json({ error: "Geçmiş bir zaman seçilemez." }, { status: 400 });

  // Teklifi appointment'a yaz (var olanı günceller → değişiklik sonrası yeniden teklif). externalVideoRef
  // hasta kabul edince (respond-video) atanır → izole SO video odası ancak onaydan sonra açılır.
  await db.secondOpinionAppointment.upsert({
    where: { caseId: id },
    create: { caseId: id, patientId: c.patientId, doctorId: c.assignedDoctorId, scheduledAt, status: "OFFERED" },
    update: { scheduledAt, status: "OFFERED" },
  });

  try {
    await transitionSoCase(id, "VIDEO_OFFERED", { actorId: user.id, actorRole: user.role });
  } catch (e) {
    if (e instanceof SoError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const whenStr = scheduledAt.toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" });
  await logSoEvent(id, { actorId: user.id, actorRole: user.role, action: "VIDEO", detail: `offered ${scheduledAt.toISOString()}` });
  await notifyUser(c.patientId, {
    type: "SO_VIDEO",
    title: "📅 Video randevu teklifi",
    body: `Uzman doktorunuz görüşme için bir zaman önerdi: ${whenStr}. Onaylayın veya farklı bir zaman isteyin.`,
    href: `/second-opinion/vaka/${id}`,
  });

  return NextResponse.json({ ok: true, status: "VIDEO_OFFERED" });
}
