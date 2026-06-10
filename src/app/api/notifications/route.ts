import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/notifications — giriş yapan kullanıcının rolüne gelen son bildirimler + okunmamış sayısı
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const where = user.role === "ADMIN" ? {} : { role: user.role };
  const [items, unread] = await Promise.all([
    db.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: 20 }),
    db.notification.count({ where: { ...where, readAt: null } }),
  ]);
  return NextResponse.json({ items, unread });
}

// POST /api/notifications — rolün tüm okunmamışlarını okundu işaretle
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const where = user.role === "ADMIN" ? {} : { role: user.role };
  await db.notification.updateMany({ where: { ...where, readAt: null }, data: { readAt: new Date() } });
  return NextResponse.json({ ok: true });
}
