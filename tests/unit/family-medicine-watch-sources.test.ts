import { describe, expect, it } from "vitest";
import { associationsForBranch, watchUrl } from "@/lib/association-sources";
import {
  FAMILY_MEDICINE_WATCH_SOURCES, HSGM_FAMILY_MEDICINE_LEGISLATION_URL,
  parseHsgmFamilyMedicineLegislation, prepareFamilyMedicineWatchHtml,
} from "@/lib/family-medicine-watch-sources";

const record = (id = 1, extra = {}) => ({ id, title: "Aile Hekimliği Yönetmeliği", category: "Yönetmelikler",
  url: `https://hsgm.saglik.gov.tr/depo/Mevzuat/${id}.pdf`, created: "2026-11-05 05:25:43",
  tags: [{ id: 9, title: "Aile Hekimliği Eğitim ve İzleme Dairesi Başkanlığı" }], ...extra });
const html = (rows: unknown[], extra = "") => `<html><title>Mevzuat</title><script>const publications = ${JSON.stringify(rows)}; ${extra}</script></html>`;
const prepare = (rows: unknown[]) => prepareFamilyMedicineWatchHtml(HSGM_FAMILY_MEDICINE_LEGISLATION_URL, html(rows));

describe("curated family medicine publisher watch catalog", () => {
  it("contains eight unique HTTPS URLs and no automatic review approvals", () => {
    expect(FAMILY_MEDICINE_WATCH_SOURCES).toHaveLength(8);
    expect(new Set(FAMILY_MEDICINE_WATCH_SOURCES.map(s => s.url)).size).toBe(8);
    for (const source of FAMILY_MEDICINE_WATCH_SOURCES) {
      const url = new URL(source.url);
      expect(url.protocol).toBe("https:");
      expect(url.username + url.password + url.port).toBe("");
      expect(source.expectedTerms.length).toBeGreaterThan(0);
      expect(source).not.toHaveProperty("approvedAt");
      expect(source).not.toHaveProperty("workflowIds");
    }
  });
  it("reuses TAHUD/AHEF in the existing weekly association and congress queue catalog without invented RSS", () => {
    const associations = associationsForBranch("aile-hekimligi");
    expect(associations.map(a => a.slug)).toEqual(expect.arrayContaining(["tahud", "ahef"]));
    for (const slug of ["tahud", "ahef"]) {
      const association = associations.find(a => a.slug === slug)!;
      expect(association.rss).toBeUndefined();
      expect(FAMILY_MEDICINE_WATCH_SOURCES.some(s => s.url === watchUrl(association))).toBe(true);
    }
  });
});

describe("HSGM embedded JSON is observed without executing JavaScript", () => {
  it("sorts stable public metadata, ignores unrelated records and handles quoted brackets", () => {
    const result = parseHsgmFamilyMedicineLegislation(html([record(2), record(1, { title: 'Aile Hekimliği [taslak] "metni"' }),
      record(3, { title: "Başka daire", tags: [] })]));
    expect(result.map(r => r.id)).toEqual([1, 2]);
    expect(result[0].title).toContain('[taslak] "metni"');
    expect(result[0]).not.toHaveProperty("effectiveAt");
    expect(prepare([record(2), record(1)])).toBe(prepare([record(1), record(2)]));
  });
  it("detects title, link, timestamp and added/removed listing changes inside scripts", () => {
    const baseline = prepare([record()]);
    for (const change of [{ title: "Aile Hekimliği Değişikliği" }, { url: "https://hsgm.saglik.gov.tr/depo/yeni.pdf" },
      { created: "2026-11-06 05:25:43" }]) expect(prepare([record(1, change)])).not.toBe(baseline);
    expect(prepare([record(), record(2)])).not.toBe(baseline);
  });
  it("does not execute appended JavaScript or retain executable HTML in metadata", () => {
    const input = html([record(1, { title: 'Aile Hekimliği <img src=x onerror="throw 1">' })], "throw new Error('must never execute');");
    expect(() => parseHsgmFamilyMedicineLegislation(input)).not.toThrow();
    expect(prepareFamilyMedicineWatchHtml(HSGM_FAMILY_MEDICINE_LEGISLATION_URL, input)).not.toContain("<img");
  });
  it("fails closed on missing, malformed, empty, duplicate, unexpected or untrusted records", () => {
    for (const input of ["<main>Mevzuat</main>", "const publications = [{", "const publications = [()=>42];",
      html([]), html([null]), html([record(), record()]), html([record(1, { tags: "bad" })]),
      html([record(1, { title: "Başka daire", tags: [] })]), html([record(1, { url: "https://evil.invalid/a.pdf" })]),
      html([record(1, { url: "http://hsgm.saglik.gov.tr/a.pdf" })]), html([record(1, { url: "https://user:pass@hsgm.saglik.gov.tr/a.pdf" })]),
      html([record()]) + html([record(2)])]) expect(() => prepareFamilyMedicineWatchHtml(HSGM_FAMILY_MEDICINE_LEGISLATION_URL, input)).toThrow(/family-medicine-watch-/);
  });
});

describe("narrow AHEF counter normalization", () => {
  const url = FAMILY_MEDICINE_WATCH_SOURCES.find(s => s.id === "ahef-news")!.url;
  const page = (count: number, date = "21 Kasım 2026", path = "/haber/1") =>
    `<main><a href="${path}">${date}</a><li><a>Görüntülenme Adedi:\n <span>${count}</span></a></li><p>Sayfamız,\n ${count} kere Ziyaret edilmiştir.</p></main>`;
  it("ignores observed visit counters but preserves dates and link replacements", () => {
    const base = prepareFamilyMedicineWatchHtml(url, page(100));
    expect(prepareFamilyMedicineWatchHtml(url, page(999))).toBe(base);
    expect(prepareFamilyMedicineWatchHtml(url, page(100, "22 Kasım 2026"))).not.toBe(base);
    expect(prepareFamilyMedicineWatchHtml(url, page(100, undefined, "/haber/2"))).not.toBe(base);
  });
  it("does not normalize any non-catalog URL, even on the same hostname", () => {
    expect(prepareFamilyMedicineWatchHtml("https://www.ahef.org.tr/other", page(100))).toBe(page(100));
    expect(prepareFamilyMedicineWatchHtml("https://example.org/", page(100))).toBe(page(100));
  });
});
