// TUS EK YERLEŞTİRME kayıt defteri (K2) — defter ↔ dosya, onaysız gizli, satır sözleşmesi, ana dönemle tutarlılık.
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { TUS_EK_SNAPSHOTS, TUS_SNAPSHOTS, tusEkRowsFor, tusRowsFor } from "@/lib/tus-data";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DIR = join(process.cwd(), "src", "data", "tus");

describe("tus-data — ek yerleştirme", () => {
  it("defter ↔ dosyalar: her ek anahtarı için ek-<dönem>.json var ve ana dönem defterinde de var; approvedAt null ya da ISO", () => {
    const files = readdirSync(DIR).filter((f) => /^ek-\d{4}-[12]\.json$/.test(f));
    for (const s of TUS_EK_SNAPSHOTS) {
      expect(files, s.key).toContain(`ek-${s.key}.json`);
      expect(TUS_SNAPSHOTS.some((m) => m.key === s.key), `${s.key} ana dönemde yok`).toBe(true);
      if (s.approvedAt !== null) expect(s.approvedAt).toMatch(ISO);
    }
    expect(files.length).toBe(TUS_EK_SNAPSHOTS.length); // defterde olmayan ek dosyası kalmasın
  });

  it("dosya sözleşmesi: meta.kind = 'ek', kaynak ÖSYM, satırlar 9 sütun, kontenjan ≥ yerleşen, boş = kontenjan − yerleşen", () => {
    for (const s of TUS_EK_SNAPSHOTS) {
      const j = JSON.parse(readFileSync(join(DIR, `ek-${s.key}.json`), "utf8")) as { meta: { kind: string; sourcePdf: string; year: number; term: number; rows: number; skipped: number }; rows: unknown[][] };
      expect(j.meta.kind).toBe("ek");
      expect(j.meta.sourcePdf).toContain("dokuman.osym.gov.tr");
      expect(`${j.meta.year}-${j.meta.term}`).toBe(s.key);
      expect(j.rows.length).toBe(j.meta.rows);
      expect(j.meta.skipped, `${s.key} atlanan satır`).toBe(0);
      for (const r of j.rows) {
        expect(r.length).toBe(9);
        const [, , , qt, quota, placed, vacant] = r as [string, string, string, string, number, number, number];
        expect(["GENEL", "YABANCI"]).toContain(qt);
        expect(quota).toBeGreaterThanOrEqual(placed);
        expect(vacant).toBe(quota - placed);
      }
    }
  });

  it("onaysız ek görünmez; onaylı ek satırları ana dönemin branşlarıyla örtüşür ve ana kontenjandan küçüktür", async () => {
    for (const s of TUS_EK_SNAPSHOTS) {
      const rows = await tusEkRowsFor(s.key);
      if (!s.approvedAt) { expect(rows).toEqual([]); continue; }
      expect(rows.length).toBeGreaterThan(50);
      const main = await tusRowsFor(s.key);
      const mainBranches = new Set(main.map((r) => r.branch));
      const unknown = rows.filter((r) => !mainBranches.has(r.branch));
      expect(unknown.length, `${s.key} ana dönemde olmayan branş: ${unknown.slice(0, 3).map((r) => r.branch).join(", ")}`).toBeLessThanOrEqual(2);
      const ekQuota = rows.reduce((n, r) => n + r.quota, 0), mainQuota = main.reduce((n, r) => n + r.quota, 0);
      expect(ekQuota).toBeLessThan(mainQuota);
    }
    expect(await tusEkRowsFor("1999-1")).toEqual([]);
  });
});
