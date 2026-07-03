import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canCaseBeAccessedBy } from "@/lib/ownership";
import { requestIcapciAppointment } from "@/lib/clinical-duty";

// POST /api/cases/:id/icapci-request — 3-seçenek kapısı, Seçenek 2: Branş Doktoruyla randevu.
// Branştaki İcapçı doktorlara talep düşer; ilk teklif eden hastaya zaman önerir (appointment route).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const c = await db.case.findUnique({ where: { id }, select: { userId: true, doctorId: true, branch: true, status: true } });
  if (!c) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });
  if (!(await canCaseBeAccessedBy(user, c))) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  if (!["NEW", "IN_REVIEW"].includes(c.status)) {
    return NextResponse.json({ error: "Bu vaka için görüşme zaten başlatılmış." }, { status: 409 });
  }

  const ok = await requestIcapciAppointment(id);
  if (!ok) return NextResponse.json({ error: "Talep oluşturulamadı." }, { status: 409 });
  return NextResponse.json({ ok: true, status: "REQUESTED" });
}
