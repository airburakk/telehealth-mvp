import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { transitionSoCase, logSoEvent, SoError } from "@/lib/second-opinion-service";
import { notifyUser } from "@/lib/notify";

// POST /api/second-opinion/cases/[id]/offer-video — raporu yazan hoca video randevu TEKLİF eder.
// OPINION_DELIVERED → VIDEO_OFFERED (İcapçı deseni; koordinatör YOK). Hasta kabul/değişiklik route'u: respond-video.
// Faz 3 (basitleştirme, 2026-07-12): doktor 1-3 ALTERNATİF zaman önerebilir (slots[]) — hasta tek
// tıkla birini seçer (el sıkışması tek tur). Tek-zaman teklifi (scheduledAt) geriye uyumlu çalışır.
// Teklif appointment'a status="OFFERED" + scheduledAt=ilk slot + proposedSlots (çoklu ise) yazılır.
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
  // slots[] (1-3) veya tekil scheduledAt (geriye uyumlu)
  const raw: string[] = Array.isArray(body.slots) && body.slots.length
    ? body.slots.map((s: unknown) => String(s))
    : [String(body.scheduledAt ?? "")];
  const slots = [...new Set(raw)]
    .map((s) => new Date(s))
    .filter((d) => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  if (!slots.length || slots.length > 3) {
    return NextResponse.json({ error: "1 ile 3 arasında geçerli tarih/saat girin." }, { status: 400 });
  }
  if (slots.some((d) => d.getTime() < Date.now() - 60_000)) {
    return NextResponse.json({ error: "Geçmiş bir zaman seçilemez." }, { status: 400 });
  }
  const scheduledAt = slots[0];
  const proposedSlots = slots.length > 1 ? slots.map((d) => d.toISOString()) : null;

  // Teklifi appointment'a yaz (var olanı günceller → değişiklik sonrası yeniden teklif). externalVideoRef
  // hasta kabul edince (respond-video) atanır → izole SO video odası ancak onaydan sonra açılır.
  await db.secondOpinionAppointment.upsert({
    where: { caseId: id },
    create: { caseId: id, patientId: c.patientId, doctorId: c.assignedDoctorId, scheduledAt, proposedSlots: proposedSlots ?? undefined, status: "OFFERED" },
    update: { scheduledAt, proposedSlots: proposedSlots ?? Prisma.DbNull, status: "OFFERED" },
  });

  try {
    await transitionSoCase(id, "VIDEO_OFFERED", { actorId: user.id, actorRole: user.role });
  } catch (e) {
    if (e instanceof SoError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const whenStr = scheduledAt.toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" });
  await logSoEvent(id, { actorId: user.id, actorRole: user.role, action: "VIDEO", detail: `offered ${slots.map((d) => d.toISOString()).join(",")}` });
  await notifyUser(c.patientId, {
    type: "SO_VIDEO",
    title: "📅 Video randevu teklifi",
    body: proposedSlots
      ? `Uzman doktorunuz görüşme için ${slots.length} alternatif zaman önerdi — size uygun olanı tek tıkla seçin.`
      : `Uzman doktorunuz görüşme için bir zaman önerdi: ${whenStr}. Onaylayın veya farklı bir zaman isteyin.`,
    href: `/second-opinion/vaka/${id}`,
  });

  return NextResponse.json({ ok: true, status: "VIDEO_OFFERED" });
}
