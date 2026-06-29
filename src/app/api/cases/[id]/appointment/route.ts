import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canCaseBeAccessedBy } from "@/lib/ownership";
import { offerAppointment, respondAppointment } from "@/lib/clinical-duty";

// POST /api/cases/:id/appointment — İcapçı randevu akışı (Seçenek 2, SO Part B deseni).
//   action=offer           → İcapçı doktor zaman teklif eder (body.scheduledAt)
//   action=accept          → hasta teklifi onaylar → vakaya İcapçı atanır
//   action=request_change  → hasta farklı zaman ister → aynı doktor yeniden teklif eder
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");

  // ── İcapçı doktor: zaman teklif et ──
  if (action === "offer") {
    if (!["DOCTOR", "ADMIN"].includes(user.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
    const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
    if (!me?.doctorId) return NextResponse.json({ error: "Doktor profili yok." }, { status: 403 });

    const [c, doc] = await Promise.all([
      db.case.findUnique({ where: { id }, select: { branch: true } }),
      db.doctor.findUnique({ where: { id: me.doctorId }, select: { branch: true, onCall: true } }),
    ]);
    if (!c || !doc) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });
    if (!doc.onCall || doc.branch !== c.branch) {
      return NextResponse.json({ error: "Bu branşta icap (randevu) görevli değilsiniz." }, { status: 403 });
    }

    const scheduledAt = new Date(String(body.scheduledAt ?? ""));
    if (isNaN(scheduledAt.getTime())) return NextResponse.json({ error: "Geçerli bir tarih/saat girin." }, { status: 400 });
    if (scheduledAt.getTime() < Date.now() - 60_000) return NextResponse.json({ error: "Geçmiş bir zaman seçilemez." }, { status: 400 });

    const res = await offerAppointment(id, me.doctorId, scheduledAt);
    if (res === "NOT_FOUND") return NextResponse.json({ error: "Açık randevu talebi yok." }, { status: 404 });
    if (res === "TAKEN") return NextResponse.json({ error: "Bu talebi başka bir doktor aldı." }, { status: 409 });
    return NextResponse.json({ ok: true, status: "OFFERED" });
  }

  // ── Hasta: teklife yanıt ──
  if (action === "accept" || action === "request_change") {
    const c = await db.case.findUnique({ where: { id }, select: { userId: true, doctorId: true } });
    if (!c) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });
    if (!(await canCaseBeAccessedBy(user, c))) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });

    const r = await respondAppointment(id, action);
    if (!r) return NextResponse.json({ error: "Yanıtlanacak bir randevu teklifi yok." }, { status: 409 });
    return NextResponse.json({ ok: true, status: r });
  }

  return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
}
