import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { encryptField } from "@/lib/crypto";

const CHANNELS = new Set(["APP", "WHATSAPP", "SMS"]);

// POST /api/doctor/notify-channel — doktorun bildirim kanalı tercihi + cep telefonu (FAZ 5, 2026-07-10).
// WhatsApp/SMS seçiliyorsa telefon zorunlu (mevcut kayıtlı numara da yoksa 400).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
  if (!dbUser?.doctorId) {
    return NextResponse.json({ error: "Bu hesap bir doktor profiline bağlı değil." }, { status: 400 });
  }

  const b = await req.json().catch(() => ({}));
  const channel = String(b.channel ?? "APP").toUpperCase();
  if (!CHANNELS.has(channel)) return NextResponse.json({ error: "Geçersiz kanal." }, { status: 400 });

  const phoneRaw = String(b.phone ?? "").replace(/[^\d+ ]/g, "").trim().slice(0, 20);
  const phone = phoneRaw.length >= 7 ? phoneRaw : null;

  if (channel !== "APP" && !phone) {
    const current = await db.doctor.findUnique({ where: { id: dbUser.doctorId }, select: { phone: true } });
    if (!current?.phone) {
      return NextResponse.json({ error: "WhatsApp/SMS kanalı için cep telefonu numarası gerekli." }, { status: 400 });
    }
  }

  await db.doctor.update({
    where: { id: dbUser.doctorId },
    data: {
      notifyChannel: channel,
      ...(phone ? { phone: encryptField(phone) } : {}), // kişisel veri → at-rest şifreli; boşsa mevcut korunur
    },
  });

  return NextResponse.json({ ok: true, channel });
}
