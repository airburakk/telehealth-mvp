// Değiştirilemez erişim denetimi — klinik veriye erişimin mührü (E2EE Faz 0 "audit" ayağı).
// v2.72 onam deseni birebir (consent.ts): append-only hash-zinciri (prevHash→entryHash) + (test) RFC 3161
// zaman damgası (timestamp.ts). "Kim, ne zaman, hangi kaydı okudu/yazdı/dışa aktardı" bağımsız doğrulanabilir
// + sonradan silinmediği/değiştirilmediği gösterilebilir.
//
// recordAccess FAIL-SAFE: audit yazımı patlasa bile ÇAĞIRAN isteği bozmaz (notify.ts deseni) — denetim
// kaydı uygulama işlevinin önüne geçmemeli. Yüksek-frekanslı mekanik olaylar (signal polling, i18n) kasıtlı
// olarak audit edilmez (flood önleme) — yalnız anlamlı klinik erişim mühürlenir.
import { db } from "./db";
import { sha256, getTimestampToken, verifyTimestampToken } from "./timestamp";
import type { SessionUser } from "./session";

export type AuditAction =
  | "CASE_VIEW"
  | "CONSULT_WRITE"
  | "CONSULT_END"
  | "FHIR_EXPORT"
  | "DOCUMENT_VIEW"
  | "CODING_WRITE" // FHIR klinik kodlama (ICD-10 + hasta kimliği) yazıldı
  | "LABS_WRITE" // laboratuvar sonuçları (LOINC) yazıldı
  | "DOCUMENT_ANALYZE" // yüklenen belgeler AI ile değerlendirildi/çevrildi (dış AI'ya gider)
  | "DISCHARGE_GENERATE" // epikriz/taburcu raporu AI ile üretildi (tüm yolculuk dış AI'ya gider)
  | "RECOVERY_COMPLETE" // post-op takip tamamlandı → klinik personel erişimi kapandı, hasta-only (E2EE Faz 2A)
  | "RECOVERY_REOPEN" // post-op takip hasta tarafından yeniden açıldı → klinik personel erişimi geri verildi (geri-alma, E2EE Faz 2A)
  | "POSTOP_ACCESS_DENIED"; // post-op kapandıktan sonra klinik personel erişim denemesi reddedildi (daraltma kanıtı)

interface RecordInput {
  actor: SessionUser | null;
  action: AuditAction | string;
  resourceType: string;
  resourceId: string;
  subjectUserId: string | null;
  detail?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

// İstek başlıklarından IP + cihaz (audit için minimum bağlam).
export function reqMeta(req: Request): { ip: string | null; userAgent: string | null } {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  return { ip, userAgent: req.headers.get("user-agent") };
}

// entryHash: kaydın mührü — alanlarından deterministik türetilir (yazarken ve doğrularken aynı düzen).
function computeEntryHash(f: {
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  subjectUserId: string | null;
  createdAt: Date;
  prevHash: string;
}): string {
  return sha256(
    [
      f.actorId ?? "",
      f.action,
      f.resourceType,
      f.resourceId,
      f.subjectUserId ?? "",
      f.createdAt.toISOString(),
      f.prevHash,
    ].join("|"),
  );
}

// Küresel advisory-lock anahtarı (sabit, 2×int4) — TÜM audit append'lerini tek küresel sıraya dizer.
const CHAIN_LOCK_A = 0x4155; // 'AU'
const CHAIN_LOCK_B = 0x4454; // 'DT'

// Bir erişimi mühürleyip kaydet. FAIL-SAFE — hata olursa yutulur (asıl istek etkilenmez).
// Zincir: global (GENESIS→…); ucu = en güncel mühürlü kayıt.
//
// ÜRETİM SERIALIZATION (inc.2): append, küresel bir advisory **xact**-lock altında tek bir transaction'da
// yapılır → eşzamanlı yazımlar sıraya girer, zincir ÇATALLANMAZ. xact-lock işlem sonunda otomatik bırakılır
// (transaction-pooling/Neon-PgBouncer güvenli; session-lock sızabilirdi). Çok-örnekli Vercel serverless'te
// in-process mutex yetmez (örnekler arası çatal) → kilit DB seviyesinde olmalı.
export async function recordAccess(input: RecordInput): Promise<void> {
  try {
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CHAIN_LOCK_A}::int4, ${CHAIN_LOCK_B}::int4)`;
      // createdAt KİLİT İÇİNDE alınır → insert sırası = createdAt sırası; verify (asc) ile tip (desc) tutarlı,
      // çatal yok. (Aynı-ms artığı id ile çözülür; kilit+RTT döngüsü ms'i pratikte ayırır.)
      const createdAt = new Date();
      const tip = await tx.accessLog.findFirst({
        where: { entryHash: { not: null } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { entryHash: true },
      });
      const prevHash = tip?.entryHash ?? "GENESIS";
      const entryHash = computeEntryHash({
        actorId: input.actor?.id ?? null,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        subjectUserId: input.subjectUserId,
        createdAt,
        prevHash,
      });
      const ts = getTimestampToken(entryHash);
      await tx.accessLog.create({
        data: {
          actorId: input.actor?.id ?? null,
          actorRole: input.actor?.role ?? null,
          action: input.action,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          subjectUserId: input.subjectUserId,
          detail: input.detail ?? null,
          ip: input.ip ?? null,
          userAgent: input.userAgent ?? null,
          createdAt,
          prevHash,
          entryHash,
          tsAuthority: ts.authority,
          tsTime: ts.time,
          tsToken: ts.token,
        },
      });
    });
  } catch (e) {
    // FAIL-SAFE: audit asla çağıran isteği bozmaz (üretimde gözlemlenebilirlik için log'lanır).
    console.error("[audit] recordAccess başarısız (yutuldu):", e);
  }
}

export interface AccessLogEntry {
  id: string;
  actorRole: string | null;
  actorIsYou: boolean; // erişen, kaydı görüntüleyen kullanıcının kendisi mi
  action: string;
  resourceType: string;
  resourceId: string;
  detail: string | null;
  createdAt: string;
  tsAuthority: string | null;
  tsTime: string | null;
  verification: { entryHashValid: boolean | null; timestampValid: boolean | null };
}

// Tek bir kaydın doğrulaması: mührü alanlarından yeniden hesaplanan + zaman damgası geçerli mi?
// (getAccessLog hasta-yüzü + getChainAudit denetçi-yüzü paylaşır.)
type VerifiableRow = {
  actorId: string | null; action: string; resourceType: string; resourceId: string;
  subjectUserId: string | null; createdAt: Date; prevHash: string | null; entryHash: string | null;
  tsTime: Date | null; tsToken: string | null;
};
function verifyRow(r: VerifiableRow): { entryHashValid: boolean | null; timestampValid: boolean | null } {
  let entryHashValid: boolean | null = null;
  if (r.entryHash && r.prevHash) {
    const recomputed = computeEntryHash({
      actorId: r.actorId,
      action: r.action,
      resourceType: r.resourceType,
      resourceId: r.resourceId,
      subjectUserId: r.subjectUserId,
      createdAt: r.createdAt,
      prevHash: r.prevHash,
    });
    entryHashValid = recomputed === r.entryHash;
  }
  const timestampValid =
    r.entryHash && r.tsTime && r.tsToken ? verifyTimestampToken(r.entryHash, r.tsTime, r.tsToken) : null;
  return { entryHashValid, timestampValid };
}

// Bir veri-sahibi hastanın erişim kaydı — "verime kim, ne zaman, neye erişti" + giriş-başına doğrulama.
export async function getAccessLog(subjectUserId: string, viewerId?: string): Promise<AccessLogEntry[]> {
  const rows = await db.accessLog.findMany({
    where: { subjectUserId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return rows.map((r) => ({
    id: r.id,
    actorRole: r.actorRole,
    actorIsYou: !!viewerId && r.actorId === viewerId,
    action: r.action,
    resourceType: r.resourceType,
    resourceId: r.resourceId,
    detail: r.detail,
    createdAt: r.createdAt.toISOString(),
    tsAuthority: r.tsAuthority,
    tsTime: r.tsTime?.toISOString() ?? null,
    verification: verifyRow(r),
  }));
}

// Global zincir bütünlüğü (denetçi) — her kaydın mührü + prevHash bağı tutuyor mu (silme/araya-ekleme tespiti).
// (createdAt+id ile total-order; ardışık yazımda insert sırasını yeniden kurar. Çatallanma = brokenAt.)
export async function verifyAccessChain(): Promise<{ ok: boolean; count: number; brokenAt: string | null }> {
  const rows = await db.accessLog.findMany({
    where: { entryHash: { not: null } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  let prev = "GENESIS";
  for (const r of rows) {
    const expected = computeEntryHash({
      actorId: r.actorId,
      action: r.action,
      resourceType: r.resourceType,
      resourceId: r.resourceId,
      subjectUserId: r.subjectUserId,
      createdAt: r.createdAt,
      prevHash: prev,
    });
    if (r.prevHash !== prev || r.entryHash !== expected) {
      return { ok: false, count: rows.length, brokenAt: r.id };
    }
    prev = r.entryHash!;
  }
  return { ok: true, count: rows.length, brokenAt: null };
}

// Denetçi (ADMIN / Etik Kurul) görünümü için tek bir kayıt — küresel zincirin metadata'sı (klinik içerik YOK).
export interface ChainEntry {
  id: string;
  createdAt: string;
  actorRole: string | null;
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  subjectUserId: string | null;
  detail: string | null;
  ip: string | null;
  prevHash: string | null;
  entryHash: string | null;
  tsAuthority: string | null;
  tsTime: string | null;
  verification: { entryHashValid: boolean | null; timestampValid: boolean | null };
}

// Denetçi tam-zincir görünümü: KÜRESEL bütünlük (tüm zinciri tarar → silme/araya-ekleme/çatal tespiti)
// + en güncel N mühürlü kaydın metadata'sı. Klinik içerik DÖNDÜRMEZ (yalnız kim/ne-zaman/hangi-kayıt).
export async function getChainAudit(limit = 200): Promise<{
  integrity: { ok: boolean; count: number; brokenAt: string | null };
  entries: ChainEntry[];
}> {
  const integrity = await verifyAccessChain();
  const rows = await db.accessLog.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
  });
  const entries: ChainEntry[] = rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    actorRole: r.actorRole,
    actorId: r.actorId,
    action: r.action,
    resourceType: r.resourceType,
    resourceId: r.resourceId,
    subjectUserId: r.subjectUserId,
    detail: r.detail,
    ip: r.ip,
    prevHash: r.prevHash,
    entryHash: r.entryHash,
    tsAuthority: r.tsAuthority,
    tsTime: r.tsTime?.toISOString() ?? null,
    verification: verifyRow(r),
  }));
  return { integrity, entries };
}
