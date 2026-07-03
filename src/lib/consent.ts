// KVKK/açık onam — sunucu tarafı (Node, Prisma). Edge-safe sabitler ayrı (consent-config).
// v2: her onam kaydı ispat & bütünlük katmanı taşır — onaylanan metnin hash'i + cihaz + append-only
// hash-zinciri + (test) RFC 3161 zaman damgası → "kim, hangi metnin kaçıncı sürümünü, ne zaman, hangi
// cihazla onayladı" bağımsız ispatlanabilir + sonradan değiştirilmediği gösterilebilir.
import { db } from "./db";
import { CONSENT_SCOPE, CONSENT_VERSION, CONSENT_TEXT } from "./consent-config";
import {
  sha256, getTimestampToken, verifyTimestampToken, chainSeal, verifyChainSeal, isV2Seal,
} from "./timestamp";

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

// ── Mühür şeması (audit.ts ile aynı desen, P1 #8) ────────────────────────────────────────────────
// v1 (tarihî): anahtarsız sha256 + pipe-join → yalnız eski kayıtların doğrulanmasında.
// v2: TSA_SECRET'lı HMAC (timestamp.chainSeal, "v2:<kid>:<mac>") + kanonik JSON. Şema değişikliği YOK.
// Downgrade tespiti zaman-pini ile DEĞİL, zincir yürüyüş-sırası kuralıyladır (verifyConsentChain) —
// tehdit modeli sınırları için audit.ts başlığındaki nota bak (aynı sınırlar burada da geçerli).
const CONSENT_SEAL_DOMAIN = "consent-entry";

interface ConsentSealFields {
  userId: string; scope: string; version: number; textHash: string;
  ip: string | null; userAgent: string | null; grantedAt: Date; prevHash: string;
}

function v2Canonical(f: ConsentSealFields): string {
  return JSON.stringify([
    f.userId, f.scope, f.version, f.textHash, f.ip, f.userAgent, f.grantedAt.toISOString(), f.prevHash,
  ]);
}

function sealEntryV2(f: ConsentSealFields): string {
  return chainSeal(CONSENT_SEAL_DOMAIN, v2Canonical(f));
}

// v1 mührü (yalnız TARİHÎ kayıtların doğrulanması için — yeni yazım daima v2).
function computeLegacyEntryHash(f: ConsentSealFields): string {
  return sha256([
    f.userId, f.scope, String(f.version), f.textHash,
    f.ip ?? "", f.userAgent ?? "", f.grantedAt.toISOString(), f.prevHash,
  ].join("|"));
}

// Mühür kararı: true/false kesin; null = başka ortamın anahtarı (unknown-key — bozukluk kanıtı değil).
// v1 satır-yerel olarak yalnız legacy formülle denetlenir; downgrade tespiti verifyConsentChain'in işi.
function sealVerdict(f: ConsentSealFields, entryHash: string): boolean | null {
  if (isV2Seal(entryHash)) {
    const check = verifyChainSeal(CONSENT_SEAL_DOMAIN, v2Canonical(f), entryHash);
    return check === "valid" ? true : check === "broken" ? false : null;
  }
  return computeLegacyEntryHash(f) === entryHash;
}

// Küresel advisory-lock anahtarı (sabit, 2×int4) — TÜM onam append'lerini tek sıraya dizer
// (audit.ts CHAIN_LOCK deseni: eşzamanlı onamlarda tip-okuması yarışıp zincir ÇATALLANMASIN).
const CONSENT_LOCK_A = 0x434f; // 'CO'
const CONSENT_LOCK_B = 0x4e53; // 'NS'

// Güncel sürümde onam kaydı oluştur (idempotent — aynı kullanıcı/kapsam/sürüm bir kez).
// İlk kez ise: metin hash'i + cihaz + hash-zinciri + zaman damgasıyla MÜHÜRLENİR.
// Append, advisory xact-lock altında tek transaction'da: tip okuması + insert atomik sıraya girer.
export async function recordConsent(userId: string, ip?: string | null, userAgent?: string | null): Promise<void> {
  const existing = await db.consentRecord.findUnique({
    where: { userId_scope_version: { userId, scope: CONSENT_SCOPE, version: CONSENT_VERSION } },
    select: { id: true },
  });
  if (existing) return; // idempotent — zaten onaylı

  const textHash = sha256(CONSENT_TEXT);
  try {
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CONSENT_LOCK_A}::int4, ${CONSENT_LOCK_B}::int4)`;
      const grantedAt = new Date(); // kilit içinde → insert sırası = grantedAt sırası (audit deseni)
      // Zincirin ucu: mühürlü (entryHash'li) en güncel kayıt. Yoksa GENESIS.
      const tip = await tx.consentRecord.findFirst({
        where: { entryHash: { not: null } },
        orderBy: [{ grantedAt: "desc" }, { id: "desc" }],
        select: { entryHash: true },
      });
      const prevHash = tip?.entryHash ?? "GENESIS";
      const entryHash = sealEntryV2({ userId, scope: CONSENT_SCOPE, version: CONSENT_VERSION, textHash, ip: ip ?? null, userAgent: userAgent ?? null, grantedAt, prevHash });
      const ts = getTimestampToken(entryHash);
      await tx.consentRecord.create({
        data: {
          userId, scope: CONSENT_SCOPE, version: CONSENT_VERSION, grantedAt, ip: ip ?? null,
          textHash, userAgent: userAgent ?? null, channel: "WEB",
          prevHash, entryHash, tsAuthority: ts.authority, tsTime: ts.time, tsToken: ts.token,
        },
      });
    });
  } catch {
    // unique ihlali (yarış) → başka istek aynı sürümü kaydetti, yoksay (idempotent).
  }
}

// Onam zinciri küresel bütünlüğü (denetçi) — audit verifyAccessChain ile aynı kurallar:
// bağ + mühür + yürüyüş-sırası downgrade kuralı + görünürlük sayaçları.
export async function verifyConsentChain(): Promise<{
  ok: boolean; count: number; brokenAt: string | null;
  unverifiableSeals: number; v1Count: number; v2Count: number; unsealedCount: number;
}> {
  const [rows, unsealedCount] = await Promise.all([
    db.consentRecord.findMany({
      where: { entryHash: { not: null } },
      orderBy: [{ grantedAt: "asc" }, { id: "asc" }],
    }),
    db.consentRecord.count({ where: { entryHash: null } }),
  ]);
  let prev = "GENESIS";
  let unverifiableSeals = 0;
  let v1Count = 0;
  let v2Count = 0;
  let sawV2 = false;
  const fail = (id: string) => ({ ok: false, count: rows.length, brokenAt: id, unverifiableSeals, v1Count, v2Count, unsealedCount });
  for (const r of rows) {
    if (r.prevHash !== prev) return fail(r.id);
    if (isV2Seal(r.entryHash)) {
      v2Count++;
      sawV2 = true;
    } else {
      v1Count++;
      if (sawV2) return fail(r.id); // downgrade: v2 çağından sonra anahtarsız v1 mühür
    }
    if (!r.textHash) return fail(r.id); // mühürlü kayıtta metin hash'i olmak zorunda
    const verdict = sealVerdict({
      userId: r.userId, scope: r.scope, version: r.version, textHash: r.textHash,
      ip: r.ip, userAgent: r.userAgent, grantedAt: r.grantedAt, prevHash: prev,
    }, r.entryHash!);
    if (verdict === false) return fail(r.id);
    if (verdict === null) unverifiableSeals++;
    prev = r.entryHash!;
  }
  return { ok: true, count: rows.length, brokenAt: null, unverifiableSeals, v1Count, v2Count, unsealedCount };
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
  if (hasProofLayer && rec.entryHash && rec.textHash && rec.prevHash) {
    entryHashValid = sealVerdict({
      userId: rec.userId, scope: rec.scope, version: rec.version, textHash: rec.textHash,
      ip: rec.ip, userAgent: rec.userAgent, grantedAt: rec.grantedAt, prevHash: rec.prevHash,
    }, rec.entryHash);
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
