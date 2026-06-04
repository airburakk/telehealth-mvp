import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assessCheckIn } from "@/lib/postop";

// POST /api/cases/:id/checkin — günlük iyileşme kontrolü
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await db.case.findUnique({ where: { id } });
  if (!c) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });

  const recovery = await db.recovery.upsert({
    where: { caseId: c.id },
    update: {},
    create: { caseId: c.id, branch: c.branch },
  });

  const b = await req.json().catch(() => ({}));
  const pain = Math.min(10, Math.max(0, Number(b.pain) || 0));
  const feverC = Math.min(43, Math.max(34, Number(b.feverC) || 36.5));
  const meds = b.meds !== false;
  const note = b.note ? String(b.note) : null;
  const photo = b.photo ? String(b.photo) : null;

  const assessment = assessCheckIn({ pain, feverC, meds, note: note ?? undefined });

  const checkIn = await db.checkIn.create({
    data: { recoveryId: recovery.id, pain, feverC, meds, note, photo, severity: assessment.severity },
  });

  return NextResponse.json({ id: checkIn.id, severity: assessment.severity, reasons: assessment.reasons }, { status: 201 });
}
