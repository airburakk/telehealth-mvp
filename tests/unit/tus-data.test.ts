// TUS veri kayıt defteri sözleşmesi (K1, 2026-09-05): dönem anahtarları ↔ satır dosyaları ↔ summary.json; onaysız dönem
// görünmez; özet toplamları satırlarla tutarlı (örnek dönem). DB'siz.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { TUS_SNAPSHOTS, approvedTusSummaries, tusBranches, periodKey } from "@/lib/tus-data";
import { summarizePeriod, type TusRowTuple } from "@/lib/tus-normalize";
import summary from "@/data/tus/summary.json";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

describe("TUS kayıt defteri", () => {
  it("10 dönem (2021/2 → 2026/1), kronolojik, benzersiz; her dönemin satır dosyası ve özeti var", () => {
    expect(TUS_SNAPSHOTS.length).toBe(10);
    const keys = TUS_SNAPSHOTS.map((s) => s.key);
    expect(keys).toEqual(["2021-2", "2022-1", "2022-2", "2023-1", "2023-2", "2024-1", "2024-2", "2025-1", "2025-2", "2026-1"]);
    for (const s of TUS_SNAPSHOTS) {
      expect(s.key).toBe(periodKey(s.year, s.term));
      expect(existsSync(`src/data/tus/${s.key}.json`), s.key).toBe(true);
      if (s.approvedAt) expect(s.approvedAt).toMatch(ISO);
    }
    const sumKeys = (summary as { periods: { year: number; term: number }[] }).periods.map((p) => periodKey(p.year, p.term)).sort();
    expect(sumKeys).toEqual([...keys].sort());
  });
  it("onaysız dönem görünmez: approvedTusSummaries yalnız approvedAt dolu dönemleri, kronolojik döner", () => {
    const rows = approvedTusSummaries();
    const approved = TUS_SNAPSHOTS.filter((s) => s.approvedAt).map((s) => s.key);
    expect(rows.map((r) => r.key)).toEqual(approved);
    for (let i = 1; i < rows.length; i++) expect(rows[i].year * 10 + rows[i].term).toBeGreaterThan(rows[i - 1].year * 10 + rows[i - 1].term);
  });
  it("satır dosyası ↔ özet tutarlılığı (2025-2): toplam kontenjan/yerleşen/boş ve satır sayısı", () => {
    const j = JSON.parse(readFileSync("src/data/tus/2025-2.json", "utf8")) as { meta: { rows: number; skipped: number; sourcePdf: string }; rows: TusRowTuple[] };
    expect(j.meta.skipped).toBe(0);
    expect(j.rows.length).toBe(j.meta.rows);
    expect(j.meta.sourcePdf).toMatch(/^https:\/\/dokuman\.osym\.gov\.tr\//);
    const s = summarizePeriod(2025, 2, j.rows);
    const fromSummary = (summary as { periods: { year: number; term: number; totals: { quota: number; placed: number; vacant: number } }[] }).periods.find((p) => p.year === 2025 && p.term === 2)!;
    expect(fromSummary.totals).toMatchObject({ quota: s.totals.quota, placed: s.totals.placed, vacant: s.totals.vacant });
    // kontenjan = yerleşen + boş (yıldızlı fazla yerleşen dönemlerde eşitlik bozulabilir → en az kontrolü)
    expect(s.totals.placed + s.totals.vacant).toBeGreaterThanOrEqual(s.totals.quota);
    expect(s.byBranch.length).toBeGreaterThan(35);
  });
  it("tusBranches kontenjan toplamına göre sıralar ve etiketleri Türkçe başlık hâlinde verir", () => {
    const all = (summary as unknown as { periods: Parameters<typeof tusBranches>[0] }).periods;
    const b = tusBranches(all);
    expect(b.length).toBeGreaterThan(35);
    for (let i = 1; i < b.length; i++) expect(b[i].quota).toBeLessThanOrEqual(b[i - 1].quota);
    expect(b.find((x) => x.branch === "İÇ HASTALIKLARI")?.branchLabel).toBe("İç Hastalıkları");
  });
});
