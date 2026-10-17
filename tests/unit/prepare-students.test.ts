import { beforeEach, describe, expect, it, vi } from "vitest";
import { callRules, programHtml } from "./student-fixture";
const mocks = vi.hoisted(() => ({ slot: vi.fn(), previous: vi.fn(), pool: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { contentPlanItem: { findUnique: mocks.slot, findMany: mocks.previous }, eduOpportunity: { findMany: mocks.pool }, $transaction: mocks.transaction } }));
import { nextStudentSlot, prepareStudentDraft } from "@/lib/social-calendar/prepare-students";
import { TUBITAK_2209A_URL } from "@/lib/social-calendar/student-evidence";
import { parsePayload } from "@/lib/social-calendar/payload";
const now = new Date("2026-10-17T12:00Z");
const page = vi.fn(); const pdf = vi.fn(); const readers = { page, pdf };
const opportunity = { id: "edu1", title: "TÜBİTAK 2209-A", sourceUrl: TUBITAK_2209A_URL, approvedAt: now, updatedAt: now,
  deadline: new Date("2025-01-01"), eligibility: "old eligibility must not be copied", deadlineNote: "2026 çağrısı henüz duyurulmadı" };
beforeEach(() => {
  vi.resetAllMocks(); mocks.slot.mockResolvedValue(null); mocks.previous.mockResolvedValue([]); mocks.pool.mockResolvedValue([opportunity]);
  mocks.count.mockResolvedValue(1); mocks.create.mockResolvedValue({ id: "draft" }); mocks.update.mockResolvedValue({ count: 1 });
  mocks.transaction.mockImplementation(async (fn) => fn({ eduOpportunity: { count: mocks.count }, contentPlanItem: { create: mocks.create, updateMany: mocks.update } }));
  page.mockResolvedValue(programHtml()); pdf.mockResolvedValue({ text: callRules(), hash: "a".repeat(64) });
});

describe("student automatic DRAFT preparation", () => {
  it("uses the next strictly future Friday and never backfills the requested 16 October slot", () => {
    expect(nextStudentSlot("2026-10-17")).toBe("2026-10-23");
    expect(nextStudentSlot("2026-10-23")).toBe("2026-10-30");
    expect(nextStudentSlot("2026-10-22")).toBe("2026-10-23");
  });
  it("writes DRAFT only using fresh primary evidence and keeps the opportunity source untouched", async () => {
    expect(await prepareStudentDraft(now, readers)).toMatchObject({ status: "created", slotDay: "2026-10-23" });
    const data = mocks.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({ seriesKey: "ogrenci-kosesi", sourceKind: "kariyer-edu", status: "DRAFT", approvedAt: null, approvedById: null, approvedHash: null, attestIdentity: false });
    expect(data.publishedAt).toBeUndefined();
    const p = parsePayload(data.payload)!;
    expect(p.meta?.preparation).toMatchObject({ callKey: "tubitak-2209a:2026", deadlineAt: "2026-11-11T17:30:00+03:00" });
    expect(p.meta?.preparation?.sources).toHaveLength(2);
    expect(data.payload).not.toContain("old eligibility"); expect(data.payload).not.toContain("henüz duyurulmadı");
    expect(mocks.count.mock.calls[0]![0].where).toEqual({ id: "edu1", updatedAt: now, approvedAt: { not: null } });
    expect(page).toHaveBeenCalledTimes(1); expect(pdf).toHaveBeenCalledTimes(1);
  });
  it.each(["DRAFT", "APPROVED", "PUBLISHING", "PUBLISHED", "FAILED", "SKIPPED"])("preserves editor/terminal %s without source fetch", async (status) => {
    mocks.slot.mockResolvedValue({ id: "existing", status, payload: null });
    expect((await prepareStudentDraft(now, readers)).status).toBe("preserved");
    expect(page).not.toHaveBeenCalled(); expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("preserves a filled PLANNED slot and stops a concurrent editor change or source unapproval", async () => {
    mocks.slot.mockResolvedValue({ id: "existing", status: "PLANNED", payload: "{}", updatedAt: now });
    expect((await prepareStudentDraft(now, readers)).status).toBe("preserved");
    mocks.slot.mockResolvedValue({ id: "existing", status: "PLANNED", payload: null, updatedAt: now }); mocks.update.mockResolvedValue({ count: 0 });
    expect((await prepareStudentDraft(now, readers)).status).toBe("conflict");
    expect(mocks.update.mock.calls[0]![0].where).toMatchObject({ status: "PLANNED", payload: null, updatedAt: now });
    mocks.count.mockResolvedValue(0); mocks.update.mockClear();
    expect((await prepareStudentDraft(now, readers)).status).toBe("conflict"); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("does not repeat the current call across weeks but allows a genuinely new annual call", async () => {
    await prepareStudentDraft(now, readers);
    const payload = mocks.create.mock.calls[0]![0].data.payload;
    mocks.previous.mockResolvedValue([{ sourceIds: '["edu1"]', payload }]);
    expect((await prepareStudentDraft(new Date("2026-10-24T12:00Z"), readers)).reasons).toContain("student-call-already-used");
    page.mockResolvedValue(programHtml("2027")); pdf.mockResolvedValue({ text: callRules("2027"), hash: "b".repeat(64) });
    expect((await prepareStudentDraft(new Date("2027-10-17T12:00Z"), readers)).status).toBe("created");
  });
  it("blocks legacy duplicate IDs/official source URLs and collapses duplicate pool entries", async () => {
    mocks.previous.mockResolvedValue([{ sourceIds: '["edu1"]', payload: null }]);
    expect((await prepareStudentDraft(now, readers)).status).toBe("blocked"); expect(pdf).not.toHaveBeenCalled();
    mocks.previous.mockResolvedValue([{ sourceIds: "[]", payload: JSON.stringify({ slides: [], caption: "", sources: [{ label: "official", ref: "https://tubitak.gov.tr/en/scholarships/degree-associate-degree/destek-programlari/2209-research-project-support-programme-undergraduate-students?utm_source=legacy" }] }) }]);
    expect((await prepareStudentDraft(now, readers)).reasons).toContain("student-call-already-used");
    mocks.previous.mockResolvedValue([]); mocks.pool.mockResolvedValue([opportunity, { ...opportunity, id: "duplicate" }]); page.mockClear();
    await prepareStudentDraft(now, readers); expect(page).toHaveBeenCalledTimes(1);
  });
  it("clearly blocks unsupported sources, closed/missing dates, failed fetch and conflicting adviser cutoff", async () => {
    mocks.pool.mockResolvedValue([{ ...opportunity, sourceUrl: "https://example.org" }]);
    expect((await prepareStudentDraft(now, readers)).reasons).toContain("no-approved-supported-student-source");
    mocks.pool.mockResolvedValue([opportunity]); page.mockRejectedValue(new Error("private details"));
    expect((await prepareStudentDraft(now, readers)).reasons).toEqual(["student-primary-fetch-failed"]);
    page.mockResolvedValue("no date"); expect((await prepareStudentDraft(now, readers)).status).toBe("blocked");
    page.mockResolvedValue(programHtml()); pdf.mockResolvedValue({ text: callRules("2026", "17.00"), hash: "a".repeat(64) });
    expect((await prepareStudentDraft(now, readers)).reasons).toEqual(["primary-deadline-time-conflict"]);
    pdf.mockRejectedValue(new Error("private pdf details"));
    expect((await prepareStudentDraft(now, readers)).reasons).toEqual(["student-primary-pdf-failed"]);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("classifies duplicate inserts but propagates unexpected DB errors for the cron to report", async () => {
    mocks.create.mockRejectedValue({ code: "P2002" }); expect((await prepareStudentDraft(now, readers)).status).toBe("conflict");
    mocks.create.mockRejectedValue(new Error("db unavailable")); await expect(prepareStudentDraft(now, readers)).rejects.toThrow("db unavailable");
  });
});
