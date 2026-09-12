import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { recordConsent } from "@/lib/consent";
import { HEALTH_DECLARATION_SCOPE, HEALTH_DECLARATION_VERSION } from "@/lib/aura-consent-texts";
import { HEALTH_DECLARATION_TEXT } from "@/lib/ai-consent";
import { consentLangParam } from "@/lib/consent-lang";

export const dynamic = "force-dynamic";

// Sigorta sağlık beyanı AÇIK RIZASINI (HEALTH_DECLARATION, A04-d) kaydet — /paket hasta görünümünde beyan formu
// açılmadan önce (kod Paket B, v6.269). Yalnız HASTA (beyan hastanın beyanıdır); GENERAL_KVKK'dan ayrı kova; oturum
// (cv) DEĞİŞTİRİLMEZ. Gövde `lang` (tr/en) → hash'lenen metin, ekranda gösterilen dilin metnidir. Idempotent.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
  if (user.role !== "PATIENT") return NextResponse.json({ error: "Sağlık beyanı rızası yalnız hasta hesabı içindir." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const lang = consentLangParam(body?.lang);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = req.headers.get("user-agent")?.slice(0, 400) || null;
  await recordConsent(user.id, ip, userAgent, {
    scope: HEALTH_DECLARATION_SCOPE,
    version: HEALTH_DECLARATION_VERSION,
    text: HEALTH_DECLARATION_TEXT[lang],
  });

  return NextResponse.json({ ok: true });
}
