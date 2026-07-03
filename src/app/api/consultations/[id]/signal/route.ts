import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { encryptField, decryptField } from "@/lib/crypto";
import { issueSideToken, verifySideToken } from "@/lib/signal-token";
import { resolveSignalSide } from "@/lib/signal-access";
import { publishSignal } from "@/lib/ably-server";
import type { SessionUser } from "@/lib/session";

// Taraf çözümleme (P1): önce imzalı token (DB'siz), yoksa resolveSignalSide (DB) → başarılıysa taze token.
// fresh non-null olduğunda çağıran onu yanıt başlığına koyar; istemci saklayıp sonraki isteklerde yollar.
async function resolveSide(
  user: SessionUser, channelId: string, tokenIn: string | null,
): Promise<{ side: import("@/lib/signal-token").Side | null; fresh: string | null }> {
  const cached = verifySideToken(tokenIn, user.id, channelId, Date.now());
  if (cached) return { side: cached, fresh: null };
  const side = await resolveSignalSide(user, channelId);
  return { side, fresh: side ? issueSideToken(user.id, channelId, side, Date.now()) : null };
}

// POST /api/consultations/:id/signal — bir sinyal mesajı gönder
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  const { id } = await params;
  const { side, fresh } = await resolveSide(user, id, req.headers.get("x-sig-token"));
  if (!side) return NextResponse.json({ error: "Bu görüşmeye erişim yetkiniz yok." }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const kind = ["offer", "answer", "ice", "bye", "transcript"].includes(b.kind) ? b.kind : null;
  if (!kind) return NextResponse.json({ error: "Geçersiz tür." }, { status: 400 });

  // sender oturumdan türetilir (gövdedeki b.sender yok sayılır → taklit engeli)
  // Signal.data at-rest şifrelenir (E2EE Faz 1): transkript = PHI; offer/answer/ice/bye opak round-trip
  // (sunucu saklarken şifreli, GET'te çözüp karşı tarafa düz verir → WebRTC bozulmaz).
  const plain: string = typeof b.data === "string" ? b.data : JSON.stringify(b.data ?? null);
  const row = await db.signal.create({
    data: { consultationId: id, sender: side, kind, data: encryptField(plain) },
    select: { id: true },
  });
  // Ably Faz 2: offer/answer/ice/bye anlık Ably'ye yayınlanır (istemci abone → poll beklemeden alır).
  // TRANSKRİPT YAYINLANMAZ (PHI → Ably'ye gitmez; DB backstop poll taşır). Yayın best-effort (fallback DB).
  if (kind !== "transcript") {
    await publishSignal(id, { id: row.id, kind, data: plain, sender: side });
  }
  return NextResponse.json({ ok: true }, { status: 201, headers: fresh ? { "x-sig-token": fresh } : undefined });
}

// GET /api/consultations/:id/signal?after=<id> — karşı taraftan yeni mesajlar
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  const { id } = await params;
  const { side: me, fresh } = await resolveSide(user, id, req.headers.get("x-sig-token"));
  if (!me) return NextResponse.json({ error: "Bu görüşmeye erişim yetkiniz yok." }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const after = Number(searchParams.get("after") ?? 0) || 0;

  const messages = await db.signal.findMany({
    where: { consultationId: id, sender: { not: me }, id: { gt: after } },
    orderBy: { id: "asc" },
    take: 50,
  });
  return NextResponse.json(
    messages.map((m) => ({ id: m.id, kind: m.kind, data: decryptField(m.data) })),
    { headers: fresh ? { "x-sig-token": fresh } : undefined },
  );
}
