import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const VALID_CHANNELS = new Set(["app", "email"]);

// POST /api/doctor/digest — Doctorium Post günlük özet aboneliği (2026-08-24).
// feed-modules deseninin kopyası; self-auth (middleware /api'yi korumaz).
// body.channel: null = kapalı · "app" = uygulama içi · "email" = e-posta + uygulama içi.
// ⚖️ Abonelik AÇIK SEÇİMDİR (opt-in) — varsayılan null; bu uç yalnız doktorun kendi seçimini yazar.
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
  const raw: unknown = body.channel;
  const channel = raw === null || raw === "" ? null : typeof raw === "string" && VALID_CHANNELS.has(raw) ? raw : undefined;
  if (channel === undefined) {
    return NextResponse.json({ error: "Geçersiz kanal." }, { status: 400 });
  }

  await db.doctor.update({ where: { id: me.doctorId }, data: { digestChannel: channel } });
  return NextResponse.json({ ok: true, channel });
}
