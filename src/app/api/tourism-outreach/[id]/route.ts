import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { notifyDoctorById } from "@/lib/notify";

// POST /api/tourism-outreach/:id — hasta, bir branş doktorunun sağlık turizmi teklifine yanıt verir.
// action=accept (yalnız video teklifi): doktoru vakaya atar + ConsultAppointment CONFIRMED → hasta
//   randevu saatinde /vaka'dan görüşmeye katılır (mevcut consult akışı). Görüşme sonrası tedavi kararı
//   → acente → teklif zinciri aynen sürer (ilk-temas katmanı; kulvar ödemesiz — escrow 2026-07-23'te kalktı).
// action=decline: teklifi reddeder (diğer doktor teklifleri açık kalır).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  const { id } = await params;
  const o = await db.tourismOutreach.findUnique({ where: { id } });
  if (!o) return NextResponse.json({ error: "Teklif bulunamadı." }, { status: 404 });

  const c = await db.case.findUnique({ where: { id: o.caseId }, select: { userId: true, branch: true } });
  if (!c) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });
  if (c.userId !== user.id) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 }); // yalnız vaka sahibi hasta

  const body = await req.json().catch(() => ({}));
  const action = body.action;

  if (action === "decline") {
    if (o.status === "SENT") await db.tourismOutreach.update({ where: { id }, data: { status: "DECLINED" } });
    return NextResponse.json({ ok: true, status: "DECLINED" });
  }

  if (action !== "accept") return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
  if (!o.proposedAt) return NextResponse.json({ error: "Bu bir video görüşme teklifi değil (yalnız mesaj)." }, { status: 400 });
  if (o.status !== "SENT") return NextResponse.json({ error: "Bu teklif zaten yanıtlandı." }, { status: 409 });

  // Doktoru vakaya ata + ConsultAppointment CONFIRMED (caseId @unique → upsert) + teklifi ACCEPTED yap.
  await db.$transaction([
    db.case.update({ where: { id: o.caseId }, data: { doctorId: o.doctorId } }),
    db.consultAppointment.upsert({
      where: { caseId: o.caseId },
      create: { caseId: o.caseId, patientId: user.id, branch: c.branch, doctorId: o.doctorId, proposedAt: o.proposedAt, status: "CONFIRMED" },
      update: { doctorId: o.doctorId, proposedAt: o.proposedAt, status: "CONFIRMED" },
    }),
    db.tourismOutreach.update({ where: { id }, data: { status: "ACCEPTED" } }),
  ]);

  await notifyDoctorById(o.doctorId, {
    type: "TOURISM_OFFER",
    title: "Video görüşme teklifiniz kabul edildi",
    body: "Hasta sağlık turizmi video görüşme teklifinizi kabul etti. Randevu saatinde görüşme odasında hazır olun.",
    href: `/doktor/vaka/${o.caseId}`,
  });

  return NextResponse.json({ ok: true, status: "CONFIRMED" }, { status: 200 });
}
