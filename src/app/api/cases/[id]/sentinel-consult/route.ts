import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ownsCase } from "@/lib/ownership";
import { claimSentinelForCase } from "@/lib/clinical-duty";

// POST /api/cases/:id/sentinel-consult — 3-seçenek kapısı, Seçenek 1: Nöbetçi doktorla ŞİMDİ görüş.
// Çevrimiçi bir Nöbetçi atomik kapılır → konsültasyon oluşur → hasta görüşme odasına gider.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const c = await db.case.findUnique({ where: { id }, select: { userId: true, status: true } });
  if (!c) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });
  if (!ownsCase(user, c)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  if (!["NEW", "IN_REVIEW"].includes(c.status)) {
    return NextResponse.json({ error: "Bu vaka için görüşme zaten başlatılmış." }, { status: 409 });
  }

  const r = await claimSentinelForCase(id);
  if (!r) return NextResponse.json({ error: "Şu an çevrimiçi nöbetçi doktor yok." }, { status: 409 });
  return NextResponse.json({ consultationId: r.consultationId }, { status: 201 });
}
