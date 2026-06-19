import { NextResponse } from "next/server";
import { getCurrentUser, createSession } from "@/lib/auth";
import { recordConsent } from "@/lib/consent";
import { CONSENT_VERSION } from "@/lib/consent-config";

export const dynamic = "force-dynamic";

// KVKK açık onamı kaydet (sürümlü) + oturumu yeniden imzala (cv güncel) → kullanıcı bir daha sorulmaz.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  await recordConsent(user.id, ip);
  await createSession({ id: user.id, email: user.email, name: user.name, role: user.role, cv: CONSENT_VERSION });

  return NextResponse.json({ ok: true });
}
