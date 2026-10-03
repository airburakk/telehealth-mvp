// AI özeti gece üretimi SAYACI (lib/ai-summary-batch, v6.319 — 2026-10-03).
// Arka plan: cron `generate-ai-summaries` 02.10 ve 03.10'da `hata=11` yazdı; üretimde salt-okur sınıflandırma 11'in hiçbirinin
// AI çağrısı olmadığını gösterdi (6 RG PDF + 5 gövdesiz medscape/ttb sayfası). Yapısal atlama gerçek hatadan ayrılmazsa gerçek bir
// arıza sabit sayının içinde gizlenir. Bu test biçimi + sayacı kilitler; ikinci blok yeni durumun ARAYÜZDE de çizildiğini kilitler.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AI_SUMMARY_SKIPS, atlananToplam, emptyAiSummaryBatch, formatAiSummaryBatch, hataEkle } from "@/lib/ai-summary-batch";

describe("formatAiSummaryBatch — denetim satırı", () => {
  it("yalnız başarı: eski satırlarla aynı baş, sıfır sayaç yazılmaz", () => {
    const r = emptyAiSummaryBatch(40);
    r.basarili = 40;
    expect(formatAiSummaryBatch(r)).toBe("ozet=40/40");
  });

  it("yapısal atlama sabit sırada (pdf · govdesiz · ozetsiz), gerçek hata kaynak kırılımıyla en sonda", () => {
    const r = emptyAiSummaryBatch(73);
    r.basarili = 62;
    r.atlanan.pdf = 6;
    r.atlanan.govdesiz = 3;
    hataEkle(r, "medscape");
    hataEkle(r, "ttb");
    hataEkle(r, "medscape");
    expect(formatAiSummaryBatch(r)).toBe("ozet=62/73 pdf=6 govdesiz=3 hata=3 (medscape 2 · ttb 1)");
    expect(atlananToplam(r)).toBe(9);
  });

  it("03.10 üretim örneği: 11 yapısal atlama → hata=0 → satırda hata YOK", () => {
    const r = emptyAiSummaryBatch(73);
    r.basarili = 62;
    r.atlanan.pdf = 6;
    r.atlanan.govdesiz = 5;
    expect(formatAiSummaryBatch(r)).toBe("ozet=62/73 pdf=6 govdesiz=5");
    expect(r.hata).toBe(0);
  });

  it("kaynak kırılımı adede göre azalan, eşitlikte ada göre; boş/eksik kaynak '?' altında", () => {
    const r = emptyAiSummaryBatch(5);
    for (const s of ["ttb", "medscape", "ttb", "", null, "aa"]) hataEkle(r, s);
    expect(formatAiSummaryBatch(r)).toBe("ozet=0/5 hata=6 (? 2 · ttb 2 · aa 1 · medscape 1)");
  });

  it("ozetsiz (akademik abstract yok) ayrı sayılır; emptyAiSummaryBatch her çağrıda yeni nesne verir", () => {
    const a = emptyAiSummaryBatch();
    const b = emptyAiSummaryBatch();
    a.atlanan.ozetsiz = 2;
    expect(b.atlanan.ozetsiz).toBe(0);
    expect(formatAiSummaryBatch(a)).toBe("ozet=0/0 ozetsiz=2");
    expect(AI_SUMMARY_SKIPS).toEqual(["pdf", "govdesiz", "ozetsiz"]);
  });
});

describe("RegulationResult durumları ↔ arayüz + sayaç (kaynak kilidi)", () => {
  const root = process.cwd();
  const lib = readFileSync(join(root, "src/lib/doctorium.ts"), "utf8");
  const page = readFileSync(join(root, "src/app/doktor/doctorium/[id]/page.tsx"), "utf8");

  it("ensureRegulationSummary'nin 'ok' dışı her durumu detay sayfasında ayrı bir blokla çizilir", () => {
    const typeBlock = lib.slice(lib.indexOf("export type RegulationResult ="), lib.indexOf("export async function ensureRegulationSummary"));
    const states = [...typeBlock.matchAll(/state: "([a-z-]+)"/g)].map((m) => m[1]);
    expect(states).toContain("no-text"); // v6.319: sayfa okundu, gövde yok
    expect(states).toContain("unavailable");
    expect(states).toContain("pdf");
    for (const s of states.filter((x) => x !== "ok")) {
      expect(page, `[id]/page.tsx '${s}' durumunu çizmiyor`).toContain(`reg?.state === "${s}"`);
    }
  });

  it("gece sayacı pdf → pdf, no-text → govdesiz, kalan → gerçek hata (kaynak kırılımlı)", () => {
    const fn = lib.slice(lib.indexOf("export async function generatePendingAiSummaries"));
    expect(fn).toMatch(/s\.state === "pdf"\) sonuc\.atlanan\.pdf\+\+/);
    expect(fn).toMatch(/s\.state === "no-text"\) sonuc\.atlanan\.govdesiz\+\+/);
    expect(fn).toMatch(/else hataEkle\(sonuc, r\.source\)/);
  });

  it("'no-text' hata değil: arayüz 'sonra yenileyin' demez ve uyarı üçgeni kullanmaz", () => {
    const start = page.indexOf('reg?.state === "no-text"');
    const block = page.slice(start, page.indexOf('reg?.state === "unavailable"', start));
    expect(block).toContain("özetlenecek metin yok");
    expect(block).not.toContain("yenilediğinizde");
    expect(block).not.toContain("<AlertTriangle");
  });
});
