import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { encryptField } from "@/lib/crypto";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { recordAccess, reqMeta } from "@/lib/audit";
import { HEALTH_CHRONIC_OPTIONS, computeHealthRiskMult, type HealthDeclaration } from "@/lib/pricing";

// POST /api/cases/:id/health-declaration — hasta, paket ekranından sağlık beyanı verir/günceller
// (sigorta risk formu, 2026-07-20). Beyan endikatif prim çarpanına girer (computeHealthRiskMult).
// HASTA-ONLY + kendi vakası (BOLA): beyan hastanın beyanıdır, personel dolduramaz.
// Özel nitelikli sağlık verisi → at-rest ŞİFRELİ (encryptField); audit detail'inde beyan İÇERİĞİ ASLA yer almaz.
// Vaka kopyası prim denetlenebilirliği için SABİT kalır; User.patientHealthHistory profil hafızasına
// yaz-geri edilir (sonraki vakada prefill — "bir kez sor, her yerde kullan").
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.role !== "PATIENT") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const rl = await rateLimit(`health-decl:${user.id}`, 10, 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  const c = await db.case.findUnique({
    where: { id },
    select: { id: true, userId: true, deletionLockedAt: true },
  });
  if (!c || c.userId !== user.id || c.deletionLockedAt) {
    return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });
  }

  const b = await req.json().catch(() => ({}));
  // Sunucu-taraflı doğrulama: kronik listesi yalnız bilinen sözlükten (serbest metin girmez), tekrarsız.
  const chronic = Array.isArray(b.chronic)
    ? [...new Set((b.chronic as unknown[]).filter((x): x is string => typeof x === "string" && (HEALTH_CHRONIC_OPTIONS as readonly string[]).includes(x)))]
    : [];
  const decl: HealthDeclaration = { chronic, meds: !!b.meds, smoking: !!b.smoking, majorSurgery: !!b.majorSurgery };
  const json = JSON.stringify(decl);
  const now = new Date();

  await db.case.update({ where: { id: c.id }, data: { healthDeclaration: encryptField(json), healthDeclaredAt: now } });
  await db.user.update({ where: { id: user.id }, data: { patientHealthHistory: encryptField(json) } });

  await recordAccess({
    actor: user, action: "HEALTH_DECLARATION", resourceType: "CASE", resourceId: c.id, subjectUserId: c.userId,
    detail: "Hasta sağlık beyanı verdi/güncelledi (sigorta risk formu)", ...reqMeta(req),
  });

  return NextResponse.json({ ok: true, declaredAt: now.toISOString(), healthMult: computeHealthRiskMult(decl) });
}
