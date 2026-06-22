import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getConsentProof } from "@/lib/consent";

export const dynamic = "force-dynamic";

// GET /api/consent/proof — giriş yapan kullanıcının kendi "Onay Kanıtı" (bağımsız doğrulanabilir ispat verisi):
// onaylanan metin sürümü + hash · cihaz · IP · zaman · hash-zinciri mührü · (test) RFC 3161 zaman damgası + doğrulama.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  const proof = await getConsentProof(user.id);
  if (!proof) return NextResponse.json({ error: "Onay kaydı bulunamadı." }, { status: 404 });
  return NextResponse.json(proof);
}
