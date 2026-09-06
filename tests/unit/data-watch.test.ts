// Veri nöbetçisi saf yardımcıları (scripts/data-watch-lib.mjs): dönem türetme, ÖSYM slug'ları, defter okuma/yama (approvedAt: null), YÖKSİS etiketi, bayat EDU.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  nextPeriodKeys, osymSlugs, registryKeys, guideSourcePage, patchTusRegistry, patchYokAtlasRegistry, patchYokMezunRegistry,
  mezunEndYearForPage, pageLabelForEndYear, staleEdu,
} from "../../scripts/data-watch-lib.mjs";

const R = join(process.cwd(), "src", "lib");
const tusData = readFileSync(join(R, "tus-data.ts"), "utf8");
const yokData = readFileSync(join(R, "yok-data.ts"), "utf8");
const yokMezun = readFileSync(join(R, "yok-mezun.ts"), "utf8");
const guides = readFileSync(join(R, "tus-guides.ts"), "utf8");

describe("data-watch-lib", () => {
  it("dönem türetme ve slug'lar", () => {
    expect(nextPeriodKeys("2026-1", 2)).toEqual(["2026-2", "2027-1"]);
    expect(nextPeriodKeys("2025-2", 3)).toEqual(["2026-1", "2026-2", "2027-1"]);
    expect(osymSlugs("main", "2026-2")).toEqual(["https://www.osym.gov.tr/2026tus-2-donem-yerlestirme-sonuclarina-iliskin-sayisal-bilgiler"]);
    expect(osymSlugs("ek", "2026-1")[1]).toContain("genelyabanci-uyruklu"); // 🪤 2025/1·2026/1 dersi
    expect(osymSlugs("kilavuz", "2027-1")[0]).toBe("https://www.osym.gov.tr/2027tus-1-donem-kilavuz-ve-basvuru-bilgileri");
    expect(() => nextPeriodKeys("2026-3")).toThrow();
  });
  it("gerçek defterleri okur", () => {
    const main = registryKeys(tusData, "TUS_SNAPSHOTS"); const ek = registryKeys(tusData, "TUS_EK_SNAPSHOTS");
    expect(main[0]).toBe("2021-2"); expect(main[main.length - 1]).toMatch(/^\d{4}-[12]$/); expect(ek.length).toBeGreaterThan(5);
    expect(registryKeys(yokData, "YOK_SNAPSHOTS", "year")).toContain(2026);
    expect(registryKeys(yokMezun, "YOK_MEZUN_SNAPSHOTS", "endYear")).toEqual([2019, 2020, 2021, 2022, 2023, 2024, 2025]);
    expect(guideSourcePage(guides)).toContain("osym.gov.tr/2026tus-2-donem-kilavuz");
  });
  it("tus-data yaması: yeni dönem defter + yükleyici, approvedAt: null; tekrar yamalama etkisiz", () => {
    const s = patchTusRegistry(tusData, "2026-2", "main");
    expect(s).toContain('{ key: "2026-2", year: 2026, term: 2, approvedAt: null }');
    expect(s).toContain('"2026-2": () => import("@/data/tus/2026-2.json"),');
    expect(registryKeys(s, "TUS_SNAPSHOTS")).toContain("2026-2");
    expect(registryKeys(s, "TUS_EK_SNAPSHOTS")).not.toContain("2026-2"); // ek defterine dokunmadı
    expect(patchTusRegistry(s, "2026-2", "main")).toBe(s);
    const e = patchTusRegistry(s, "2026-2", "ek");
    expect(e).toContain('"2026-2": () => import("@/data/tus/ek-2026-2.json"),');
    expect(registryKeys(e, "TUS_EK_SNAPSHOTS")).toContain("2026-2");
    // Sıra korunur: yeni satır dizinin sonunda, "];" öncesinde
    expect(s.indexOf('{ key: "2026-2"')).toBeGreaterThan(s.indexOf('{ key: "2026-1"'));
  });
  it("yok-data yaması: import + defter + FILES", () => {
    const s = patchYokAtlasRegistry(yokData, 2027);
    expect(s).toContain('import snapshot2027 from "@/data/yok/tip-programlari-2027.json";');
    expect(s).toContain("{ year: 2027, approvedAt: null }");
    expect(s).toContain("2027: snapshot2027 as unknown as YokFile };");
    expect(patchYokAtlasRegistry(s, 2027)).toBe(s);
  });
  it("yok-mezun yaması: import + defter + FILES; etiket ↔ mezun yılı", () => {
    const s = patchYokMezunRegistry(yokMezun, 2026);
    expect(s).toContain('import m2026 from "@/data/yok/mezun-tip-2026.json";');
    expect(s).toContain("{ endYear: 2026, approvedAt: null }");
    expect(s).toContain("2026: m2026 as unknown as YokMezunFile,");
    expect(patchYokMezunRegistry(s, 2026)).toBe(s);
    expect(mezunEndYearForPage("2026-2027 Öğretim Yılı")).toBe(2026); // 🪤 sayfa yılı ≠ mezun yılı
    expect(pageLabelForEndYear(2026)).toBe("2026-2027 Öğretim Yılı");
  });
  it("bayat EDU: geçmiş son başvuru ve 180 günden eski doğrulama", () => {
    const list = [
      { id: "a", deadline: "2026-10-08", verifiedAt: "2026-09-05" },
      { id: "b", deadline: "2026-08-01", verifiedAt: "2026-09-05" },
      { id: "c", deadline: null, verifiedAt: "2026-01-01" },
      { id: "d", deadline: null, verifiedAt: "2026-09-01" },
    ];
    expect(staleEdu(list, "2026-09-06").map((x) => x.id)).toEqual(["b", "c"]);
  });
});
