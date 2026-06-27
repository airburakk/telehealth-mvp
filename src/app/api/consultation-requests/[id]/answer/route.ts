import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { answerRequest } from "@/lib/consultation-requests";

// POST /api/consultation-requests/[id]/answer — hekim anonim konsültasyon talebine görüş verir.
// Self-auth: yalnız consultOptIn=true hekim (panel görünürlüğüyle tutarlı). Yanıt başına ödeme (simüle).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
  const doctor = dbUser?.doctorId ? await db.doctor.findUnique({ where: { id: dbUser.doctorId }, select: { id: true, consultOptIn: true } }) : null;
  if (!doctor) {
    return NextResponse.json({ error: "Hekim profili bağlı değil." }, { status: 400 });
  }
  if (!doctor.consultOptIn) {
    return NextResponse.json({ error: "Konsültasyon taleplerine katılım kapalı." }, { status: 403 });
  }

  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const text = typeof b.answer === "string" ? b.answer : "";

  const res = await answerRequest(id, doctor.id, text);
  if (res === "EMPTY") return NextResponse.json({ error: "Görüş metni boş olamaz." }, { status: 400 });
  if (res === "NOT_FOUND") return NextResponse.json({ error: "Talep bulunamadı." }, { status: 404 });
  if (res === "TAKEN") return NextResponse.json({ error: "Bu talep başka bir hekim tarafından yanıtlandı." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
