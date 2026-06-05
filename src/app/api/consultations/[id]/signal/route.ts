import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// WebRTC sinyalleşme — polling tabanlı (serverless uyumlu)

// POST /api/consultations/:id/signal — bir sinyal mesajı gönder
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const sender = b.sender === "patient" ? "patient" : "doctor";
  const kind = ["offer", "answer", "ice", "bye"].includes(b.kind) ? b.kind : null;
  if (!kind) return NextResponse.json({ error: "Geçersiz tür." }, { status: 400 });

  await db.signal.create({
    data: { consultationId: id, sender, kind, data: typeof b.data === "string" ? b.data : JSON.stringify(b.data ?? null) },
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}

// GET /api/consultations/:id/signal?role=<me>&after=<id> — karşı taraftan yeni mesajlar
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const me = searchParams.get("role") === "patient" ? "patient" : "doctor";
  const after = Number(searchParams.get("after") ?? 0) || 0;

  const messages = await db.signal.findMany({
    where: { consultationId: id, sender: { not: me }, id: { gt: after } },
    orderBy: { id: "asc" },
    take: 50,
  });
  return NextResponse.json(messages.map((m) => ({ id: m.id, kind: m.kind, data: m.data })));
}
