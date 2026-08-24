import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { DOCTORIUM_NOTIFICATION_TYPES } from "@/lib/notify";

// Hedefleme: rol yayını (role) VEYA kişisel (userId). Admin her şeyi görür.
function whereFor(user: { id: string; role: string }) {
  return user.role === "ADMIN" ? {} : { OR: [{ role: user.role }, { userId: user.id }] };
}

// AURA↔Doctorium ayrışması (2026-08-24): ?scope=doctorium yalnız Doctorium tiplerini
// (bugün CONGRESS_ALERT) döndürür/işaretler — Doctorium kromundaki zil klinik (AURA)
// bildirimlerini GÖRMEZ ve "tümünü okundu" onlara DOKUNMAZ. Scope'suz çağrı = eski
// davranış birebir (AURA kromu her şeyi görür, Doctorium tipleri dahil).
function scopeFilter(req: Request): { type?: { in: string[] } } {
  const scope = new URL(req.url).searchParams.get("scope");
  return scope === "doctorium" ? { type: { in: [...DOCTORIUM_NOTIFICATION_TYPES] } } : {};
}

// GET /api/notifications — giriş yapan kullanıcıya gelen son bildirimler + okunmamış sayısı
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const where = { ...whereFor(user), ...scopeFilter(req) };
  const [items, unread] = await Promise.all([
    db.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: 20 }),
    db.notification.count({ where: { ...where, readAt: null } }),
  ]);
  return NextResponse.json({ items, unread });
}

// POST /api/notifications — kullanıcının scope içindeki tüm okunmamışlarını okundu işaretle
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  await db.notification.updateMany({
    where: { ...whereFor(user), ...scopeFilter(req), readAt: null },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
