import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getDoctorBalance } from "@/lib/rewards";

export const dynamic = "force-dynamic";

// GET /api/rewards — doktorun ödül durumu (v6.88): bakiye + aktif katalog + talepleri + son
// kazanç hareketleri. Self-auth: yalnız DOCTOR + bağlı Doctor kaydı (respond ucu deseni).
// Sayfa server-render'da aynı verileri kendisi çeker; bu uç kart/istemci tazelemesi içindir.
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
  if (!me?.doctorId) {
    return NextResponse.json({ error: "Doktor profili bağlı değil." }, { status: 400 });
  }

  const [balance, items, redemptions, entries] = await Promise.all([
    getDoctorBalance(me.doctorId),
    db.rewardItem.findMany({
      where: { active: true },
      orderBy: [{ pointsCost: "asc" }, { createdAt: "desc" }],
      select: { id: true, kind: true, title: true, description: true, pointsCost: true },
    }),
    db.rewardRedemption.findMany({
      where: { doctorId: me.doctorId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true, status: true, pointsCost: true, note: true, adminNote: true,
        createdAt: true, decidedAt: true,
        item: { select: { title: true, kind: true } },
      },
    }),
    db.pointEntry.findMany({
      where: { doctorId: me.doctorId },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, delta: true, reason: true, createdAt: true },
    }),
  ]);

  return NextResponse.json({ ok: true, balance, items, redemptions, entries });
}
