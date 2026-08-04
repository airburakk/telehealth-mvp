import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { parseOptions, aggregateResults } from "@/lib/survey";

export const dynamic = "force-dynamic";

// POST /api/survey/respond — Doctorium anket yanıtı (v6.69 Faz 2). Self-auth: yalnız DOCTOR +
// kendi Doctor kaydı (anket "doktor görüşü" ürünüdür; personel yanıtlayamaz — kart da çizilmez).
// Doktor başına BİR yanıt (@@unique; yarışta P2002 → 409). Yanıt sonrası agregat sonucu döner —
// kart ikinci istek atmadan sonuç görünümüne geçer. Tekil yanıt hiçbir yüzeye verilmez.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
  if (!me?.doctorId) {
    return NextResponse.json({ error: "Doktor profili bağlı değil." }, { status: 400 });
  }

  const b = await req.json().catch(() => ({}));
  const surveyId = typeof b.surveyId === "string" ? b.surveyId : "";
  const optionIndex = Number.isInteger(b.optionIndex) ? (b.optionIndex as number) : -1;
  if (!surveyId) return NextResponse.json({ error: "surveyId zorunlu." }, { status: 400 });

  const s = await db.survey.findUnique({
    where: { id: surveyId },
    select: { status: true, startsAt: true, endsAt: true, options: true },
  });
  if (!s) return NextResponse.json({ error: "Anket bulunamadı." }, { status: 404 });

  const now = new Date();
  if (s.status !== "ACTIVE" || s.startsAt > now || s.endsAt < now) {
    return NextResponse.json({ error: "Anket yayında değil." }, { status: 400 });
  }
  const options = parseOptions(s.options);
  if (optionIndex < 0 || optionIndex >= options.length) {
    return NextResponse.json({ error: "Geçersiz şık." }, { status: 400 });
  }

  try {
    await db.surveyResponse.create({
      data: { surveyId, doctorId: me.doctorId, optionIndex },
    });
  } catch (e) {
    // Aynı doktorun ikinci yanıtı: unique ihlali (iki sekme/yarış dahil) → mükerrer değil, 409.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "Bu anketi zaten yanıtladınız." }, { status: 409 });
    }
    throw e;
  }

  const results = await aggregateResults(surveyId, options.length);
  return NextResponse.json({ ok: true, myIndex: optionIndex, ...results });
}
