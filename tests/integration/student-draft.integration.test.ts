// Uses only the existing TEST_DATABASE_URL harness. Never falls back to a production connection.
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { nextStudentSlot, prepareStudentDraft } from "@/lib/social-calendar/prepare-students";
import { TUBITAK_2209A_URL } from "@/lib/social-calendar/student-evidence";
import { callRules, programHtml } from "../unit/student-fixture";

describe.skipIf(!process.env.TEST_DATABASE_URL)("student DRAFT database concurrency", () => {
  it("creates at most one future DRAFT and preserves a subsequent editor change", async () => {
    const year = String(8000 + Math.floor(Math.random() * 900));
    const now = new Date(`${year}-10-17T12:00:00Z`);
    const slotDay = nextStudentSlot(`${year}-10-17`);
    // Reserve an unused artificial-future slot; never remove any pre-existing row.
    expect(await db.contentPlanItem.findUnique({ where: { seriesKey_slotDay: { seriesKey: "ogrenci-kosesi", slotDay } } })).toBeNull();
    const id = `000_itest_student_${Date.now()}`;
    const createdIds: string[] = [];
    await db.eduOpportunity.create({ data: { id, kind: "burs", title: "TÜBİTAK 2209-A", organizer: "TÜBİTAK", eligibility: "test-only",
      sourceUrl: TUBITAK_2209A_URL, verifiedAt: new Date(), approvedAt: new Date() } });
    const readers = { page: async () => programHtml(year), pdf: async () => ({ text: callRules(year), hash: "a".repeat(64) }) };
    try {
      const results = await Promise.all([prepareStudentDraft(now, readers), prepareStudentDraft(now, readers)]);
      for (const result of results) if (result.status === "created" && result.itemId) createdIds.push(result.itemId);
      expect(createdIds).toHaveLength(1);
      const row = await db.contentPlanItem.findUniqueOrThrow({ where: { id: createdIds[0] } });
      expect(row.status).toBe("DRAFT"); expect(row.approvedAt).toBeNull(); expect(row.approvedHash).toBeNull(); expect(row.publishedAt).toBeNull();
      await db.contentPlanItem.update({ where: { id: row.id }, data: { payload: '{"editor":"preserve"}' } });
      expect((await prepareStudentDraft(now, readers)).status).toBe("preserved");
      expect((await db.contentPlanItem.findUniqueOrThrow({ where: { id: row.id } })).payload).toBe('{"editor":"preserve"}');
    } finally {
      await db.contentPlanItem.deleteMany({ where: { seriesKey: "ogrenci-kosesi", slotDay, sourceIds: JSON.stringify([id]) } });
      await db.eduOpportunity.delete({ where: { id } });
    }
  });
});
