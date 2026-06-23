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
  | "DOCUMENT_VIEW";

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

// Bir erişimi mühürleyip kaydet. FAIL-SAFE — hata olursa yutulur (asıl istek etkilenmez).
// Zincir: global (GENESIS→…); ucu = en güncel mühürlü kayıt. ⚠️ Eşzamanlı yazımda çatallanma olabilir
// (demo'da nadir; üretim serialization = lock/queue PARK).
export async function recordAccess(input: RecordInput): Promise<void> {
  try {
    const createdAt = new Date();
    const tip = await db.accessLog.findFirst({
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
    await db.accessLog.create({
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

// Bir veri-sahibi hastanın erişim kaydı — "verime kim, ne zaman, neye erişti" + giriş-başına doğrulama.
export async function getAccessLog(subjectUserId: string, viewerId?: string): Promise<AccessLogEntry[]> {
  const rows = await db.accessLog.findMany({
    where: { subjectUserId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return rows.map((r) => {
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
    return {
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
      verification: { entryHashValid, timestampValid },
    };
  });
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
