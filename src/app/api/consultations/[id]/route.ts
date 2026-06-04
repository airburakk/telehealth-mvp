import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// PATCH /api/consultations/:id — not kaydet / görüşmeyi bitir
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
