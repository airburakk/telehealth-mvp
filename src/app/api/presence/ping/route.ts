import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { touchPresence } from "@/lib/consultation-video";

// POST /api/presence/ping — Faz 3 heartbeat. Oturum rolüne göre Doctor/PartnerDoctor.lastSeenAt tazelenir.
// İstemci ~20 sn'de bir çağırır (PresencePinger). Klinik veri yok; yalnız online tespiti.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (user.role === "DOCTOR") {
    const u = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
    await touchPresence("DOCTOR", { doctorId: u?.doctorId });
  } else if (user.role === "PARTNER") {
    const u = await db.user.findUnique({ where: { id: user.id }, select: { partnerId: true } });
    await touchPresence("PARTNER", { partnerId: u?.partnerId });
  }
  return NextResponse.json({ ok: true });
}
