import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { recordConsent } from "@/lib/consent";
import { AI_CONSENT_SCOPE, AI_CONSENT_VERSION, AI_TRIAGE_TEXT } from "@/lib/ai-consent";
import { consentLangParam } from "@/lib/consent-lang";

export const dynamic = "force-dynamic";

// Yapay zekâ işleme AÇIK RIZASINI (AI_TRIAGE v2, A04-b) kaydet — semptom/tanı girişinden önce hasta onayı.
// GENERAL_KVKK'dan ayrı kova; oturum (cv) DEĞİŞTİRİLMEZ (AI rızası JWT'de taşınmaz — DB kaydı + ispat zinciri yeter).
// v6.269: gövde `lang` (tr/en) — hash'lenen metin kapıda GÖSTERİLEN dilin metnidir (ekran = hash, dil başına).
// Idempotent: aynı hasta/sürüm için tekrar çağrı no-op. Yalnız kendi rızasını yazar (BOLA yok). Geri alma: Hesabım.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const lang = consentLangParam(body?.lang);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = req.headers.get("user-agent")?.slice(0, 400) || null;
  await recordConsent(user.id, ip, userAgent, {
    scope: AI_CONSENT_SCOPE,
    version: AI_CONSENT_VERSION,
    text: AI_TRIAGE_TEXT[lang],
  });

  return NextResponse.json({ ok: true });
}
