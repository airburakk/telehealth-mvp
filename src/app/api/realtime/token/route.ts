import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

// Gemini Live (gerçek zamanlı ses→ses çeviri) için ephemeral (kısa ömürlü) token üretici.
// Mimari: ham GEMINI_API_KEY sunucuda kalır; tarayıcı yalnız kısa ömürlü token'la Gemini'ye
// WebSocket açar (Google'ın üretim için önerdiği yöntem). Anahtar yoksa özellik sessizce kapalı.
//
// Tek-sıçrama mimarisi (feat/tercuman-tek-sicrama): KONUŞAN kendi mikrofonunu KARŞININ diline
// çevirtir (targetLang = karşının dili); çeviri sesi WebRTC replaceTrack ile karşıya gider.

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
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  if (!enabled()) {
    return NextResponse.json({ enabled: false, error: "Canlı tercüme devre dışı: GEMINI_API_KEY tanımlı değil." }, { status: 503 });
  }

  // Çeviri HEDEF dili (BCP-47 kısa kod: "tr","ru","de"…). KRİTİK düzeltme: hedef, token'ın
  // liveConnectConstraints'ine KİLİTLENİR. Yalnız istemci config'indeki translationConfig
  // uygulanmıyordu → model varsayılan "en"e (İngilizce) düşüyordu (RU→EN bug'ı).
  // Hedefi token'a kilitlemek Google'ın çeviri için önerdiği güvenli kalıptır.
  const body = await req.json().catch(() => ({}));
  const raw = String(body?.targetLang ?? "").trim();
  const targetLang = /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(raw) ? raw : "en";

  try {
    const { GoogleGenAI, Modality } = await import("@google/genai");
    // Ephemeral token (authTokens.create) yalnız v1alpha'da; varsayılan v1beta'da uç yok → 404
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY!, httpOptions: { apiVersion: "v1alpha" } });

    // Token'ı tek oturum + bu model + ÇEVİRİ HEDEFİ ile sınırla; 30 dk geçerli, yeni oturum 2 dk içinde.
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
        liveConnectConstraints: {
          model: LIVE_TRANSLATE_MODEL,
          config: {
            responseModalities: [Modality.AUDIO],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            translationConfig: { targetLanguageCode: targetLang, echoTargetLanguage: false },
          },
        },
      },
    });

    return NextResponse.json({ enabled: true, model: LIVE_TRANSLATE_MODEL, token: token.name, targetLang }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ enabled: true, error: e instanceof Error ? e.message : "Token üretilemedi" }, { status: 502 });
  }
}
