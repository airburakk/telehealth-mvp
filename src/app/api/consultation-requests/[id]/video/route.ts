import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { offerVideo, respondVideo, completeVideo, videoForRequest, appointmentParties } from "@/lib/consultation-video";

// Faz 3 — konsültasyon görüntülü görüşme randevusu. [id] = ConsultationRequest.id.
// GET: en güncel randevu + presence. POST: offer (doktor) / accept|decline (partner) / complete.

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  const { id } = await params;
  const video = await videoForRequest(id);
  return NextResponse.json({ video });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const action = typeof b.action === "string" ? b.action : "";

  if (action === "offer") {
    if (user.role !== "DOCTOR") return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
    const u = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
    const doc = u?.doctorId ? await db.doctor.findUnique({ where: { id: u.doctorId }, select: { id: true, consultOptIn: true } }) : null;
    if (!doc || !doc.consultOptIn) return NextResponse.json({ error: "Konsültasyon kapalı." }, { status: 403 });
    // proposedAt: ISO geldiyse onu kullan, yoksa "şimdi" (anlık görüşme).
    const proposedAt = b.proposedAt && !isNaN(Date.parse(b.proposedAt)) ? new Date(b.proposedAt) : new Date();
    const res = await offerVideo(id, doc.id, proposedAt);
    if (res !== "OK") return NextResponse.json({ error: res === "FORBIDDEN" ? "Bu talep size ait değil." : "Talep bulunamadı." }, { status: res === "FORBIDDEN" ? 403 : 404 });
    return NextResponse.json({ ok: true, video: await videoForRequest(id) });
  }

  if (action === "accept" || action === "decline") {
    if (user.role !== "PARTNER") return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
    const u = await db.user.findUnique({ where: { id: user.id }, select: { partnerId: true } });
    if (!u?.partnerId) return NextResponse.json({ error: "Partner profili yok." }, { status: 403 });
    const res = await respondVideo(id, u.partnerId, action);
    if (res !== "OK") {
      const m: Record<string, { s: number; e: string }> = {
        FORBIDDEN: { s: 403, e: "Bu görüşme size ait değil." },
        GONE: { s: 409, e: "Bekleyen bir teklif yok." },
        NOT_FOUND: { s: 404, e: "Bulunamadı." },
      };
      const x = m[res] ?? { s: 400, e: "İşlem başarısız." };
      return NextResponse.json({ error: x.e }, { status: x.s });
    }
    return NextResponse.json({ ok: true, video: await videoForRequest(id) });
  }

  if (action === "complete") {
    // Oda kapanışı — taraflardan biri. appointmentId gövdede; tarafları doğrula.
    const apptId = typeof b.appointmentId === "string" ? b.appointmentId : "";
    const parties = apptId ? await appointmentParties(apptId) : null;
    if (!parties || parties.requestId !== id) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
    let ok = false;
    if (user.role === "DOCTOR") {
      const u = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
      ok = u?.doctorId === parties.doctorId;
    } else if (user.role === "PARTNER") {
      const u = await db.user.findUnique({ where: { id: user.id }, select: { partnerId: true } });
      ok = u?.partnerId === parties.partnerId;
    }
    if (!ok) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
    await completeVideo(apptId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
}
