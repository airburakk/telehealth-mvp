import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { sendMessage, messagesFor, markMessagesRead, type ChatSender, type ChatSenderRole } from "@/lib/consultation-requests";

export const maxDuration = 60; // mesaj alıcı diline çevrilir (AI) → uzun sürebilir

// Oturumdan chat tarafını çöz: PARTNER (kendi partnerId) veya DOCTOR (consultOptIn). Diğer roller yok.
async function resolveSender(userId: string, role: string): Promise<{ sender: ChatSender; viewer: ChatSenderRole } | null> {
  if (role === "PARTNER") {
    const u = await db.user.findUnique({ where: { id: userId }, select: { partnerId: true } });
    if (!u?.partnerId) return null;
    return { sender: { role: "PARTNER", partnerId: u.partnerId }, viewer: "PARTNER" };
  }
  if (role === "DOCTOR") {
    const u = await db.user.findUnique({ where: { id: userId }, select: { doctorId: true } });
    const doc = u?.doctorId ? await db.doctor.findUnique({ where: { id: u.doctorId }, select: { id: true, consultOptIn: true } }) : null;
    if (!doc || !doc.consultOptIn) return null;
    return { sender: { role: "DOCTOR", doctorId: doc.id }, viewer: "DOCTOR" };
  }
  return null;
}

// Bu kullanıcı bu talebin tarafı mı? (thread'i yalnız partner sahibi + sahiplenen/yanıtlayan doktor okur)
async function isParty(requestId: string, sender: ChatSender): Promise<boolean> {
  const r = await db.consultationRequest.findUnique({
    where: { id: requestId },
    select: { requestedByPartnerId: true, engagedByDoctorId: true, answeredByDoctorId: true },
  });
  if (!r) return false;
  if (sender.role === "PARTNER") return r.requestedByPartnerId === sender.partnerId;
  return r.engagedByDoctorId === sender.doctorId || r.answeredByDoctorId === sender.doctorId;
}

// GET — thread (viewer dilinde). Taraf değilse boş döner (sızıntı yok). Açılışta okundu işaretlenir.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  const r = await resolveSender(user.id, user.role);
  if (!r) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  const { id } = await params;
  if (!(await isParty(id, r.sender))) return NextResponse.json({ messages: [] });
  const messages = await messagesFor(id, r.viewer);
  await markMessagesRead(id, r.viewer);
  return NextResponse.json({ messages });
}

// POST — mesaj gönder (sahiplik/yarış-güvenli + AI oto-çeviri; sendMessage doğrular).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  const r = await resolveSender(user.id, user.role);
  if (!r) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const text = typeof b.text === "string" ? b.text : "";

  const res = await sendMessage(id, r.sender, text);
  if (res === "OK") {
    const messages = await messagesFor(id, r.viewer);
    return NextResponse.json({ ok: true, messages });
  }
  const map: Record<string, { status: number; error: string }> = {
    EMPTY: { status: 400, error: "Mesaj boş olamaz." },
    NOT_FOUND: { status: 404, error: "Talep bulunamadı." },
    FORBIDDEN: { status: 403, error: "Bu görüşmeye erişiminiz yok." },
    TAKEN: { status: 409, error: "Bu talebi başka bir doktor sahiplendi." },
    NOT_READY: { status: 409, error: "Henüz bir uzman doktor görüşmeye katılmadı." },
  };
  const e = map[res] ?? { status: 400, error: "Mesaj gönderilemedi." };
  return NextResponse.json({ error: e.error }, { status: e.status });
}
