import { describe, expect, it, vi } from "vitest";
import { D04_REFERENCE as ref, reviewD04Title, type TitleSnapshot } from "../../scripts/lib/d04-title-review";
const findMany = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ db: { newsArticle: { findMany } } }));
import { decodeFeedText, moduleFeed } from "@/lib/doctorium";

// Synthetic metadata, NOT an observed production row.
const fixture: TitleSnapshot = {
  id: ref.id, source: "pubmed", externalId: ref.pmid, doi: ref.doi,
  title: "Detection of", titleOriginal: null,
};

describe("D04 targeted offline title review", () => {
  it("accepts the confirmed DOAJ row identity without inventing a PubMed source", () => {
    const row = { ...fixture, source: "doaj", externalId: ref.doajId };
    const plan = reviewD04Title(row);
    expect(plan.status).toBe("approval-required");
    if (plan.status !== "approval-required") throw new Error("Expected plan");
    expect(plan.expectedOldValue.source).toBe("doaj");
    expect(plan.expectedOldValue.externalId).toBe(ref.doajId);
  });
  it("rejects another DOAJ publication even when the DOI is copied", () => {
    expect(reviewD04Title({ ...fixture, source: "doaj", externalId: "different" }).update).toBeNull();
  });
  it("current feed decoder preserves full title across inline species markup", () => {
    const marked = ref.title.replace("Trichophyton indotineae", "<i>Trichophyton indotineae</i>");
    expect(decodeFeedText(marked)).toBe(ref.title);
  });
  it("current DB-to-feed path preserves the full title", async () => {
    findMany.mockResolvedValueOnce([{
      ...fixture, title: ref.title, module: "akademik", kind: "makale",
      summary: "synthetic", sourceName: "The Lancet Microbe", authors: null,
      url: `https://doi.org/${ref.doi}`, publishedAt: new Date("2026-07-01T00:00:00Z"),
      branchSlugs: "[]", aiSummary: null, category: null, imageUrl: null,
    }]);
    const items = await moduleFeed("akademik", [], { limit: 1 });
    expect(items[0].title).toBe(ref.title);
    expect(items[0].doi).toBe(ref.doi);
  });
  it("includes exact old values and full verified title, always dry-run", () => {
    const plan = reviewD04Title(fixture);
    expect(plan.status).toBe("approval-required");
    expect(plan.mode).toBe("dry-run");
    if (plan.status !== "approval-required") throw new Error("Expected plan");
    expect(plan.expectedOldValue).toEqual(fixture);
    expect(plan.proposed).toEqual({ title: ref.title, titleOriginal: null });
    expect(Object.keys(plan.proposed)).toEqual(["title", "titleOriginal"]);
    expect(plan.preserve).toContain("aiSummary");
  });
  it.each(["id", "source", "externalId", "doi"] as const)("rejects wrong %s", (field) => {
    expect(reviewD04Title({ ...fixture, [field]: "different" }).status).toBe("identity-mismatch");
  });
  it("does not mutate the input metadata", () => {
    const row = Object.freeze({ ...fixture });
    reviewD04Title(row);
    expect(row).toEqual(fixture);
  });
  it.each([null, ref.title])("complete title is a no-op with original %s", (titleOriginal) => {
    expect(reviewD04Title({ ...fixture, title: ref.title, titleOriginal }).update).toBeNull();
  });
  it("preserves a translated title with verified full original", () => {
    expect(reviewD04Title({ ...fixture, title: "Doğrulanmış Türkçe başlık", titleOriginal: ref.title }).update).toBeNull();
  });
  it.each(["Detection", "Detection of fungi", "DNA", "Editorial"])("never repairs by short-title heuristic: %s", (title) => {
    expect(reviewD04Title({ ...fixture, title }).status).toBe("manual-review-required");
  });
  it("does not overwrite a conflicting original", () => {
    expect(reviewD04Title({ ...fixture, titleOriginal: "Another publication" }).update).toBeNull();
  });
  it("can draft restoration when full original survived the bad display title", () => {
    expect(reviewD04Title({ ...fixture, titleOriginal: ref.title }).status).toBe("approval-required");
  });
});
