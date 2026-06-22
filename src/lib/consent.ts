// KVKK/açık onam — sunucu tarafı (Node, Prisma). Edge-safe sabitler ayrı (consent-config).
// v2: her onam kaydı ispat & bütünlük katmanı taşır — onaylanan metnin hash'i + cihaz + append-only
// hash-zinciri + (test) RFC 3161 zaman damgası → "kim, hangi metnin kaçıncı sürümünü, ne zaman, hangi
// cihazla onayladı" bağımsız ispatlanabilir + sonradan değiştirilmediği gösterilebilir.
import { db } from "./db";
import { CONSENT_SCOPE, CONSENT_VERSION, CONSENT_TEXT } from "./consent-config";
import { sha256, getTimestampToken, verifyTimestampToken } from "./timestamp";

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

// entryHash kaydın mührü: alanlarından deterministik türetilir (hem yazarken hem doğrularken aynı düzen).
function computeEntryHash(f: {
  userId: string; scope: string; version: number; textHash: string;
  ip: string | null; userAgent: string | null; grantedAt: Date; prevHash: string;
}): string {
  return sha256([
    f.userId, f.scope, String(f.version), f.textHash,
    f.ip ?? "", f.userAgent ?? "", f.grantedAt.toISOString(), f.prevHash,
  ].join("|"));
}

// Güncel sürümde onam kaydı oluştur (idempotent — aynı kullanıcı/kapsam/sürüm bir kez).
// İlk kez ise: metin hash'i + cihaz + hash-zinciri + zaman damgasıyla MÜHÜRLENİR.
export async function recordConsent(userId: string, ip?: string | null, userAgent?: string | null): Promise<void> {
  const existing = await db.consentRecord.findUnique({
    where: { userId_scope_version: { userId, scope: CONSENT_SCOPE, version: CONSENT_VERSION } },
    select: { id: true },
  });
  if (existing) return; // idempotent — zaten onaylı

  const textHash = sha256(CONSENT_TEXT);
  const grantedAt = new Date();
  // Zincirin ucu: mühürlü (entryHash'li) en güncel kayıt. Yoksa GENESIS.
  const tip = await db.consentRecord.findFirst({
    where: { entryHash: { not: null } },
    orderBy: [{ grantedAt: "desc" }, { id: "desc" }],
    select: { entryHash: true },
  });
  const prevHash = tip?.entryHash ?? "GENESIS";
  const entryHash = computeEntryHash({ userId, scope: CONSENT_SCOPE, version: CONSENT_VERSION, textHash, ip: ip ?? null, userAgent: userAgent ?? null, grantedAt, prevHash });
  const ts = getTimestampToken(entryHash);

  try {
    await db.consentRecord.create({
      data: {
        userId, scope: CONSENT_SCOPE, version: CONSENT_VERSION, grantedAt, ip: ip ?? null,
        textHash, userAgent: userAgent ?? null, channel: "WEB",
        prevHash, entryHash, tsAuthority: ts.authority, tsTime: ts.time, tsToken: ts.token,
      },
    });
  } catch {
    // unique ihlali (yarış) → başka istek aynı sürümü kaydetti, yoksay (idempotent).
  }
}

export interface ConsentProof {
  userId: string;
  scope: string;
  version: number;
  currentVersion: number;
  grantedAt: string;
  ip: string | null;
  userAgent: string | null;
  channel: string;
  textHash: string | null;
  canonicalTextHash: string; // mevcut sürüm metninin hash'i (eşleşme kontrolü)
  prevHash: string | null;
  entryHash: string | null;
  tsAuthority: string | null;
  tsTime: string | null;
  tsToken: string | null;
  verification: {
    hasProofLayer: boolean; // v2+ mühürlü kayıt mı (eski v1 kayıtlarda null)
    entryHashValid: boolean | null; // kayıt alanlarından yeniden hesaplanan mühür eşleşiyor mu
    timestampValid: boolean | null; // zaman damgası token'ı geçerli mi
    textHashMatches: boolean | null; // onaylanan metin, mevcut kanonik metinle aynı mı (sürüm aynıysa)
  };
}

// Kullanıcının en güncel onam kaydı için "Onay Kanıtı" — bağımsız doğrulanabilir ispat verisi.
export async function getConsentProof(userId: string): Promise<ConsentProof | null> {
  const rec = await db.consentRecord.findFirst({
    where: { userId, scope: CONSENT_SCOPE },
    orderBy: { version: "desc" },
  });
  if (!rec) return null;

  const canonicalTextHash = sha256(CONSENT_TEXT);
  const hasProofLayer = !!rec.entryHash;

  let entryHashValid: boolean | null = null;
  if (hasProofLayer && rec.textHash && rec.prevHash) {
    const recomputed = computeEntryHash({
      userId: rec.userId, scope: rec.scope, version: rec.version, textHash: rec.textHash,
      ip: rec.ip, userAgent: rec.userAgent, grantedAt: rec.grantedAt, prevHash: rec.prevHash,
    });
    entryHashValid = recomputed === rec.entryHash;
  }

  const timestampValid = hasProofLayer && rec.entryHash && rec.tsTime && rec.tsToken
    ? verifyTimestampToken(rec.entryHash, rec.tsTime, rec.tsToken)
    : null;

  const textHashMatches = rec.version === CONSENT_VERSION ? rec.textHash === canonicalTextHash : null;

  return {
    userId: rec.userId, scope: rec.scope, version: rec.version, currentVersion: CONSENT_VERSION,
    grantedAt: rec.grantedAt.toISOString(), ip: rec.ip, userAgent: rec.userAgent, channel: rec.channel,
    textHash: rec.textHash, canonicalTextHash, prevHash: rec.prevHash, entryHash: rec.entryHash,
    tsAuthority: rec.tsAuthority, tsTime: rec.tsTime?.toISOString() ?? null, tsToken: rec.tsToken,
    verification: { hasProofLayer, entryHashValid, timestampValid, textHashMatches },
  };
}
