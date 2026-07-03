import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canCaseBeAccessedBy } from "@/lib/ownership";
import { recordAccess, reqMeta } from "@/lib/audit";
import { encryptField } from "@/lib/crypto";

// PATCH /api/consultations/:id — not kaydet / görüşmeyi bitir
// Erişim: klinik personel (DOCTOR/COORDINATOR/ADMIN) + vakanın sahipliği (BOLA düzeltmesi: rol tek
// başına yetmez; doktor yalnız kendi vakasının görüşmesine yazabilir/kapatabilir).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  if (!["DOCTOR", "COORDINATOR", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const { id } = await params;

  // Sahiplik: update ETMEDEN ÖNCE görüşme→vaka zinciri doğrulanır (status ENDED vakayı DONE yazar).
  const cons = await db.consultation.findUnique({
    where: { id },
    select: { caseId: true, case: { select: { userId: true, doctorId: true, branch: true } } },
  });
  if (!cons) return NextResponse.json({ error: "Görüşme bulunamadı." }, { status: 404 });
  if (!(await canCaseBeAccessedBy(user, cons.case))) {
    return NextResponse.json({ error: "Bu vakaya erişim yetkiniz yok." }, { status: 403 });
  }

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
  await recordAccess({
    actor: user,
    action: data.status === "ENDED" ? "CONSULT_END" : "CONSULT_WRITE",
    resourceType: "CONSULTATION",
    resourceId: updated.id,
    subjectUserId: cons.case?.userId ?? null,
    detail: data.status === "ENDED" ? "görüşme bitirildi" : "klinik not güncellendi",
    ...reqMeta(req),
  });

  return NextResponse.json(updated);
}
