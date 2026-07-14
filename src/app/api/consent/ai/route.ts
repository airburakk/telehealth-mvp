import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { recordConsent } from "@/lib/consent";
import { AI_CONSENT_SCOPE, AI_CONSENT_VERSION, AI_CONSENT_TEXT } from "@/lib/ai-consent";

export const dynamic = "force-dynamic";

// Yapay zeka işleme AÇIK RIZASINI (AI_TRIAGE) kaydet — semptom/tanı girişinden önce hasta onayı.
// GENERAL_KVKK'dan ayrı kova; oturum (cv) DEĞİŞTİRİLMEZ (AI rızası JWT'de taşınmaz — DB kaydı + ispat
// zinciri yeter). Idempotent: aynı hasta/sürüm için tekrar çağrı no-op (ilk onayda metin hash'i +
// zaman damgası + hash-zinciriyle mühürlenir). Yalnız kendi rızasını yazar (BOLA yok).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = req.headers.get("user-agent")?.slice(0, 400) || null;
  await recordConsent(user.id, ip, userAgent, {
    scope: AI_CONSENT_SCOPE,
    version: AI_CONSENT_VERSION,
    text: AI_CONSENT_TEXT,
  });

  return NextResponse.json({ ok: true });
}
