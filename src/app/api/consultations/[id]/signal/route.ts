import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canCaseBeAccessedBy } from "@/lib/ownership";
import { encryptField, decryptField } from "@/lib/crypto";
import { issueSideToken, verifySideToken, type Side } from "@/lib/signal-token";
import type { SessionUser } from "@/lib/session";

// Taraf çözümleme (P1): önce imzalı token (DB'siz), yoksa callerSide (DB) → başarılıysa taze token.
// fresh non-null olduğunda çağıran onu yanıt başlığına koyar; istemci saklayıp sonraki isteklerde yollar.
async function resolveSide(
  user: SessionUser, channelId: string, tokenIn: string | null,
): Promise<{ side: Side | null; fresh: string | null }> {
  const cached = verifySideToken(tokenIn, user.id, channelId, Date.now());
  if (cached) return { side: cached, fresh: null };
  const side = await callerSide(user, channelId);
  return { side, fresh: side ? issueSideToken(user.id, channelId, side, Date.now()) : null };
}

// WebRTC sinyalleşme — polling tabanlı (serverless uyumlu)
// Erişim: oturum + görüşme katılımcısı. Kanal kimliği iki şemadan biri olabilir:
//  • Consultation.id (genel akış) · • SecondOpinionAppointment.id (SO izole oda — externalVideoRef, FK yok).
// Katılımcı = vakanın sahibi hasta VEYA klinik personel (ownsCase deseni). sender oturumdan türetilir
// (gövdeye güvenilmez → taraf taklidi engellenir).
async function callerSide(user: SessionUser, channelId: string): Promise<Side | null> {
  const consult = await db.consultation.findUnique({
    where: { id: channelId },
    select: { case: { select: { userId: true, doctorId: true } } },
  });
  if (consult) return (await canCaseBeAccessedBy(user, consult.case)) ? (user.role === "PATIENT" ? "patient" : "doctor") : null;

  const appt = await db.secondOpinionAppointment.findUnique({
    where: { id: channelId },
    select: { patientId: true },
  });
  if (appt) {
    if (user.role !== "PATIENT") return "doctor"; // klinik personel
    return appt.patientId === user.id ? "patient" : null; // yalnız vaka sahibi hasta
  }

  // M5 Faz 3 — konsültasyon görüntülü görüşme kanalı (anonim). Taraflar: sahiplenen doktor + partner.
  // Partner "patient" tarafına eşlenir (non-doktor uç). Gövdeye güvenilmez → taraf oturumdan türetilir.
  const va = await db.consultationVideoAppointment.findUnique({
    where: { id: channelId },
    select: { doctorId: true, partnerId: true },
  });
  if (va) {
    if (user.role === "DOCTOR") {
      const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
      return me?.doctorId === va.doctorId ? "doctor" : null;
    }
    if (user.role === "PARTNER") {
      const me = await db.user.findUnique({ where: { id: user.id }, select: { partnerId: true } });
      return me?.partnerId === va.partnerId ? "patient" : null; // partner = non-doktor uç
    }
    return null;
  }
  return null; // tanınmayan kanal
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
  await db.signal.create({
    data: { consultationId: id, sender: side, kind, data: encryptField(plain) },
  });
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
