import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { recordRevocation, REVOCABLE_SCOPES, type RevocableScope } from "@/lib/aura-consent";
import { consentLangParam } from "@/lib/consent-lang";

export const dynamic = "force-dynamic";

// Açık rıza GERİ ALMA (kod Paket B, v6.269 · 2026-09-13) — Hesabım → "Rızalarım" paneli. Yalnız geri alınabilir kovalar
// (AI_TRIAGE · AI_INTERPRET · HEALTH_DECLARATION); GENERAL_KVKK'nın geri alınması = hesap silme akışı (bu uç değil).
// Geri alma `<KAPSAM>_REVOKE` kovasına sayaç-sürümlü, ispatlı (hash + zincir + zaman damgası) kayıttır; aktiflik kararı
// lib/aura-consent activeConsent (son verme > son geri alma). Yalnız kendi rızasını geri alır (BOLA yok).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });

  const rl = await rateLimit(`consent-revoke:${user.id}`, 10, 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  const body = await req.json().catch(() => ({}));
  const scope = String(body?.scope ?? "");
  if (!(REVOCABLE_SCOPES as readonly string[]).includes(scope)) {
    return NextResponse.json({ error: "Bu kapsam geri alınamaz." }, { status: 400 });
  }
  const lang = consentLangParam(body?.lang);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = req.headers.get("user-agent")?.slice(0, 400) || null;
  await recordRevocation(user.id, scope as RevocableScope, lang, ip, userAgent);

  return NextResponse.json({ ok: true, revokedAt: new Date().toISOString() });
}
