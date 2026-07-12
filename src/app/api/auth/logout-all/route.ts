// Tüm cihazlardan çıkış (JWT iptali): revokeUserSessions User.sessionVersion'ı artırır → dolaşımdaki
// TÜM token'ların sv claim'i bayatlar, getCurrentUser hepsini reddeder. Bu cihazın cookie'si de silinir.
import { NextResponse } from "next/server";
import { destroySession, getCurrentUser, revokeUserSessions } from "@/lib/auth";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });
  await revokeUserSessions(user.id);
  await destroySession();
  return NextResponse.json({ ok: true });
}
