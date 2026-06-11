import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { pushEnabled } from "@/lib/push";

// GET /api/push — istemciye VAPID public key (push aktif mi?)
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  return NextResponse.json({
    enabled: pushEnabled(),
    publicKey: process.env.VAPID_PUBLIC_KEY ?? null,
  });
}

// POST /api/push — cihaz aboneliğini kaydet (PushManager.subscribe çıktısı)
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const endpoint = String(b.endpoint ?? "");
  const p256dh = String(b.keys?.p256dh ?? "");
  const auth = String(b.keys?.auth ?? "");
  if (!endpoint.startsWith("https://") || !p256dh || !auth) {
    return NextResponse.json({ error: "Geçersiz abonelik." }, { status: 400 });
  }

  // Aynı cihaz yeniden abone olursa güncelle (kullanıcı/rol değişmiş olabilir)
  await db.pushSubscription.upsert({
    where: { endpoint },
    update: { userId: user.id, role: user.role, p256dh, auth },
    create: { endpoint, userId: user.id, role: user.role, p256dh, auth },
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}

// DELETE /api/push — aboneliği kaldır
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const endpoint = String(b.endpoint ?? "");
  if (endpoint) await db.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
  return NextResponse.json({ ok: true });
}
