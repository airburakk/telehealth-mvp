import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { recordConsent } from "@/lib/consent";
import { AI_INTERPRET_SCOPE, AI_INTERPRET_VERSION, AI_INTERPRET_TEXT } from "@/lib/ai-consent";

export const dynamic = "force-dynamic";

// Simültane tercüme AÇIK RIZASINI (AI_INTERPRET) kaydet — dijital bekleme odasında, canlı görüşmeden
// önce hasta onayı. AI_TRIAGE ve GENERAL_KVKK'dan ayrı kova; oturum (cv) DEĞİŞTİRİLMEZ. Idempotent:
// aynı hasta/sürüm için tekrar çağrı no-op (ilk onayda metin hash'i + zaman damgası + hash-zinciriyle
// mühürlenir). Yalnız kendi rızasını yazar (BOLA yok).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = req.headers.get("user-agent")?.slice(0, 400) || null;
  await recordConsent(user.id, ip, userAgent, {
    scope: AI_INTERPRET_SCOPE,
    version: AI_INTERPRET_VERSION,
    text: AI_INTERPRET_TEXT,
  });

  return NextResponse.json({ ok: true });
}
