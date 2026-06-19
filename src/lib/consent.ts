// KVKK/açık onam — sunucu tarafı (Node, Prisma). Edge-safe sabitler ayrı (consent-config).
import { db } from "./db";
import { CONSENT_SCOPE, CONSENT_VERSION } from "./consent-config";

// Kullanıcının verdiği EN GÜNCEL onam sürümü (0 = hiç onam yok).
export async function consentedVersion(userId: string): Promise<number> {
  const row = await db.consentRecord.findFirst({
    where: { userId, scope: CONSENT_SCOPE },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  return row?.version ?? 0;
}

export async function hasCurrentConsent(userId: string): Promise<boolean> {
  return (await consentedVersion(userId)) >= CONSENT_VERSION;
}

// Güncel sürümde onam kaydı oluştur (idempotent — aynı kullanıcı/kapsam/sürüm bir kez).
export async function recordConsent(userId: string, ip?: string | null): Promise<void> {
  await db.consentRecord.upsert({
    where: { userId_scope_version: { userId, scope: CONSENT_SCOPE, version: CONSENT_VERSION } },
    update: {},
    create: { userId, scope: CONSENT_SCOPE, version: CONSENT_VERSION, ip: ip ?? null },
  });
}
