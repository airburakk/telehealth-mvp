import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({ db: { newsArticle: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() } } }));
vi.mock("@/lib/titck-recalls", () => ({ fetchTitckRecallItems: vi.fn(), TITCK_RECALL_SOURCE: "titck-recalls" }));
import { db } from "@/lib/db";
import { fetchTitckRecallItems } from "@/lib/titck-recalls";
import { ingestTitckRecalls } from "@/lib/doctorium-sources";

const item = { id: "5394", title: "Kamuoyunun Dikkatine - 5394", summary: "DUYURU",
  url: "https://www.titck.gov.tr/duyuru/5394", publishedAt: new Date("2026-11-03T15:24:07Z") };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchTitckRecallItems).mockResolvedValue([item]);
  vi.mocked(db.newsArticle.findUnique).mockResolvedValue(null);
});

describe("TİTCK reuses the Doctorium ingestion model", () => {
  it("writes source metadata for generic official headlines without guessing clinical meaning", async () => {
    expect(await ingestTitckRecalls()).toEqual([1, 1]);
    expect(db.newsArticle.create).toHaveBeenCalledOnce();
    expect(db.newsArticle.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      source: "titck-recalls", externalId: "5394", title: item.title, summary: "DUYURU", sourceName: "TİTCK",
      module: "sektorel", category: "ilac-cihaz", kind: "haber", url: item.url, publishedAt: item.publishedAt, imageUrl: null,
    }) });
  });
  it("does not duplicate unchanged numeric source IDs", async () => {
    vi.mocked(db.newsArticle.findUnique).mockResolvedValue({ ...item, id: "existing" } as never);
    expect(await ingestTitckRecalls()).toEqual([1, 0]);
    expect(db.newsArticle.create).not.toHaveBeenCalled();
    expect(db.newsArticle.update).not.toHaveBeenCalled();
  });
  it("updates corrected metadata and clears stale AI/translation caches without moving first-seen time", async () => {
    vi.mocked(db.newsArticle.findUnique).mockResolvedValue({ ...item, id: "existing", title: "Eski başlık", aiSummary: "Eski özet" } as never);
    expect(await ingestTitckRecalls()).toEqual([1, 0]);
    expect(db.newsArticle.create).not.toHaveBeenCalled();
    expect(db.newsArticle.update).toHaveBeenCalledWith({ where: { id: "existing" }, data: {
      title: item.title, summary: item.summary, url: item.url, publishedAt: item.publishedAt,
      aiSummary: null, titleOriginal: null, summaryOriginal: null,
    } });
  });
  it("does not write or clear existing summaries in dry-run mode", async () => {
    expect(await ingestTitckRecalls({ dryRun: true })).toEqual([1, 1]);
    vi.mocked(db.newsArticle.findUnique).mockResolvedValue({ ...item, id: "existing", summary: "Eski açıklama" } as never);
    expect(await ingestTitckRecalls({ dryRun: true })).toEqual([1, 0]);
    expect(db.newsArticle.create).not.toHaveBeenCalled();
    expect(db.newsArticle.update).not.toHaveBeenCalled();
  });
  it("does not write anything when the official feed contract fails", async () => {
    vi.mocked(fetchTitckRecallItems).mockRejectedValue(new Error("titck-feed-invalid-item"));
    await expect(ingestTitckRecalls()).rejects.toThrow("titck-feed-invalid-item");
    expect(db.newsArticle.findUnique).not.toHaveBeenCalled();
    expect(db.newsArticle.create).not.toHaveBeenCalled();
  });
});
