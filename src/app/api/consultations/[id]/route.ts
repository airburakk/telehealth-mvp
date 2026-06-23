import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// PATCH /api/consultations/:id — not kaydet / görüşmeyi bitir
// Erişim: klinik personel (DOCTOR/COORDINATOR/ADMIN) — hasta klinik notu yazamaz / görüşmeyi kapatamaz.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  if (!["DOCTOR", "COORDINATOR", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const data: { notes?: string; status?: string; endedAt?: Date } = {};
  if (typeof body.notes === "string") data.notes = body.notes;
  if (body.status === "ENDED") {
    data.status = "ENDED";
    data.endedAt = new Date();
  }

  const updated = await db.consultation.update({ where: { id }, data });

  // Görüşme bittiğinde vakayı tamamlandı işaretle
  if (data.status === "ENDED") {
    await db.case.update({ where: { id: updated.caseId }, data: { status: "DONE" } });
  }

  return NextResponse.json(updated);
}
