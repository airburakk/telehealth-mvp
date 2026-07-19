import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { resolveSignalSide } from "@/lib/signal-access";
import { createAblyTokenRequest, ablyConfigured, signalChannel } from "@/lib/ably-server";

// Ably token-auth uç noktası (P1 #6 Faz 2). İstemci Ably.Realtime authUrl'i buraya bakar.
// İki kanal ailesi:
//  • sinyal ("<channelId>" → "sig:<id>"): görüşme katılımcısı kapısı (resolveSignalSide).
//  • canlı-durum dürtüsü ("live:<topic>", v6.28): İÇERİKSİZ "yenile" olayı — free-care'e giriş
//    yapmış herkes (hasta bekleme + doktor konsolu), duty'ye yalnız DOCTOR/ADMIN abone olabilir.
// Yalnız erişebildiği kanala ABONE yetkili kısa token üretir; API anahtarı sunucuda kalır.
// Ably kurulu değilse 503 → istemci sessizce DB-polling yoluna düşer (Ably opsiyonel).
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  const channelId = new URL(req.url).searchParams.get("channel");
  if (!channelId) return NextResponse.json({ error: "Kanal gerekli." }, { status: 400 });

  let channelName: string;
  if (channelId.startsWith("live:")) {
    const allowed =
      channelId === "live:free-care" ||
      (channelId === "live:duty" && ["DOCTOR", "ADMIN"].includes(user.role));
    if (!allowed) return NextResponse.json({ error: "Bu kanala erişim yetkiniz yok." }, { status: 403 });
    channelName = channelId;
  } else {
    const side = await resolveSignalSide(user, channelId);
    if (!side) return NextResponse.json({ error: "Bu görüşmeye erişim yetkiniz yok." }, { status: 403 });
    channelName = signalChannel(channelId);
  }

  if (!ablyConfigured()) return NextResponse.json({ error: "Realtime devre dışı." }, { status: 503 });

  const tokenRequest = await createAblyTokenRequest(user.id, channelName);
  if (!tokenRequest) return NextResponse.json({ error: "Realtime devre dışı." }, { status: 503 });
  return NextResponse.json(tokenRequest);
}
