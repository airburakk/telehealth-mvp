import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// Hedefleme: rol yayını (role) VEYA kişisel (userId). Admin her şeyi görür.
function whereFor(user: { id: string; role: string }) {
  return user.role === "ADMIN" ? {} : { OR: [{ role: user.role }, { userId: user.id }] };
}

// GET /api/notifications — giriş yapan kullanıcıya gelen son bildirimler + okunmamış sayısı
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const where = whereFor(user);
  const [items, unread] = await Promise.all([
    db.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: 20 }),
    db.notification.count({ where: { ...where, readAt: null } }),
  ]);
  return NextResponse.json({ items, unread });
}

// POST /api/notifications — kullanıcının tüm okunmamışlarını okundu işaretle
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  await db.notification.updateMany({ where: { ...whereFor(user), readAt: null }, data: { readAt: new Date() } });
  return NextResponse.json({ ok: true });
}
