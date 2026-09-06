// YÖKSİS Tıp fakültesi mezun sayıları (K5(a)) — defter ↔ dosya, satır sözleşmesi (E + K = T), yıl etiketi, onaysız gizli.
import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { YOK_MEZUN_SNAPSHOTS, approvedTipGraduates, summarizeMezun, tipGraduateRowsFor, type YokMezunFile } from "@/lib/yok-mezun";
import m2019 from "@/data/yok/mezun-tip-2019.json";
import m2025 from "@/data/yok/mezun-tip-2025.json";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const files: Record<number, YokMezunFile> = { 2019: m2019 as unknown as YokMezunFile, 2025: m2025 as unknown as YokMezunFile };

describe("yok-mezun", () => {
  it("defter ↔ dosyalar: her endYear için mezun-tip-<yıl>.json var; kronolojik; approvedAt null ya da ISO", () => {
    const names = readdirSync(join(process.cwd(), "src", "data", "yok")).filter((f) => /^mezun-tip-\d{4}\.json$/.test(f));
    const years = YOK_MEZUN_SNAPSHOTS.map((s) => s.endYear);
    expect([...years].sort((a, b) => a - b)).toEqual(years);
    for (const s of YOK_MEZUN_SNAPSHOTS) {
      expect(names, `yıl ${s.endYear}`).toContain(`mezun-tip-${s.endYear}.json`);
      if (s.approvedAt !== null) expect(s.approvedAt).toMatch(ISO);
    }
    expect(names.length).toBe(YOK_MEZUN_SNAPSHOTS.length); // defterde olmayan dosya kalmasın
  });

  it("dosya sözleşmesi: gradYear 'YYYY-YYYY' ve endYear = ikinci yıl; kaynak YÖKSİS; her satır E + K = T, tür bilinen, fakülte adı 'TIP FAKÜLTESİ' içerir; meta toplamları satırlarla eşit", () => {
    for (const [year, f] of Object.entries(files)) {
      expect(f.meta.gradYear).toMatch(/^\d{4}-\d{4}$/);
      expect(f.meta.endYear).toBe(Number(f.meta.gradYear.split("-")[1]));
      expect(f.meta.endYear).toBe(Number(year));
      expect(f.meta.sourcePage).toContain("istatistik.yok.gov.tr");
      expect(f.meta.tableTitle).toMatch(/TABLO 12/i);
      expect(f.meta.fetchedAt).toMatch(ISO);
      expect(f.rows.length).toBeGreaterThan(50);
      expect(f.rows.length).toBe(f.meta.tipFaculties);
      expect(f.rows.reduce((n, r) => n + r.total, 0)).toBe(f.meta.tipGraduates);
      for (const r of f.rows) {
        expect(r.male + r.female, `${r.university} / ${r.faculty}`).toBe(r.total);
        expect(["DEVLET", "VAKIF", "KKTC", "YURTDIŞI", "YURTDISI"]).toContain(r.type);
        expect(r.faculty).toMatch(/T[Iİ]P FAK/i);
        expect(r.faculty.endsWith("*")).toBe(false); // dipnot yıldızı temizlenmiş
        expect(r.university.includes("\n")).toBe(false); // İngilizce ad satırı atılmış
      }
    }
    // Ulusal toplam satırı okunmuş ve Tıp mezunları ondan küçük.
    expect(m2025.meta.nationalUndergraduateGraduates?.total ?? 0).toBeGreaterThan(m2025.meta.tipGraduates);
  });

  it("özet: yıl toplamları, tür kırılımı; onaysız görünmez; onaylı kronolojik", () => {
    const s = summarizeMezun(files[2025], "2026-09-06");
    expect(s.graduates).toBe(files[2025].meta.tipGraduates);
    expect(s.male + s.female).toBe(s.graduates);
    expect(s.byType.reduce((n, t) => n + t.graduates, 0)).toBe(s.graduates);
    expect(s.byType.find((t) => t.type === "DEVLET")?.faculties).toBeGreaterThan(50);
    expect(approvedTipGraduates([{ endYear: 2025, approvedAt: null }, { endYear: 2019, approvedAt: null }], files)).toEqual([]);
    const ok = approvedTipGraduates([{ endYear: 2025, approvedAt: "2026-09-06" }, { endYear: 2019, approvedAt: "2026-09-06" }], files);
    expect(ok.map((y) => y.endYear)).toEqual([2019, 2025]);
    expect(tipGraduateRowsFor(2025, [{ endYear: 2025, approvedAt: null }], files)).toEqual([]);
    const rows = tipGraduateRowsFor(2025, [{ endYear: 2025, approvedAt: "2026-09-06" }], files);
    expect(rows.length).toBe(files[2025].rows.length);
    expect(tipGraduateRowsFor(1999, [{ endYear: 1999, approvedAt: "2026-09-06" }], files)).toEqual([]);
  });
});
