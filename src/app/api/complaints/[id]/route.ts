import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifyRoles, notifyUser } from "@/lib/notify";
import { getCurrentUser } from "@/lib/auth";

// PATCH /api/complaints/:id — Etik Kurul kararı (yaptırım + Escrow tetikleyicisi)
// Yetki: YALNIZ Etik Kurul (ETHICS) / yönetici — karar Escrow iadesi + rezervasyon iptali tetikler.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  if (!["ETHICS", "ADMIN"].includes(user.role)) return NextResponse.json({ error: "Yalnız Etik Kurul karar verebilir." }, { status: 403 });
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

  const verdictLabel = verdict === "FAVOR" ? "lehinize sonuçlandı" : verdict === "PARTIAL" ? "kısmen kabul edildi" : "reddedildi";
  const decisionNotif = {
    type: "DECISION" as const,
    title: `⚖️ Etik Kurul kararı: başvuru ${verdictLabel}`,
    body: refundAmount ? `İade: $${refundAmount.toLocaleString("en-US")} (Escrow'dan)` : rationale?.slice(0, 80) ?? undefined,
    href: `/sikayet/${complaint.caseId}`,
  };
  // Vaka sahibi belliyse hastaya kişisel bildirim; değilse rol yayını (eski vakalar)
  const ownerCase = await db.case.findUnique({ where: { id: complaint.caseId }, select: { userId: true } });
  if (ownerCase?.userId) {
    await notifyUser(ownerCase.userId, decisionNotif);
    await notifyRoles(["COORDINATOR"], decisionNotif);
  } else {
    await notifyRoles(["PATIENT", "COORDINATOR"], decisionNotif);
  }

  return NextResponse.json(updated);
}
