import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getConsentProof } from "@/lib/consent";
import { CONSENT_SCOPE } from "@/lib/consent-config";
import { canonicalTextFor } from "@/lib/doctorium-consent";

export const dynamic = "force-dynamic";

// GET /api/consent/proof?scope=… — giriş yapan kullanıcının kendi "Onay Kanıtı" (bağımsız doğrulanabilir
// ispat verisi): onaylanan metin sürümü + hash · cihaz · IP · zaman · hash-zinciri mührü · (test) RFC 3161
// zaman damgası + doğrulama. v6.211: kapsam seçilebilir — GENERAL_KVKK (varsayılan) · DOCTORIUM_KVKK ·
// DOCTORIUM_TERMS · DOCTORIUM_DIPLOMA_BEYAN; "metin eşleşmesi" o kapsamın kanonik metnine göre ölçülür
// (ekran = hash kararı burada doğrulanır).
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  const scope = new URL(req.url).searchParams.get("scope") || CONSENT_SCOPE;
  const canon = canonicalTextFor(scope);
  if (!canon) return NextResponse.json({ error: "Bilinmeyen onam kapsamı." }, { status: 400 });
  const proof = await getConsentProof(user.id, { scope, canonicalText: canon.text, currentVersion: canon.version });
  if (!proof) return NextResponse.json({ error: "Onay kaydı bulunamadı." }, { status: 404 });
  return NextResponse.json({ ...proof, title: canon.title });
}
