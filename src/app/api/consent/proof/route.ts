import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getConsentProof } from "@/lib/consent";
import { CONSENT_SCOPE } from "@/lib/consent-config";
import { canonicalTextsFor, scopeVersion } from "@/lib/doctorium-consent";
import { consentStatus, REVOCABLE_SCOPES } from "@/lib/aura-consent";

export const dynamic = "force-dynamic";

// GET /api/consent/proof?scope=… — giriş yapan kullanıcının kendi "Onay Kanıtı" (bağımsız doğrulanabilir ispat verisi):
// onaylanan metin sürümü + hash · cihaz · IP · zaman · hash-zinciri mührü · (test) RFC 3161 zaman damgası + doğrulama.
// v6.211: kapsam seçilebilir. v6.269 (kod Paket B): kapsam seti genişledi (AURA_TERMS · STAFF_KVKK · AI_TRIAGE ·
// AI_INTERPRET · HEALTH_DECLARATION · STAFF_APPLICATION_KVKK) ve "metin eşleşmesi" kapsamın TR/EN (personelde ROL
// kesiti) ADAYLARINA göre ölçülür (ekran = hash, dil başına — S4). Geri alınabilir kovalarda geri alma durumu da döner.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  const scope = new URL(req.url).searchParams.get("scope") || CONSENT_SCOPE;
  const canon = canonicalTextsFor(scope, { role: user.role });
  if (!canon) return NextResponse.json({ error: "Bilinmeyen onam kapsamı." }, { status: 400 });
  const proof = await getConsentProof(user.id, { scope, canonicalTexts: canon.texts, currentVersion: canon.version });
  if (!proof) return NextResponse.json({ error: "Onay kaydı bulunamadı." }, { status: 404 });
  const revocable = (REVOCABLE_SCOPES as readonly string[]).includes(scope);
  const status = revocable ? await consentStatus(user.id, scope, scopeVersion(scope)) : null;
  return NextResponse.json({
    ...proof,
    title: canon.title,
    revocable,
    active: status ? status.active : null,
    revokedAt: status?.revokedAt ? status.revokedAt.toISOString() : null,
  });
}
