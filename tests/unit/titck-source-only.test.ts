import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("@/lib/db", () => ({ db: { newsArticle: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() } } }));
vi.mock("@/lib/ai-clinical", () => ({ translateText: vi.fn(), summarizeArticleForClinician: vi.fn(), summarizeRegulationForClinician: vi.fn() }));
vi.mock("@/lib/doctorium-sources", () => ({ fetchDocumentHtml: vi.fn() }));
import { db } from "@/lib/db";
import { fetchDocumentHtml } from "@/lib/doctorium-sources";
import { summarizeRegulationForClinician } from "@/lib/ai-clinical";
import { ensureRegulationSummary, generatePendingAiSummaries } from "@/lib/doctorium";
import { TITCK_RECALL_SOURCE } from "@/lib/titck-recalls";

const sourceRow = { source: TITCK_RECALL_SOURCE, module: "sektorel", title: "Kamuoyunun Dikkatine - 5394",
  summary: "DUYURU", summaryOriginal: null, url: "https://www.titck.gov.tr/duyuru/5394", aiSummary: null };
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ANTHROPIC_API_KEY", "test-only-key");
  vi.mocked(db.newsArticle.findUnique).mockResolvedValue(sourceRow as never);
});
afterEach(() => vi.unstubAllEnvs());

describe("TİTCK recalls remain official source metadata", () => {
  it("returns source-only before any text fetch, AI call or metadata write", async () => {
    await expect(ensureRegulationSummary("existing")).resolves.toEqual({ state: "source-only" });
    expect(fetchDocumentHtml).not.toHaveBeenCalled();
    expect(summarizeRegulationForClinician).not.toHaveBeenCalled();
    expect(db.newsArticle.update).not.toHaveBeenCalled();
  });
  it("ignores cached AI actions too, even if a stale cache already exists", async () => {
    vi.mocked(db.newsArticle.findUnique).mockResolvedValue({ ...sourceRow,
      aiSummary: JSON.stringify({ summary: "Old inferred summary", actions: ["Do not display"], affected: "Old scope", effective: "Old date" }),
    } as never);
    await expect(ensureRegulationSummary("existing")).resolves.toEqual({ state: "source-only" });
    expect(fetchDocumentHtml).not.toHaveBeenCalled();
    expect(summarizeRegulationForClinician).not.toHaveBeenCalled();
  });
  it("excludes this source from the nightly AI candidate query without counting a failure", async () => {
    vi.mocked(db.newsArticle.findMany).mockResolvedValue([]);
    const result = await generatePendingAiSummaries();
    expect(db.newsArticle.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ source: { not: TITCK_RECALL_SOURCE }, aiSummary: null }),
    }));
    expect(result).toMatchObject({ toplam: 0, hata: 0, basarili: 0 });
    expect(fetchDocumentHtml).not.toHaveBeenCalled();
    expect(db.newsArticle.update).not.toHaveBeenCalled();
  });
  it("preserves the existing cached-summary behavior for other sources", async () => {
    const summary = { summary: "Existing news summary", actions: [], affected: "", effective: "" };
    vi.mocked(db.newsArticle.findUnique).mockResolvedValue({ ...sourceRow, source: "sgk", aiSummary: JSON.stringify(summary) } as never);
    await expect(ensureRegulationSummary("other")).resolves.toEqual({ state: "ok", data: summary });
  });
  it("shows a distinct source-only explanation instead of claiming the official page has no text", () => {
    const page = readFileSync(join(process.cwd(), "src/app/doktor/doctorium/[id]/page.tsx"), "utf8");
    const start = page.indexOf('reg?.state === "source-only"');
    expect(start).toBeGreaterThan(-1);
    const block = page.slice(start, page.indexOf('reg?.state === "pdf"', start));
    expect(block).toContain("TİTCK geri çekme/blokaj");
    expect(block).toContain("seri/parti");
    expect(block).toContain("resmî duyuruyu açın");
    expect(block).not.toContain("özetlenecek metin yok");
    expect(block).not.toContain("yenilediğinizde");
  });
});
