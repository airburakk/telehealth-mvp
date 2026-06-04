import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/cases/:id/complaint — Etik Kurul'a başvuru oluştur
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await db.case.findUnique({ where: { id } });
  if (!c) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const subject = String(b.subject ?? "").trim();
  const description = String(b.description ?? "").trim();
  if (!subject || !description) {
    return NextResponse.json({ error: "Konu ve açıklama zorunludur." }, { status: 400 });
  }

  const latestBooking = await db.booking.findFirst({ where: { caseId: c.id }, orderBy: { createdAt: "desc" } });

  const complaint = await db.complaint.create({
    data: {
      caseId: c.id,
      bookingId: latestBooking?.id ?? null,
      subject,
      description,
      requestType: ["REFUND", "DOCTOR_CHANGE", "HOSPITAL_CHANGE", "OTHER"].includes(b.requestType) ? b.requestType : "OTHER",
      evidence: b.evidence ? String(b.evidence) : null,
    },
  });

  return NextResponse.json({ complaintId: complaint.id }, { status: 201 });
}
