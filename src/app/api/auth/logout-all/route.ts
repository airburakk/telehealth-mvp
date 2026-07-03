// Tüm cihazlardan çıkış (JWT iptali): User.sessionVersion artar → dolaşımdaki TÜM token'ların
// sv claim'i bayatlar, getCurrentUser hepsini reddeder. Bu cihazın cookie'si de silinir.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { destroySession, getCurrentUser } from "@/lib/auth";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });
  await db.user.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 } } });
  await destroySession();
  return NextResponse.json({ ok: true });
}
