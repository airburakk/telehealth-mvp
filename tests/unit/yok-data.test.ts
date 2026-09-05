// YÖK Atlas kayıt defteri (K5) — dosya ↔ defter tutarlılığı, onaysız gizli, satır sözleşmesi, hafif satır.
import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { YOK_SNAPSHOTS, approvedYokSnapshots, toRowLite } from "@/lib/yok-data";
import snapshot2026 from "@/data/yok/tip-programlari-2026.json";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const file = snapshot2026 as unknown as { meta: { year: number; fetchedAt: string; sourceApi: string; tipPrograms: number; excludedFields: string[] }; rows: { code: number; university: string; type: string; quota: number; placed: number; rank: number | null; history: { yearsBack: number }[] }[] };

describe("yok-data", () => {
  it("defter ↔ dosyalar: her yıl için tip-programlari-<yıl>.json var; approvedAt null ya da ISO", () => {
    const files = readdirSync(join(process.cwd(), "src", "data", "yok")).filter((f) => /^tip-programlari-\d{4}\.json$/.test(f));
    for (const s of YOK_SNAPSHOTS) {
      expect(files, `yıl ${s.year}`).toContain(`tip-programlari-${s.year}.json`);
      if (s.approvedAt !== null) expect(s.approvedAt).toMatch(ISO);
    }
  });
  it("2026 dosyası: meta kaynak YÖK Atlas API; satır sayısı meta ile eşit; kodlar benzersiz; yalnız Tıp; dışlanan alanlar listede", () => {
    expect(file.meta.year).toBe(2026);
    expect(file.meta.sourceApi).toContain("yokatlas.yok.gov.tr/api/tercih-kilavuz/search");
    expect(file.meta.fetchedAt).toMatch(ISO);
    expect(file.rows.length).toBe(file.meta.tipPrograms);
    expect(file.rows.length).toBeGreaterThan(200);
    expect(new Set(file.rows.map((r) => r.code)).size).toBe(file.rows.length);
    expect(file.meta.excludedFields).toEqual(expect.arrayContaining(["tustt1", "tusktp", "kpss1", "ucret"]));
    for (const r of file.rows) {
      expect(["DEVLET", "VAKIF", "KKTC", "YURTDISI"]).toContain(r.type);
      // Resmî veride 3 askerî kontenjan satırında yerleşen = kontenjan + 1 (eşit puanlı adayların birlikte yerleştirilmesi) → küçük tolerans.
      expect(r.placed, `${r.code}`).toBeLessThanOrEqual(r.quota + 2);
      expect(r.history.map((h) => h.yearsBack)).toEqual([1, 2, 3]);
    }
    // Satırlarda dışlanan alan sızmamış.
    const keys = new Set(file.rows.flatMap((r) => Object.keys(r)));
    for (const k of ["tustt1", "tusktp", "kpss1", "ucret", "kosul", "kosulList"]) expect(keys.has(k), k).toBe(false);
  });
  it("onaysız yıl seçicide görünmez; onaylı yıl özetle döner", () => {
    const fake = { 2026: snapshot2026 as never };
    expect(approvedYokSnapshots([{ year: 2026, approvedAt: null }], fake)).toEqual([]);
    const ok = approvedYokSnapshots([{ year: 2026, approvedAt: "2026-09-05" }], fake);
    expect(ok.length).toBe(1);
    expect(ok[0].summary.programs).toBe(file.rows.length);
    expect(ok[0].summary.quotaByYear.map((q) => q.year)).toEqual([2023, 2024, 2025, 2026]);
    expect(ok[0].summary.totals.quota).toBe(file.rows.reduce((n, r) => n + r.quota, 0));
    // Defterde olmayan yıl (dosya yok) → atlanır, patlamaz.
    expect(approvedYokSnapshots([{ year: 2019, approvedAt: "2026-09-05" }], fake)).toEqual([]);
  });
  it("toRowLite: öğretim üyesi toplamı prof+doç+dr; ücret/koşul yok", () => {
    const ok = approvedYokSnapshots([{ year: 2026, approvedAt: "2026-09-05" }], { 2026: snapshot2026 as never });
    const withStaff = ok[0].rows.find((r) => r.staff);
    expect(withStaff).toBeTruthy();
    const lite = toRowLite(withStaff!);
    expect(lite.facultyMembers).toBe(withStaff!.staff!.prof + withStaff!.staff!.doc + withStaff!.staff!.dou);
    expect(Object.keys(lite)).not.toContain("ucret");
    const noStaff = ok[0].rows.find((r) => !r.staff);
    if (noStaff) expect(toRowLite(noStaff).facultyMembers).toBeNull();
  });
});
