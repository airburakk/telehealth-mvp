import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { notifyUser } from "@/lib/notify";
import {
  parseJourney,
  JOURNEY_STAGES,
  JOURNEY_STAGE_KEYS,
  isJourneyStatus,
  type JourneyStage,
  type JourneyStatus,
} from "@/lib/journey";

const STAFF_ROLES = ["COORDINATOR", "ADMIN"];

// POST /api/bookings/:bookingId/journey — koordinatör/operasyon lojistik aşamalarını günceller.
// Body: { stages: { key, status, plannedAt?, doneAt?, note? }[] }.
// Self-auth (middleware /api'yi korumaz → route kendi auth'unu yapar). Bir aşama ilerleyince (yeni
// done/active) vaka sahibine bildirim. Lojistik = klinik veri DEĞİL → audit (recordAccess) yok.
export async function POST(req: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;

  const user = await getCurrentUser();
  if (!user || !STAFF_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { case: true } });
  if (!booking) return NextResponse.json({ error: "Rezervasyon bulunamadı." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const input: unknown = body?.stages;
  if (!Array.isArray(input)) {
    return NextResponse.json({ error: "Geçersiz istek (stages dizisi gerekli)." }, { status: 400 });
  }

  // Gelen aşamaları doğrula + normalize (bilinmeyen key/status atılır; not 500 karakterle sınırlı).
  const incoming = new Map<string, JourneyStage>();
  for (const it of input) {
    if (!it || typeof it !== "object") continue;
    const r = it as Record<string, unknown>;
    if (typeof r.key !== "string" || !JOURNEY_STAGE_KEYS.includes(r.key)) continue;
    if (!isJourneyStatus(r.status)) continue;
    incoming.set(r.key, {
      key: r.key,
      status: r.status as JourneyStatus,
      plannedAt: typeof r.plannedAt === "string" && r.plannedAt ? r.plannedAt : null,
      doneAt: typeof r.doneAt === "string" && r.doneAt ? r.doneAt : null,
      note: typeof r.note === "string" && r.note.trim() ? r.note.trim().slice(0, 500) : null,
    });
  }

  const prev = parseJourney(booking.journeyData);
  const prevByKey = new Map(prev.map((s) => [s.key, s]));
  // Kanonik 5 aşama: gelen varsa onu, yoksa önceki durumu koru.
  const next: JourneyStage[] = JOURNEY_STAGES.map(
    (s) => incoming.get(s.key) ?? prevByKey.get(s.key) ?? { key: s.key, status: "pending" as JourneyStatus },
  );

  await db.booking.update({ where: { id: booking.id }, data: { journeyData: JSON.stringify(next) } });

  // Aşama ilerlemesi → vaka sahibine bildirim (FAIL-SAFE). Yeni "done" öncelikli, yoksa yeni "active".
  const stageLabel = (k: string) => JOURNEY_STAGES.find((s) => s.key === k)?.label ?? k;
  const newlyDone = next.find((s) => s.status === "done" && prevByKey.get(s.key)?.status !== "done");
  const newlyActive = next.find(
    (s) => s.status === "active" && prevByKey.get(s.key)?.status !== "active" && prevByKey.get(s.key)?.status !== "done",
  );
  const milestone = newlyDone ?? newlyActive;
  if (milestone && booking.case.userId) {
    await notifyUser(booking.case.userId, {
      type: "BOOKING",
      title: "🧳 Yolculuk güncellendi",
      body: `${stageLabel(milestone.key)} ${newlyDone ? "tamamlandı" : "başladı"}`,
      href: `/rezervasyon/${booking.id}`,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, stages: next });
}
