import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// PATCH /api/shares/:id — paylaşımı anında iptal et (geçersizleştir)
export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !["PATIENT", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const { id } = await params;
  const link = await db.shareLink.findUnique({ where: { id } });
  if (!link) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });

  if (!link.revokedAt) {
    await db.shareLink.update({ where: { id }, data: { revokedAt: new Date() } });
  }
  return NextResponse.json({ ok: true });
}
