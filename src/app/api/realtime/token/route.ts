import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

// Gemini Live (gerçek zamanlı ses→ses çeviri) için ephemeral (kısa ömürlü) token üretici.
// Mimari: ham GEMINI_API_KEY sunucuda kalır; tarayıcı yalnız kısa ömürlü token'la Gemini'ye
// WebSocket açar (Google'ın üretim için önerdiği yöntem). Anahtar yoksa özellik sessizce kapalı.
//
// İSKELET AŞAMASI: token üretimi + durum hazır. Tarayıcı ses akışı (mic→Gemini→hoparlör)
// kullanıcı onayından sonraki adımda LiveInterpreter bileşenine eklenecek.

export const LIVE_TRANSLATE_MODEL = "gemini-3.5-live-translate-preview";

function enabled(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

// GET /api/realtime/token — özellik aktif mi (istemci durumu yoklamak için)
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  return NextResponse.json({ enabled: enabled(), model: LIVE_TRANSLATE_MODEL });
}

// POST /api/realtime/token — oturum için ephemeral token mint eder
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  if (!enabled()) {
    return NextResponse.json({ enabled: false, error: "Canlı tercüme devre dışı: GEMINI_API_KEY tanımlı değil." }, { status: 503 });
  }

  try {
    const { GoogleGenAI, Modality } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

    // Token'ı tek oturumla ve bu modelle sınırla; 30 dk geçerli, yeni oturum 2 dk içinde başlamalı.
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
        liveConnectConstraints: {
          model: LIVE_TRANSLATE_MODEL,
          config: { responseModalities: [Modality.AUDIO] },
        },
      },
    });

    return NextResponse.json({ enabled: true, model: LIVE_TRANSLATE_MODEL, token: token.name }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ enabled: true, error: e instanceof Error ? e.message : "Token üretilemedi" }, { status: 502 });
  }
}
