import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// PATCH /api/complaints/:id — Etik Kurul kararı (yaptırım + Escrow tetikleyicisi)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const complaint = await db.complaint.findUnique({ where: { id } });
  if (!complaint) return NextResponse.json({ error: "Başvuru bulunamadı." }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const verdict = ["FAVOR", "PARTIAL", "REJECT"].includes(b.verdict) ? b.verdict : "REJECT";
  const action = ["REFUND_FULL", "REFUND_PARTIAL", "SUPPLIER_CHANGE", "ACCREDITATION_WARN", "NONE"].includes(b.action) ? b.action : "NONE";
  const rationale = b.rationale ? String(b.rationale) : null;
  const decidedBy = b.decidedBy ? String(b.decidedBy) : "Etik Kurul";

  // Escrow yaptırımı — ilgili rezervasyona uygula
  let refundAmount: number | null = null;
  if ((action === "REFUND_FULL" || action === "REFUND_PARTIAL") && complaint.bookingId) {
    const booking = await db.booking.findUnique({ where: { id: complaint.bookingId } });
    if (booking) {
      refundAmount = action === "REFUND_FULL" ? booking.total : Math.round((Number(b.refundAmount) || booking.total * 0.5));
      refundAmount = Math.min(refundAmount, booking.total);
      await db.booking.update({ where: { id: booking.id }, data: { escrowStatus: "REFUNDED", status: "CANCELLED" } });
    }
  }

  const updated = await db.complaint.update({
    where: { id },
    data: { status: "RESOLVED", verdict, action, refundAmount, rationale, decidedBy, decidedAt: new Date() },
  });

  return NextResponse.json(updated);
}
