import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), translate: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { newsArticle: mocks } }));
vi.mock("@/lib/medical-news", () => ({ NEWS_QUERIES: { Kardiyoloji: "cardiovascular diseases" } }));
vi.mock("@/lib/translate-news", () => ({ translateTitlesTr: mocks.translate }));
import { ingestDoajAll } from "@/lib/doctorium-academic-sources";

describe("D06 real DOAJ ingest advisory hook", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-06T12:00:00Z"));
    vi.clearAllMocks();
    mocks.findFirst.mockResolvedValue(null);
    mocks.findUnique.mockResolvedValue(null);
    mocks.create.mockResolvedValue({});
    mocks.translate.mockResolvedValue([undefined]); // No live provider/AI call.
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ results: [{
      id: "647d81103462451694bc03af0c855097", bibjson: {
        title: "Detection of", abstract: "Synthetic abstract for pipeline verification.",
        year: "2026", month: "10", journal: { title: "The Lancet Microbe" },
        identifier: [{ type: "doi", id: "10.1016/j.lanmic.2026.101462" }],
      },
    }] }), { status: 200 })));
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  async function run() {
    const result = ingestDoajAll();
    await vi.runAllTimersAsync();
    return result;
  }
  it("reports a source defect yet keeps existing ingest acceptance and exact metadata", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await run()).toEqual([1, 1]);
    expect(warn).toHaveBeenCalledWith("[doctorium-metadata-review]", expect.objectContaining({
      source: "doaj", externalId: "647d81103462451694bc03af0c855097",
      findings: expect.arrayContaining([expect.objectContaining({ code: "possible-incomplete-title" })]),
    }));
    expect(mocks.create.mock.calls[0][0].data).toMatchObject({ title: "Detection of", doi: "10.1016/j.lanmic.2026.101462" });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("observes before DOI dedup, without overwriting the existing article", async () => {
    mocks.findFirst.mockResolvedValue({ id: "existing", branchSlugs: '["kardiyoloji"]' });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await run()).toEqual([1, 0]);
    expect(warn).toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.translate).not.toHaveBeenCalled();
  });
  it("a broken reviewer log does not drop otherwise accepted content", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => { throw new Error("log sink failed"); });
    expect(await run()).toEqual([1, 1]);
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });
});
