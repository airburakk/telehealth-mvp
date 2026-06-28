import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { LANGUAGES } from "@/lib/constants";

const LANG_SET = new Set(LANGUAGES);

// POST /api/partner/preferences — Partner doktor kendi okuma dilini günceller (haber akışı + arayüz çevirisi).
// Self-auth: yalnız PARTNER rolü + bağlı PartnerDoctor.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "PARTNER") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { partnerId: true } });
  if (!dbUser?.partnerId) {
    return NextResponse.json({ error: "Partner profili bağlı değil." }, { status: 400 });
  }

  const b = await req.json().catch(() => ({}));
  const language = typeof b.language === "string" && LANG_SET.has(b.language) ? b.language : null;
  if (!language) {
    return NextResponse.json({ error: "Geçerli bir dil seçin." }, { status: 400 });
  }

  await db.partnerDoctor.update({ where: { id: dbUser.partnerId }, data: { language } });
  return NextResponse.json({ ok: true });
}
