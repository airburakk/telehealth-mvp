import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isSecondOpinionPatient } from "@/lib/ownership";
import { transitionSoCase, logSoEvent, SoError } from "@/lib/second-opinion-service";
import { notifyUser } from "@/lib/notify";

// POST /api/second-opinion/cases/[id]/respond-video — hasta video randevu teklifine yanıt verir.
// action=accept → VIDEO_OFFERED → VIDEO_SCHEDULED (izole video odası açılır); çok-slot teklifte
// (proposedSlots, Faz 3) hasta scheduledAt ile SEÇTİĞİ slotu gönderir — tek tıkla tek tur. ·
// action=request_change → VIDEO_OFFERED → OPINION_DELIVERED (hoca yeni zaman önerir; İcapçı deseni).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  const c = await db.secondOpinionCase.findUnique({ where: { id } });
  if (!c) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });
  if (!isSecondOpinionPatient(user, c)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 }); // T15b: yalnız hasta randevu yanıtlar
  if (c.status !== "VIDEO_OFFERED") return NextResponse.json({ error: "Yanıtlanacak bir randevu teklifi yok." }, { status: 409 });

  const appt = await db.secondOpinionAppointment.findUnique({ where: { caseId: id } });
  if (!appt) return NextResponse.json({ error: "Randevu teklifi bulunamadı." }, { status: 409 });

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");
  if (action !== "accept" && action !== "request_change") {
    return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
  }

  const docUser = await db.user.findFirst({ where: { doctorId: appt.doctorId }, select: { id: true } });

  // Faz 3: çok-slot teklifte hasta seçtiği zamanı gönderir; önerilenlerden biri olmalı (tamper koruması)
  let chosen = appt.scheduledAt;
  if (action === "accept" && body.scheduledAt != null) {
    const want = new Date(String(body.scheduledAt));
    const slots: string[] = Array.isArray(appt.proposedSlots) ? (appt.proposedSlots as string[]) : [appt.scheduledAt.toISOString()];
    if (isNaN(want.getTime()) || !slots.includes(want.toISOString())) {
      return NextResponse.json({ error: "Seçilen zaman önerilenler arasında değil." }, { status: 400 });
    }
    chosen = want;
  }
  const whenStr = chosen.toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" });

  if (action === "accept") {
    // İzole SO video odası = appointment.id (sinyalleşme string-anahtarlı, FK gerektirmez)
    await db.secondOpinionAppointment.update({ where: { caseId: id }, data: { status: "SCHEDULED", externalVideoRef: appt.id, scheduledAt: chosen, proposedSlots: Prisma.DbNull } });
    try {
      await transitionSoCase(id, "VIDEO_SCHEDULED", { actorId: user.id, actorRole: user.role });
    } catch (e) {
      if (e instanceof SoError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
    await logSoEvent(id, { actorId: user.id, actorRole: user.role, action: "VIDEO", detail: `accepted ${chosen.toISOString()}` });
    if (docUser) {
      await notifyUser(docUser.id, {
        type: "SO_VIDEO",
        title: "✅ Video randevusu onaylandı",
        body: `Hasta önerdiğiniz zamanı onayladı: ${whenStr}.`,
        href: `/doktor/ikinci-gorus/${id}`,
      });
    }
    return NextResponse.json({ ok: true, status: "VIDEO_SCHEDULED", appointmentId: appt.id });
  }

  // request_change → teklifi değişiklik-istendi olarak işaretle + vakayı OPINION_DELIVERED'a döndür
  await db.secondOpinionAppointment.update({ where: { caseId: id }, data: { status: "CHANGE_REQUESTED" } });
  try {
    await transitionSoCase(id, "OPINION_DELIVERED", { actorId: user.id, actorRole: user.role });
  } catch (e) {
    if (e instanceof SoError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  await logSoEvent(id, { actorId: user.id, actorRole: user.role, action: "VIDEO", detail: "change_requested" });
  if (docUser) {
    await notifyUser(docUser.id, {
      type: "SO_VIDEO",
      title: "🔁 Hasta farklı bir zaman istedi",
      body: "Önerdiğiniz randevu zamanı hasta için uygun değil — lütfen yeni bir zaman önerin.",
      href: `/doktor/ikinci-gorus/${id}`,
    });
  }
  return NextResponse.json({ ok: true, status: "OPINION_DELIVERED" });
}
