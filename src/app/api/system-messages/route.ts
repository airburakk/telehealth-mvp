import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { decryptField } from "@/lib/crypto";

// Sistem mesajları (v6.79) — /api/notifications ile aynı hedefleme sözleşmesi:
// rol yayını (role) VEYA kişisel (userId); ADMIN her şeyi görür (denetim).
function whereFor(user: { id: string; role: string }) {
  return user.role === "ADMIN" ? {} : { OR: [{ role: user.role }, { userId: user.id }] };
}

// GET /api/system-messages — kullanıcının sistem mesajları + okunmamış sayısı.
// ?count=1 → yalnız okunmamış sayısı (header menü rozeti 30sn yoklaması — liste taşınmaz).
// body/reply at-rest şifreli → SUNUCUDA çözülür; repliedByUserId yanıt gövdesine ASLA konmaz
// (anonimlik — kurul dahil hiçbir istemci yanıtlayanın kimliğini görmez).
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const where = whereFor(user);
  if (new URL(req.url).searchParams.get("count") === "1") {
    const unread = await db.systemMessage.count({ where: { ...where, readAt: null } });
    return NextResponse.json({ unread });
  }
  const [rows, unread] = await Promise.all([
    db.systemMessage.findMany({ where, orderBy: { createdAt: "desc" }, take: 50 }),
    db.systemMessage.count({ where: { ...where, readAt: null } }),
  ]);
  const items = rows.map((m) => ({
    id: m.id,
    kind: m.kind,
    subject: m.subject,
    body: decryptField(m.body),
    needsReply: m.needsReply,
    reply: decryptField(m.reply),
    repliedAt: m.repliedAt,
    readAt: m.readAt,
    createdAt: m.createdAt,
    // Yanıt hakkı bu istemcide mi: kişisel mesajda hedef kullanıcı; rol mesajında o roldeki herkes.
    canReply: m.needsReply && !m.repliedAt && (m.userId ? m.userId === user.id : m.role === user.role || user.role === "ADMIN"),
  }));
  return NextResponse.json({ items, unread });
}

// POST /api/system-messages — kullanıcının tüm okunmamışlarını okundu işaretle (bildirim deseni)
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  await db.systemMessage.updateMany({ where: { ...whereFor(user), readAt: null }, data: { readAt: new Date() } });
  return NextResponse.json({ ok: true });
}
