import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { setSponsorPersonalization } from "@/lib/sponsor";

export const dynamic = "force-dynamic";

// POST /api/doctor/sponsor-consent — Doctorium sponsorlu içerik KİŞİSELLEŞTİRME rızası aç/kapat
// (v6.68 Faz 1). Self-auth (middleware /api'yi korumaz): yalnız DOCTOR + kendi Doctor kaydı;
// yalnız KENDİ rızasını yazar (BOLA yüzeyi yok). Durum Doctor.sponsorPersonalizationAt'ta,
// ispat ConsentRecord zincirinde (grant fail-closed, revoke derhâl — lib/sponsor.ts).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
  if (!me?.doctorId) {
    return NextResponse.json({ error: "Doktor profili bağlı değil." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  if (typeof body.enable !== "boolean") {
    return NextResponse.json({ error: "enable alanı boolean olmalı." }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = req.headers.get("user-agent")?.slice(0, 400) || null;
  await setSponsorPersonalization(user.id, me.doctorId, body.enable, ip, userAgent);

  return NextResponse.json({ ok: true, enabled: body.enable });
}
