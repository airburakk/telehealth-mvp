import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { executeEditorial } from "@/lib/family-medicine-editorial";
import { FAMILY_MEDICINE_MONITORED_SOURCES } from "@/lib/family-medicine-refresh";

const enabled = process.env.FAMILY_MEDICINE_DEV_DB_TEST === "1";
const rollback = "ROLLBACK_ISOLATED_FAMILY_MEDICINE_FIXTURE";
const originalTransaction = db.$transaction.bind(db);
const evidence = { sources: [{ url: "https://shgmmevzuatdb.saglik.gov.tr/TR-117242/saglik-raporlari-yonetmeligi-yayimlandi.html", version: "test", locator: "test section", applicability: "Integration fixture only", verifiedOn: "2026-01-01", effectiveFrom: "2026-01-01", effectiveUntil: null }], nextReviewOn: "2099-01-01", sourceGap: null };
let originalRows = 0, originalEvents = 0, originalGrants = 0;
async function fixture(run: (tx: Prisma.TransactionClient, actor: string) => Promise<void>) {
  await expect(originalTransaction(async tx => {
    const actor = `fm-itest-${randomUUID()}`;
    await tx.user.create({ data: { id: actor, name: "Isolated editorial fixture", email: `${actor}@example.invalid`, passwordHash: "NO_LOGIN_FIXTURE", role: "ADMIN" } });
    for (const source of FAMILY_MEDICINE_MONITORED_SOURCES.filter(s => s.workflowIds.includes("driver"))) {
      const data = { url: source.url, status: "current", baselineHash: "fixture-hash", contentHash: "fixture-hash", checkedAt: new Date(), lastSuccessAt: new Date(), consecutiveFailures: 0 };
      await tx.familyMedicineSourceCheck.upsert({ where: { sourceKey: source.sourceKey }, create: { sourceKey: source.sourceKey, ...data }, update: data });
    }
    // Only transaction routing is replaced: all queries, constraints and triggers
    // execute on actual PostgreSQL in this outer SERIALIZABLE transaction.
    const spy = vi.spyOn(db, "$transaction").mockImplementation((async (callback: (client: Prisma.TransactionClient) => Promise<unknown>) => callback(tx)) as typeof db.$transaction);
    try { await run(tx, actor); } finally { spy.mockRestore(); }
    throw new Error(rollback);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 })).rejects.toThrow(rollback);
}
const save = () => ({ action: "save" as const, workflowId: "driver", expectedRevision: 0, evidence });
describe.skipIf(!enabled)("Family medicine actual DEV PostgreSQL (isolated fixtures cleaned)", () => {
  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL || !process.env.PROD_DATABASE_URL) throw new Error("Explicit test target and production comparison required");
    const host = (s: string) => new URL(s).hostname.replace("-pooler", "");
    if (host(process.env.TEST_DATABASE_URL) === host(process.env.PROD_DATABASE_URL)) throw new Error("Refusing production target");
    if (await db.familyMedicineEditorial.findUnique({ where: { workflowId: "driver" } })) throw new Error("Refusing to touch existing driver workflow evidence");
    originalRows = await db.familyMedicineEditorial.count(); originalEvents = await db.familyMedicineEditorialEvent.count(); originalGrants = await db.familyMedicineReviewerGrant.count();
  });
  afterAll(async () => {
    expect(await db.familyMedicineEditorial.count()).toBe(originalRows);
    expect(await db.familyMedicineEditorialEvent.count()).toBe(originalEvents);
    expect(await db.familyMedicineReviewerGrant.count()).toBe(originalGrants);
    expect(await db.user.count({ where: { id: { startsWith: "fm-itest-" } } })).toBe(0);
    await db.$disconnect();
  });
  it("persists evidence and immutable snapshot together, then rolls fixture back", async () => fixture(async (tx, actor) => {
    expect(await executeEditorial(save(), actor)).toEqual({ ok: true, revision: 1 });
    const row = await tx.familyMedicineEditorial.findUniqueOrThrow({ where: { workflowId: "driver" } });
    const event = await tx.familyMedicineEditorialEvent.findUniqueOrThrow({ where: { workflowId_revision: { workflowId: "driver", revision: 1 } } });
    expect(row.sourceFingerprint).toBeTruthy(); expect(event.actorId).toBe(actor); expect(event.snapshotHash).toMatch(/^[a-f0-9]{64}$/);
    await expect(executeEditorial(save(), actor)).rejects.toMatchObject({ status: 409 });
  }));
  for (const action of ["UPDATE", "DELETE", "TRUNCATE"] as const) it(`DB trigger rejects ${action} of ledger`, async () => fixture(async (tx, actor) => {
    await executeEditorial(save(), actor);
    const sql = action === "UPDATE" ? `UPDATE "FamilyMedicineEditorialEvent" SET "action"='save' WHERE "workflowId"='driver'` : action === "DELETE" ? `DELETE FROM "FamilyMedicineEditorialEvent" WHERE "workflowId"='driver'` : `TRUNCATE TABLE "FamilyMedicineEditorialEvent"`;
    await expect(tx.$executeRawUnsafe(sql)).rejects.toThrow(/append-only/);
  }));
  it("a genuine ledger unique violation rolls back the preceding evidence insert", async () => fixture(async (tx, actor) => {
    await tx.familyMedicineEditorialEvent.create({ data: { workflowId: "driver", revision: 1, action: "save", actorId: actor, snapshot: {}, snapshotHash: "fixture" } });
    await expect(executeEditorial(save(), actor)).rejects.toMatchObject({ code: "P2002" });
  }));
  it("requires active grant and invalidates same-URL changed source fingerprint", async () => fixture(async (tx, actor) => {
    await executeEditorial(save(), actor);
    await expect(executeEditorial({ action: "review", workflowId: "driver", expectedRevision: 1, discipline: "clinical" }, actor)).rejects.toMatchObject({ status: 403 });
    await tx.familyMedicineReviewerGrant.create({ data: { userId: actor, discipline: "clinical", qualificationReference: "NON-PERSISTED INTEGRATION FIXTURE", grantedById: actor, expiresAt: new Date("2099-01-01") } });
    await executeEditorial({ action: "review", workflowId: "driver", expectedRevision: 1, discipline: "clinical" }, actor);
    expect((await tx.familyMedicineEditorial.findUniqueOrThrow({ where: { workflowId: "driver" } })).clinicalById).toBe(actor);
    const source = FAMILY_MEDICINE_MONITORED_SOURCES.find(s => s.workflowIds.includes("driver"))!;
    await tx.familyMedicineSourceCheck.update({ where: { sourceKey: source.sourceKey }, data: { contentHash: "changed-fixture-hash", status: "changed" } });
    await expect(executeEditorial({ action: "review", workflowId: "driver", expectedRevision: 2, discipline: "clinical" }, actor)).rejects.toMatchObject({ status: 409 });
  }));
  it("two independent SERIALIZABLE writers cannot both win the same expected revision", async () => {
    const workflowId = "fm-concurrency-" + randomUUID();
    // An isolated non-catalog row, no review/ledger/user records. Removed by exact
    // random primary key in finally; no existing workflow can be touched.
    await db.familyMedicineEditorial.create({ data: { workflowId, catalogHash: "fixture", evidence: {}, revision: 1 } });
    let arrived = 0; let release!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    const writer = () => originalTransaction(async tx => {
      await tx.familyMedicineEditorial.findUniqueOrThrow({ where: { workflowId } });
      arrived++; if (arrived === 2) release(); await barrier;
      return tx.familyMedicineEditorial.updateMany({ where: { workflowId, revision: 1 }, data: { revision: 2 } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 });
    try {
      const results = await Promise.allSettled([writer(), writer()]);
      expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
      expect(results.filter(r => r.status === "rejected")).toHaveLength(1);
      const failed = results.find(r => r.status === "rejected") as PromiseRejectedResult;
      expect(failed.reason.code).toBe("P2034");
      expect((await db.familyMedicineEditorial.findUniqueOrThrow({ where: { workflowId } })).revision).toBe(2);
    } finally { await db.familyMedicineEditorial.delete({ where: { workflowId } }); }
  });
  it("DB current role and revoked grant both fail closed", async () => fixture(async (tx, actor) => {
    await tx.user.update({ where: { id: actor }, data: { role: "DOCTOR" } });
    await expect(executeEditorial(save(), actor)).rejects.toMatchObject({ status: 403 });
    await tx.user.update({ where: { id: actor }, data: { role: "ADMIN" } });
    await executeEditorial(save(), actor);
    await tx.familyMedicineReviewerGrant.create({ data: { userId: actor, discipline: "clinical", qualificationReference: "ROLLBACK FIXTURE", grantedById: actor, expiresAt: new Date("2099-01-01"), revokedAt: new Date() } });
    await expect(executeEditorial({ action: "review", workflowId: "driver", expectedRevision: 1, discipline: "clinical" }, actor)).rejects.toMatchObject({ status: 403 });
  }));
});
