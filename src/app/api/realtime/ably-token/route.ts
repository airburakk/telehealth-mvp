import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { resolveSignalSide } from "@/lib/signal-access";
import { createAblyTokenRequest, ablyConfigured } from "@/lib/ably-server";

// Ably token-auth uç noktası (P1 #6 Faz 2). İstemci Ably.Realtime authUrl'i buraya bakar.
// Yetki: oturum + görüşme katılımcısı (signal route ile AYNI resolveSignalSide kapısı). Yalnız
// erişebildiği kanala ABONE yetkili kısa token üretir; API anahtarı sunucuda kalır.
// Ably kurulu değilse 503 → istemci sessizce DB-polling yoluna düşer (Ably opsiyonel).
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  const channelId = new URL(req.url).searchParams.get("channel");
  if (!channelId) return NextResponse.json({ error: "Kanal gerekli." }, { status: 400 });

  const side = await resolveSignalSide(user, channelId);
  if (!side) return NextResponse.json({ error: "Bu görüşmeye erişim yetkiniz yok." }, { status: 403 });

  if (!ablyConfigured()) return NextResponse.json({ error: "Realtime devre dışı." }, { status: 503 });

  const tokenRequest = await createAblyTokenRequest(user.id, channelId);
  if (!tokenRequest) return NextResponse.json({ error: "Realtime devre dışı." }, { status: 503 });
  return NextResponse.json(tokenRequest);
}
