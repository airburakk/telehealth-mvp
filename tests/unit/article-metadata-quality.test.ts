import { describe, expect, it, vi } from "vitest";
import { inspectArticleMetadata, reportArticleMetadataQuality, type ArticleMetadata } from "@/lib/article-metadata-quality";

const base: ArticleMetadata = {
  source: "doaj", externalId: "647d81103462451694bc03af0c855097", title: "Detection of",
  titleOriginal: null, doi: "10.1016/j.lanmic.2026.101462", url: "https://doi.org/10.1016/j.lanmic.2026.101462",
  publishedAt: new Date("2026-07-01T00:00:00Z"), createdAt: new Date("2026-10-05T02:21:35.130Z"),
};
const codes = (row: ArticleMetadata) => inspectArticleMetadata(row).findings.map((f) => f.code);

describe("D06 metadata quality is advisory", () => {
  it("flags the proven D04 source fragment for human review without repairing", () => {
    const result = inspectArticleMetadata(base);
    expect(result.status).toBe("human-review");
    expect(result.repair).toBeNull();
    expect(codes(base)).toContain("possible-incomplete-title");
  });
  it.each(["DNA", "Editorial", "Detection", "COVID-19", "A", "Detection of fungi"])("does not reject short title %s", (title) => {
    expect(codes({ ...base, title })).toEqual([]);
  });
  it("accepts a 2026 reaffirmed guideline even when another date field is from 2024", () => {
    expect(codes({ ...base, title: "2026 AHA/ACC Guideline for Perioperative Cardiovascular Management",
      doi: "10.1016/j.jacc.2026.06.017", url: "https://doi.org/10.1016/j.jacc.2026.06.017",
      publishedAt: new Date("2024-09-24T00:00:00Z") })).toEqual([]);
  });
  it("separates publication from local ingest and preserves both values", () => {
    const result = inspectArticleMetadata(base);
    expect(result.dates.publishedAt.value).toBe(base.publishedAt);
    expect(result.dates.createdAt.value).toBe(base.createdAt);
    expect(result.dates.createdAt.role).toBe("local-ingest-time");
    expect(result.dates.publishedAt.basis).toBe("unknown");
  });
  it.each(["year-month", "source-created-date"] as const)("makes date precision/fallback reviewable: %s", (publishedAtBasis) => {
    expect(codes({ ...base, title: "A full study title", publishedAtBasis }).length).toBe(1);
  });
  it("does not invent missing publication or ingest dates", () => {
    const result = inspectArticleMetadata({ ...base, publishedAt: null, createdAt: null });
    expect(result.dates.publishedAt.value).toBeNull();
    expect(result.dates.createdAt.value).toBeNull();
  });
  it("reports invalid dates without altering them", () => {
    expect(codes({ ...base, publishedAt: new Date("invalid") })).toContain("invalid-date");
  });
  it("checks DOI URL case-insensitively, including encoded suffixes", () => {
    expect(codes({ ...base, title: "DNA", doi: "10.1234/AbC", url: "https://doi.org/10.1234%2Fabc" })).toEqual([]);
  });
  it("reports a DOI URL disagreement without preferring either value", () => {
    expect(codes({ ...base, url: "https://doi.org/10.1234/another" })).toContain("doi-url-mismatch");
  });
  it.each([null, "https://pubmed.ncbi.nlm.nih.gov/42537682/"])("does not require every article to have DOI: %s", (url) => {
    expect(codes({ ...base, title: "DNA", doi: null, url })).toEqual([]);
  });
  it.each(["not a DOI", "10.1234/"])("reports DOI syntax review: %s", (doi) => {
    expect(codes({ ...base, doi })).toContain("doi-format-review");
  });
  it.each(["not a URL", "javascript:alert(1)"])("reports bad URL: %s", (url) => {
    expect(codes({ ...base, url }).some((c) => c.startsWith("source-url-"))).toBe(true);
  });
  it("compares reference against original title while preserving a different translation", () => {
    const reference = { doi: base.doi!, title: "Detection of fungi", sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/42537682/" };
    const row = { ...base, title: "Mantarların saptanması", titleOriginal: "Detection of <i>fungi</i>" };
    expect(inspectArticleMetadata(row, reference).findings).toEqual([]);
    expect(row.title).toBe("Mantarların saptanması");
  });
  it("only reports reference-title mismatch after a matching DOI and source URL", () => {
    const result = inspectArticleMetadata(base, { doi: base.doi!, title: "Detection of fungi", sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/42537682/" });
    expect(result.findings.map((f) => f.code)).toContain("source-title-mismatch");
    expect(result.repair).toBeNull();
  });
  it("never compares title to another DOI or invalid reference URL", () => {
    for (const reference of [
      { doi: "10.1234/different", title: "Different", sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/1/" },
      { doi: base.doi!, title: "Different", sourceUrl: "invalid" },
    ]) {
      const codes = inspectArticleMetadata(base, reference).findings.map((f) => f.code);
      expect(codes).toContain("reference-identity-unconfirmed");
      expect(codes).not.toContain("source-title-mismatch");
    }
  });
  it("hook cannot mutate a frozen source record; event excludes title/URL/credential fields", () => {
    const row = Object.freeze({ ...base });
    const sink = vi.fn();
    reportArticleMetadataQuality(row, sink);
    expect(row).toEqual(base);
    expect(Object.keys(sink.mock.calls[0][0])).toEqual(["source", "externalId", "findings"]);
  });
  it("quality sink failure never blocks ingest", () => {
    expect(() => reportArticleMetadataQuality(base, () => { throw new Error("sink failure"); })).not.toThrow();
  });
  it("complete metadata does not emit a warning", () => {
    const sink = vi.fn();
    reportArticleMetadataQuality({ ...base, title: "A full study title" }, sink);
    expect(sink).not.toHaveBeenCalled();
  });
});
