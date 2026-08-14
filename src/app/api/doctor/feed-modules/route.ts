import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { FEED_MODULE_OPTIONS } from "@/lib/doctorium";

const VALID = new Set(FEED_MODULE_OPTIONS.map((o) => o.key as string));

// POST /api/doctor/feed-modules — Doctorium Akış Tercihleri (Faz 2, 2026-08-14): Akışım'a hangi
// bölümler girsin. news-branches deseninin kopyası; self-auth (middleware /api'yi korumaz).
// Klinik yetkiyi DEĞİŞTİRMEZ. TÜM bölümler seçiliyse null yazılır (= varsayılan "tümü";
// gelecekte bölüm listesi büyürse eski kayıt yeni bölümü de otomatik görür).
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
  const raw: unknown = body.modules;
  const modules = Array.isArray(raw)
    ? [...new Set(raw.filter((s): s is string => typeof s === "string" && VALID.has(s)))]
    : [];
  if (modules.length === 0) {
    return NextResponse.json({ error: "En az bir bölüm seçili olmalı." }, { status: 400 });
  }

  await db.doctor.update({
    where: { id: me.doctorId },
    data: { feedModules: modules.length === VALID.size ? null : JSON.stringify(modules) },
  });

  return NextResponse.json({ ok: true, count: modules.length });
}
