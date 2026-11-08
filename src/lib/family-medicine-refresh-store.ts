import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import {
  FAMILY_MEDICINE_MONITORED_SOURCES, FAMILY_MEDICINE_REFRESH_RESOURCE, FAMILY_MEDICINE_MAX_SOURCES,
  FAMILY_MEDICINE_SOURCE_GAP_MS, nextFamilyMedicineSourceState, observeFamilyMedicineSource, sourceCheckIsStale,
  type SourceCheckState, type SourceObservation,
} from "./family-medicine-refresh";
import { shouldAlertStreak } from "./ingest-streak";

type SourceClient = Pick<Prisma.TransactionClient, "familyMedicineSourceCheck">;
const sourceKeys = FAMILY_MEDICINE_MONITORED_SOURCES.map(s => s.sourceKey);
const state = (row: { status: string } & Omit<SourceCheckState, "status">): SourceCheckState => ({
  ...row, status: ["baseline", "current", "changed", "unreachable"].includes(row.status) ? row.status as SourceCheckState["status"] : "unreachable",
});

/** Throws on missing schema/DB errors. An unavailable store must not look like a successful check. */
export async function listFamilyMedicineSourceChecks(now = new Date()) {
  const [rows, lastRun] = await Promise.all([
    db.familyMedicineSourceCheck.findMany({ where: { sourceKey: { in: sourceKeys } } }),
    db.accessLog.findFirst({
      where: { action: "CRON_MAINTENANCE", resourceId: FAMILY_MEDICINE_REFRESH_RESOURCE, detail: { startsWith: "sources=" } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { createdAt: true },
    }),
  ]);
  const sources = FAMILY_MEDICINE_MONITORED_SOURCES.map(source => {
    const row = rows.find(r => r.sourceKey === source.sourceKey);
    return {
      ...source, status: row ? state(row).status : "unchecked" as const,
      checkedAt: row?.checkedAt.toISOString() ?? null, lastSuccessAt: row?.lastSuccessAt?.toISOString() ?? null,
      changedAt: row?.changedAt?.toISOString() ?? null, consecutiveFailures: row?.consecutiveFailures ?? 0,
      errorTag: row?.errorTag ?? null, httpStatus: row?.httpStatus ?? null,
      stale: sourceCheckIsStale(row?.lastSuccessAt ?? null, now),
    };
  });
  const lastAttemptAt = rows.reduce<Date | null>((last, row) => !last || row.checkedAt > last ? row.checkedAt : last, null);
  return { sources, lastRunAt: lastRun?.createdAt.toISOString() ?? null, lastAttemptAt: lastAttemptAt?.toISOString() ?? null };
}

/** Bind editorial evidence to exact observed source versions. Accepts the caller's serializable transaction. */
export async function readFamilyMedicineWorkflowSourceState(workflowId: string, now = new Date(), client: SourceClient = db) {
  const sources = FAMILY_MEDICINE_MONITORED_SOURCES.filter(s => s.workflowIds.includes(workflowId));
  if (!sources.length) return { fingerprint: null, blockers: ["Bu başlık için izlenen kaynak bulunamadı."] };
  const rows = await client.familyMedicineSourceCheck.findMany({ where: { sourceKey: { in: sources.map(s => s.sourceKey) } } });
  const blockers: string[] = [];
  for (const source of sources) {
    const row = rows.find(r => r.sourceKey === source.sourceKey);
    if (!row?.contentHash) blockers.push(`${source.title}: ilk teknik kontrol tamamlanmadı.`);
    else if (state(row).status === "unreachable") blockers.push(`${source.title}: son kaynak kontrolünde erişim sağlanamadı.`);
    else if (sourceCheckIsStale(row.lastSuccessAt, now)) blockers.push(`${source.title}: teknik kontrol 72 saatten eski veya tarihi geçersiz.`);
  }
  if (blockers.length) return { fingerprint: null, blockers };
  const versions = sources.map(s => [s.sourceKey, rows.find(r => r.sourceKey === s.sourceKey)!.contentHash]).sort((a, b) => a[0]!.localeCompare(b[0]!));
  return { fingerprint: createHash("sha256").update(JSON.stringify(versions)).digest("hex"), blockers };
}

async function saveObservation(sourceKey: string, observed: SourceObservation) {
  const source = FAMILY_MEDICINE_MONITORED_SOURCES.find(s => s.sourceKey === sourceKey)!;
  // Optimistic compare-and-set avoids overwriting a newer run or losing its changed/failure history.
  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await db.familyMedicineSourceCheck.findUnique({ where: { sourceKey } });
    if (row && row.checkedAt > observed.checkedAt) return { value: state(row), newlyChanged: false, saved: false };
    const previous = row ? state(row) : null;
    const next = nextFamilyMedicineSourceState(previous, observed);
    const data = { url: source.url, ...next };
    if (row) {
      const result = await db.familyMedicineSourceCheck.updateMany({ where: { sourceKey, checkedAt: row.checkedAt, updatedAt: row.updatedAt }, data });
      if (!result.count) continue;
    } else {
      try { await db.familyMedicineSourceCheck.create({ data: { sourceKey, ...data } }); }
      catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue; throw error; }
    }
    return { value: next, newlyChanged: !!observed.contentHash && !observed.errorTag && !!previous?.contentHash && observed.contentHash !== previous.contentHash, saved: true };
  }
  throw new Error("family-medicine-source-write-conflict");
}

export async function refreshFamilyMedicineSources() {
  if (!sourceKeys.length || sourceKeys.length > FAMILY_MEDICINE_MAX_SOURCES) throw new Error("family-medicine-source-budget-exceeded");
  const result = { checked: 0, baseline: 0, current: 0, changed: 0, unreachable: 0, errors: [] as string[], changedSources: [] as string[], failureAlerts: [] as string[] };
  for (const source of FAMILY_MEDICINE_MONITORED_SOURCES) {
    const observation = await observeFamilyMedicineSource(source.sourceKey);
    const { value, newlyChanged, saved } = await saveObservation(source.sourceKey, observation);
    result.checked++;
    result[value.status]++;
    if (value.errorTag) result.errors.push(`${source.sourceKey.slice(0, 12)}:${value.errorTag}`);
    if (newlyChanged) result.changedSources.push(source.title);
    if (saved && value.status === "unreachable" && shouldAlertStreak(value.consecutiveFailures)) result.failureAlerts.push(`${source.title}: ${value.errorTag} (${value.consecutiveFailures})`);
    if (source !== FAMILY_MEDICINE_MONITORED_SOURCES.at(-1)) await new Promise(resolve => setTimeout(resolve, FAMILY_MEDICINE_SOURCE_GAP_MS));
  }
  return result;
}