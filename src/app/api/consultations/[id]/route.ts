import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { recordAccess, reqMeta } from "@/lib/audit";
import { encryptField } from "@/lib/crypto";

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
  if (typeof body.notes === "string") data.notes = encryptField(body.notes as string); // SOAP notu at-rest şifrelenir (E2EE Faz 1)
  if (body.status === "ENDED") {
    data.status = "ENDED";
    data.endedAt = new Date();
  }

  const updated = await db.consultation.update({ where: { id }, data });

  // Görüşme bittiğinde vakayı tamamlandı işaretle
  if (data.status === "ENDED") {
    await db.case.update({ where: { id: updated.caseId }, data: { status: "DONE" } });
  }

  // Denetim: klinik not yazma / görüşme kapatma (kim/ne zaman/hangi vaka).
  const subj = await db.case.findUnique({ where: { id: updated.caseId }, select: { userId: true } });
  await recordAccess({
    actor: user,
    action: data.status === "ENDED" ? "CONSULT_END" : "CONSULT_WRITE",
    resourceType: "CONSULTATION",
    resourceId: updated.id,
    subjectUserId: subj?.userId ?? null,
    detail: data.status === "ENDED" ? "görüşme bitirildi" : "klinik not güncellendi",
    ...reqMeta(req),
  });

  return NextResponse.json(updated);
}
