import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { recordConsent } from "@/lib/consent";
import { AI_INTERPRET_SCOPE, AI_INTERPRET_VERSION, AI_INTERPRET_TEXT } from "@/lib/ai-consent";
import { consentLangParam } from "@/lib/consent-lang";

export const dynamic = "force-dynamic";

// Simültane tercüme AÇIK RIZASINI (AI_INTERPRET v2, A04-c) kaydet — dijital bekleme odasında, canlı görüşmeden önce
// ve YALNIZ görüşme dilleri farklıysa (R4; "tercümesiz devam" seçeneği rıza kaydı YAZMAZ — lobi sessionStorage).
// AI_TRIAGE ve GENERAL_KVKK'dan ayrı kova; oturum (cv) DEĞİŞTİRİLMEZ. v6.269: gövde `lang` (tr/en) — hash'lenen metin
// kapıda GÖSTERİLEN dilin metnidir. Idempotent; yalnız kendi rızasını yazar (BOLA yok). Geri alma: Hesabım.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const lang = consentLangParam(body?.lang);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = req.headers.get("user-agent")?.slice(0, 400) || null;
  await recordConsent(user.id, ip, userAgent, {
    scope: AI_INTERPRET_SCOPE,
    version: AI_INTERPRET_VERSION,
    text: AI_INTERPRET_TEXT[lang],
  });

  return NextResponse.json({ ok: true });
}
