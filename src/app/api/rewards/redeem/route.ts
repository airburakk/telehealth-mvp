import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { redeemReward, transitionRedemption } from "@/lib/rewards";

export const dynamic = "force-dynamic";

// POST /api/rewards/redeem — ödül talebi (v6.88). Puan TALEP anında rezerve düşer (yarış
// advisory lock ile serileşir — lib/rewards.ts); talep REQUESTED doğar, ifa admin onaylı.
// Self-auth: yalnız DOCTOR + bağlı Doctor kaydı.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
  if (!me?.doctorId) {
    return NextResponse.json({ error: "Doktor profili bağlı değil." }, { status: 400 });
  }

  const b = await req.json().catch(() => ({}));
  const itemId = typeof b.itemId === "string" ? b.itemId : "";
  const note = typeof b.note === "string" && b.note.trim() ? b.note.trim().slice(0, 500) : null;
  if (!itemId) return NextResponse.json({ error: "itemId zorunlu." }, { status: 400 });

  const r = await redeemReward(me.doctorId, itemId, note);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true, redemptionId: r.redemptionId, balance: r.balance });
}

// PATCH /api/rewards/redeem — doktorun KENDİ talebini iptali (yalnız REQUESTED → CANCELLED;
// rezerve puan iade satırıyla geri yazılır). Onaylanmış talebi yalnız admin yönetir.
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
  if (!me?.doctorId) {
    return NextResponse.json({ error: "Doktor profili bağlı değil." }, { status: 400 });
  }

  const b = await req.json().catch(() => ({}));
  const redemptionId = typeof b.redemptionId === "string" ? b.redemptionId : "";
  if (!redemptionId) return NextResponse.json({ error: "redemptionId zorunlu." }, { status: 400 });

  const r = await transitionRedemption({
    redemptionId,
    to: "CANCELLED",
    byAdmin: false,
    actorDoctorId: me.doctorId,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status ?? 400 });
  return NextResponse.json({ ok: true });
}
