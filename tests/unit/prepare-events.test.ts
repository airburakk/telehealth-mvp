import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  slot: vi.fn(), previous: vi.fn(), pool: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), transaction: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: {
  contentPlanItem: { findUnique: mocks.slot, findMany: mocks.previous },
  medicalCongress: { findMany: mocks.pool }, $transaction: mocks.transaction,
} }));

import { nextEventSlot, prepareEventDraft, sourceKey } from "@/lib/social-calendar/prepare-events";
import { parsePayload } from "@/lib/social-calendar/payload";

const now = new Date("2026-10-17T10:00:00Z");
const event = (id = "e1", url = "https://example.org/event") => ({
  id, url, title: "42. Ulusal Kardiyoloji Kongresi", organizer: null, city: "Antalya", country: "TR", venue: null,
  startDate: new Date("2026-10-30Z"), endDate: new Date("2026-11-03Z"), abstractDeadline: new Date("2026-10-25Z"), earlyBirdDeadline: null,
  eventType: "kongre", scope: "ulusal", ttbCode: null, warning: null, sourceUrls: JSON.stringify([url]), updatedAt: now,
});
const html = "<h1>42. Ulusal Kardiyoloji Kongresi</h1><p>30 Ekim – 3 Kasım 2026 Antalya</p>";
const readPage = vi.fn(async () => html);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.slot.mockResolvedValue(null);
  mocks.previous.mockResolvedValue([]);
  mocks.pool.mockResolvedValue([event()]);
  mocks.count.mockResolvedValue(1);
  mocks.create.mockResolvedValue({ id: "new-draft" });
  mocks.update.mockResolvedValue({ count: 1 });
  mocks.transaction.mockImplementation(async (fn) => fn({ medicalCongress: { count: mocks.count }, contentPlanItem: { create: mocks.create, updateMany: mocks.update } }));
  readPage.mockResolvedValue(html);
});

describe("automatic event drafts", () => {
  it("only targets a future Monday in Turkey; never backfills 12/16 October", () => {
    expect(nextEventSlot("2026-10-17")).toBe("2026-10-19");
    expect(nextEventSlot("2026-10-19")).toBe("2026-10-26");
    expect(nextEventSlot("2026-10-18")).toBe("2026-10-19");
  });
  it("writes DRAFT with provenance, without approval or publication", async () => {
    const result = await prepareEventDraft(now, readPage);
    expect(result).toMatchObject({ status: "created", slotDay: "2026-10-19", checked: 1, itemId: "new-draft" });
    const data = mocks.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({ status: "DRAFT", seriesKey: "etkinlik-radari", approvedAt: null, approvedById: null, approvedBy: null, approvedHash: null, attestIdentity: false });
    expect(data.publishedAt).toBeUndefined();
    const payload = parsePayload(data.payload)!;
    expect(payload.meta?.preparation).toMatchObject({ checkedAt: now.toISOString(), sources: [{ id: "e1", url: event().url }] });
    expect(payload.meta?.preparation?.sources[0]?.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(payload.caption).toContain("2026");
    expect(data.payload).not.toContain("25 Ekim");
    expect(mocks.count.mock.calls[0]![0].where.OR).toEqual([{ id: "e1", updatedAt: now }]);
  });
  it.each(["DRAFT", "APPROVED", "PUBLISHING", "PUBLISHED", "FAILED", "SKIPPED"])("preserves existing %s and avoids external requests", async (status) => {
    mocks.slot.mockResolvedValue({ id: "existing", status, payload: null });
    expect(await prepareEventDraft(now, readPage)).toMatchObject({ status: "preserved" });
    expect(readPage).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("preserves nonempty PLANNED data and preserves a rerun after creating the draft", async () => {
    mocks.slot.mockResolvedValue({ id: "edited", status: "PLANNED", payload: "{}" });
    expect((await prepareEventDraft(now, readPage)).status).toBe("preserved");
    mocks.slot.mockResolvedValue(null);
    await prepareEventDraft(now, readPage);
    mocks.slot.mockResolvedValue({ id: "new-draft", status: "DRAFT", payload: mocks.create.mock.calls[0]![0].data.payload });
    expect((await prepareEventDraft(now, readPage)).status).toBe("preserved");
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });
  it("rejects used IDs including an in-flight publication and duplicate canonical source URLs", async () => {
    mocks.previous.mockResolvedValue([{ sourceIds: '["e1"]', payload: null }]);
    expect((await prepareEventDraft(now, readPage)).status).toBe("blocked");
    expect(readPage).not.toHaveBeenCalled();
    mocks.previous.mockResolvedValue([{ sourceIds: "[]", payload: JSON.stringify({ slides: [], caption: "", sources: [{ label: "official", ref: event().url + "?utm_source=old" }] }) }]);
    expect((await prepareEventDraft(now, readPage)).status).toBe("blocked");
    expect(readPage).not.toHaveBeenCalled();
  });
  it("blocks unverified dates and missing curated primary URL, and sanitizes network errors", async () => {
    readPage.mockResolvedValue("Different congress 2025");
    expect(await prepareEventDraft(now, readPage)).toMatchObject({ status: "blocked", reasons: expect.arrayContaining(["e1:primary-evidence-missing"]) });
    mocks.pool.mockResolvedValue([{ ...event(), sourceUrls: "[]" }]);
    expect((await prepareEventDraft(now, readPage)).reasons).toContain("e1:primary-url-missing");
    mocks.pool.mockResolvedValue([event()]);
    readPage.mockRejectedValue(new Error("secret in raw network error"));
    const result = await prepareEventDraft(now, readPage);
    expect(result.reasons).toContain("e1:primary-fetch-failed");
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("caps requests at five and selected events at three; skips duplicate URLs inside the same batch", async () => {
    mocks.pool.mockResolvedValue(Array.from({ length: 10 }, (_, i) => event(`e${i}`, `https://example.org/${i}`)));
    readPage.mockResolvedValue("not verified");
    expect((await prepareEventDraft(now, readPage)).checked).toBe(5);
    expect(readPage).toHaveBeenCalledTimes(5);
    readPage.mockClear(); readPage.mockResolvedValue(html); mocks.count.mockResolvedValue(3);
    expect((await prepareEventDraft(now, readPage)).checked).toBe(3);
    expect(JSON.parse(mocks.create.mock.calls[0]![0].data.sourceIds)).toHaveLength(3);
    mocks.pool.mockResolvedValue([event(), event("e2")]); mocks.count.mockResolvedValue(1);
    readPage.mockClear(); await prepareEventDraft(now, readPage);
    expect(readPage).toHaveBeenCalledTimes(1);
  });
  it("CAS protects edits made while source verification was running", async () => {
    mocks.slot.mockResolvedValue({ id: "empty", status: "PLANNED", payload: null, updatedAt: now });
    mocks.update.mockResolvedValue({ count: 0 });
    expect((await prepareEventDraft(now, readPage)).status).toBe("conflict");
    expect(mocks.update.mock.calls[0]![0].where).toEqual({ id: "empty", status: "PLANNED", payload: null, updatedAt: now });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("does not save a source changed after verification or duplicate concurrent insert", async () => {
    mocks.count.mockResolvedValue(0);
    expect((await prepareEventDraft(now, readPage)).status).toBe("conflict");
    expect(mocks.create).not.toHaveBeenCalled();
    mocks.count.mockResolvedValue(1); mocks.create.mockRejectedValue({ code: "P2002" });
    expect((await prepareEventDraft(now, readPage)).status).toBe("conflict");
    mocks.create.mockRejectedValue(new Error("database unavailable"));
    await expect(prepareEventDraft(now, readPage)).rejects.toThrow("database unavailable");
  });
  it("normalizes source identity without discarding meaningful query parameters", () => {
    expect(sourceKey("https://EXAMPLE.org/event/?utm_campaign=x#old")).toBe("https://example.org/event");
    expect(sourceKey("https://example.org/?id=1")).not.toBe(sourceKey("https://example.org/?id=2"));
    expect(sourceKey("http://example.org")).toBeNull();
  });
});
