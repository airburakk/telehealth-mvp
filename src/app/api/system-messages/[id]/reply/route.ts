import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { encryptField } from "@/lib/crypto";
import { notifyRoles } from "@/lib/notify";
import { recordAccess, reqMeta } from "@/lib/audit";

// POST /api/system-messages/:id/reply — yanıt bekleyen sistem mesajına TEK yanıt (v6.79).
// Yetki: kişisel mesajda YALNIZ hedef kullanıcı; rol mesajında o roldeki kullanıcı (+ADMIN).
// Kişisel mesaja ADMIN dahi yanıt veremez — savunma, karşı tarafın KENDİ beyanıdır.
// Yanıt şifreli yazılır; kurula DEFENSE_REPLY bildirimi düşer (kimlik değil, konu taşır).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  const msg = await db.systemMessage.findUnique({ where: { id } });
  if (!msg) return NextResponse.json({ error: "Mesaj bulunamadı." }, { status: 404 });

  const allowed = msg.userId ? msg.userId === user.id : msg.role ? msg.role === user.role || user.role === "ADMIN" : false;
  if (!allowed) return NextResponse.json({ error: "Bu mesajı yanıtlama yetkiniz yok." }, { status: 403 });
  if (!msg.needsReply) return NextResponse.json({ error: "Bu mesaj yanıt beklemiyor." }, { status: 400 });

  const b = await req.json().catch(() => ({}));
  const text = String(b.reply ?? "").trim();
  if (text.length < 10) return NextResponse.json({ error: "Yanıt metni en az 10 karakter olmalıdır." }, { status: 400 });

  // Atomik tek-yanıt kilidi: repliedAt hâlâ null olan satırı güncelle — yarışta ikinci istek 409.
  const updated = await db.systemMessage.updateMany({
    where: { id, repliedAt: null },
    data: { reply: encryptField(text), repliedAt: new Date(), repliedByUserId: user.id },
  });
  if (updated.count === 0) return NextResponse.json({ error: "Bu talep zaten yanıtlanmış." }, { status: 409 });

  // Kurula haber: normal bildirim (sistem mesajı değil — kurul talebin sahibi, karşı taraf değil).
  const complaintId = msg.threadKey?.startsWith("complaint:") ? msg.threadKey.slice("complaint:".length) : null;
  await notifyRoles(["ETHICS"], {
    type: "DEFENSE_REPLY",
    title: "⚖️ Savunma/bilgi yanıtı geldi",
    body: msg.subject.slice(0, 80),
    href: complaintId ? `/etik-kurul/${complaintId}` : "/etik-kurul",
  });

  // Audit: yanıt İÇERİĞİ yazılmaz; vaka sahibi hasta subject olarak bağlanır (zincir bütünlüğü).
  let subjectUserId: string | null = null;
  if (complaintId) {
    const complaint = await db.complaint.findUnique({ where: { id: complaintId }, include: { case: { select: { userId: true } } } });
    subjectUserId = complaint?.case.userId ?? null;
  }
  await recordAccess({
    actor: user,
    action: "DEFENSE_REPLY",
    resourceType: "SYSTEM_MESSAGE",
    resourceId: msg.id,
    subjectUserId,
    detail: msg.kind,
    ...reqMeta(req),
  });

  return NextResponse.json({ ok: true });
}
