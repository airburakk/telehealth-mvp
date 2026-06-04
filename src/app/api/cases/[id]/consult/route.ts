import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/cases/:id/consult — vaka için görüşme başlat (doktor ataması + consultation oluşturma)
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const caseItem = await db.case.findUnique({ where: { id }, include: { consultations: true } });
  if (!caseItem) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });

  // Aktif görüşme varsa onu döndür
  const active = caseItem.consultations.find((c) => c.status === "ACTIVE");
  if (active) return NextResponse.json({ consultationId: active.id }, { status: 200 });

  // Doktor ata: önce atanmış doktor, yoksa branşa uyan, yoksa ilk doktor
  let doctorId = caseItem.doctorId;
  if (!doctorId) {
    const match = await db.doctor.findFirst({ where: { branch: caseItem.branch } });
    doctorId = match?.id ?? (await db.doctor.findFirst())?.id ?? null;
  }
  if (!doctorId) return NextResponse.json({ error: "Sistemde uygun doktor yok." }, { status: 409 });

  const consultation = await db.consultation.create({
    data: { caseId: caseItem.id, doctorId },
  });

  await db.case.update({
    where: { id: caseItem.id },
    data: { status: "IN_CONSULT", doctorId },
  });

  return NextResponse.json({ consultationId: consultation.id }, { status: 201 });
}
