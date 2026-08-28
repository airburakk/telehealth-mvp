import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifyRoles, notifyUser } from "@/lib/notify";
import { getCurrentUser } from "@/lib/auth";
import { defenseLockState } from "@/lib/system-messages";
import { DEFENSE_LOCK_DAYS } from "@/lib/ethics";
import { encryptField } from "@/lib/crypto";

// PATCH /api/complaints/:id — Etik Kurul kararı (yaptırım + Escrow tetikleyicisi)
// Yetki: YALNIZ Etik Kurul (ETHICS) / yönetici — karar Escrow iadesi + rezervasyon iptali tetikler.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  if (!["ETHICS", "ADMIN"].includes(user.role)) return NextResponse.json({ error: "Yalnız Etik Kurul karar verebilir." }, { status: 403 });
  const complaint = await db.complaint.findUnique({ where: { id } });
  if (!complaint) return NextResponse.json({ error: "Başvuru bulunamadı." }, { status: 404 });

  // Savunma kilidi (v6.79): açık savunma/bilgi talebi varken karar verilemez — yanıt gelince
  // VEYA talep tarihinden 3 gün geçince açılır. UI kilidi yetmez; sunucu tarafı da reddeder.
  const lock = await defenseLockState(id);
  if (lock.locked) {
    return NextResponse.json(
      { error: `Açık savunma/bilgi talebi var — yanıt gelmeden ya da ${DEFENSE_LOCK_DAYS} günlük süre dolmadan karar verilemez.${lock.until ? ` Kilit en geç ${lock.until.toLocaleDateString("tr-TR")} tarihinde açılır.` : ""}` },
      { status: 409 }
    );
  }

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

  // rationale at-rest ŞİFRELİ (2026-08-28 — subject/description/evidence ile aynı turda; kurulun
  // karar gerekçesi de vaka bağlamına atıfta bulunabilir). Yerel `rationale` değişkeni bilinçli
  // düz metin kalır — aşağıdaki bildirim gövdesi (satır ~54) ondan üretilir.
  const updated = await db.complaint.update({
    where: { id },
    data: { status: "RESOLVED", verdict, action, refundAmount, rationale: encryptField(rationale), decidedBy, decidedAt: new Date() },
  });

  const verdictLabel = verdict === "FAVOR" ? "lehinize sonuçlandı" : verdict === "PARTIAL" ? "kısmen kabul edildi" : "reddedildi";
  const decisionNotif = {
    type: "DECISION" as const,
    title: `⚖️ Etik Kurul kararı: başvuru ${verdictLabel}`,
    body: refundAmount ? `İade: $${refundAmount.toLocaleString("en-US")} (Escrow'dan — simülasyon)` : rationale?.slice(0, 80) ?? undefined,
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
