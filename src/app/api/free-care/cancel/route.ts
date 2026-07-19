import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/api-auth";
import { publishLiveNudge } from "@/lib/ably-server";

// POST /api/free-care/cancel — hasta kendi BEKLEYEN ücretsiz-sağlık başvurusunu sıradan çeker
// (basitleştirme Faz 4, 2026-07-12: çevrimiçi-doktor kilidi kalktı, başvuru her zaman alınır —
// karşılığında hastaya sıradan çekilme hakkı verildi). Yalnız vaka sahibi + yalnız WAITING.
export async function POST(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  const b = await req.json().catch(() => ({}));
  const caseId = String(b.caseId ?? "");
  if (!caseId) return NextResponse.json({ error: "caseId gerekli." }, { status: 400 });

  const c = await db.case.findUnique({
    where: { id: caseId },
    select: { userId: true, freeCare: true, freeCareStatus: true },
  });
  if (!c || c.userId !== user.id) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
  if (!c.freeCare || c.freeCareStatus !== "WAITING") {
    return NextResponse.json({ error: "Bu başvuru beklemede değil." }, { status: 409 });
  }

  await db.case.update({ where: { id: caseId }, data: { freeCareStatus: "CANCELLED" } });
  await publishLiveNudge("free-care"); // kuyruk kısaldı → bekleyen sıraları + konsol sayısı tazelensin (v6.28)
  return NextResponse.json({ ok: true });
}
