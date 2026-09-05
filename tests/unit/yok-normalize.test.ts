// YÖK Atlas normalizasyonu (K5) — saf dönüşüm + özet sözleşmesi.
import { describe, it, expect } from "vitest";
import { classifyUniType, isTipProgram, normalizeRow, parseScore, summarizeYok, type YokAtlasRaw } from "@/lib/yok-normalize";

const raw = (o: Partial<YokAtlasRaw> = {}): YokAtlasRaw => ({
  kilavuzKodu: 104810626, yil: 2026, birimGrupAdi: "Tıp", universiteAdi: "HACETTEPE ÜNİVERSİTESİ (ANKARA) ", universiteTuru: "DEVLET", ilAdi: "ANKARA",
  fymkAdi: "TIP FAKÜLTESİ", birimAdi: "Tıp (İngilizce)", ogrenimDiliAdi: "İngilizce", bursOraniAdi: null, ogrenimSuresi: 6,
  kontenjan: 175, gkY: 175, minPuan: 541.38019, basariSirasi: 965,
  gk1: 175, minPuan1: "534.82259", basariSirasi1: 1169, gk2: 175, minPuan2: "537.19919", basariSirasi2: 1242, gk3: 170, minPuan3: "0", basariSirasi3: null,
  prof: 302, doc: 75, dou: 143, ogrGor: null, arGor: 274, akreditasyon: "TEPDAD", ...o,
});

describe("yok-normalize", () => {
  it("parseScore: sayı, virgüllü/noktalı string, '0' ve null → null", () => {
    expect(parseScore(541.38)).toBe(541.38);
    expect(parseScore("534.82259")).toBeCloseTo(534.82259, 5);
    expect(parseScore("534,5")).toBe(534.5);
    expect(parseScore("0")).toBeNull(); expect(parseScore(0)).toBeNull(); expect(parseScore(null)).toBeNull(); expect(parseScore(undefined)).toBeNull();
  });
  it("classifyUniType: DEVLET/VAKIF/KKTC, gerisi YURTDISI", () => {
    expect(classifyUniType("DEVLET")).toBe("DEVLET"); expect(classifyUniType("VAKIF")).toBe("VAKIF"); expect(classifyUniType("KKTC")).toBe("KKTC");
    expect(classifyUniType("YURTDIŞI")).toBe("YURTDISI"); expect(classifyUniType(null)).toBe("YURTDISI");
  });
  it("isTipProgram yalnız tam eşleşme", () => {
    expect(isTipProgram({ birimGrupAdi: "Tıp" })).toBe(true);
    expect(isTipProgram({ birimGrupAdi: "Tıp Mühendisliği" })).toBe(false);
    expect(isTipProgram({})).toBe(false);
  });
  it("normalizeRow: kimlik, tarihçe (string puan → sayı, '0' → null), öğretim elemanı, kırpma", () => {
    const r = normalizeRow(raw());
    expect(r.code).toBe(104810626); expect(r.university).toBe("HACETTEPE ÜNİVERSİTESİ (ANKARA)"); expect(r.type).toBe("DEVLET");
    expect(r.quota).toBe(175); expect(r.placed).toBe(175); expect(r.minScore).toBeCloseTo(541.38019, 5); expect(r.rank).toBe(965);
    expect(r.history.map((h) => h.yearsBack)).toEqual([1, 2, 3]);
    expect(r.history[0]).toEqual({ yearsBack: 1, quota: 175, minScore: expect.closeTo(534.82259, 5), rank: 1169 });
    expect(r.history[2]).toEqual({ yearsBack: 3, quota: 170, minScore: null, rank: null });
    expect(r.staff).toEqual({ prof: 302, doc: 75, dou: 143, ogrGor: 0, arGor: 274 });
    expect(r.accreditation).toBe("TEPDAD"); expect(r.scholarship).toBeNull();
    const bare = normalizeRow(raw({ prof: null, doc: null, dou: null, ogrGor: null, arGor: null, akreditasyon: "", kontenjan: null, gkY: null }));
    expect(bare.staff).toBeNull(); expect(bare.accreditation).toBeNull(); expect(bare.quota).toBe(0); expect(bare.placed).toBe(0);
  });
  it("summarizeYok: toplamlar, tür kırılımı, yıllara göre kontenjan (yıl − 3 … yıl), il listesi, başarı sırası istatistiği", () => {
    const rows = [
      normalizeRow(raw()),
      normalizeRow(raw({ kilavuzKodu: 2, universiteAdi: "X ÜNİVERSİTESİ", universiteTuru: "VAKIF", ilAdi: "İSTANBUL", bursOraniAdi: "Burslu", kontenjan: 10, gkY: 9, basariSirasi: 3000, gk1: 8, gk2: 8, gk3: null, akreditasyon: null })),
      normalizeRow(raw({ kilavuzKodu: 3, universiteAdi: "Y ÜNİVERSİTESİ", universiteTuru: "DEVLET", ilAdi: "İZMİR", fymkAdi: "TIP FAKÜLTESİ", kontenjan: 100, gkY: 100, basariSirasi: 5000 })),
    ];
    const s = summarizeYok(2026, rows);
    expect(s.programs).toBe(3); expect(s.universities).toBe(3); expect(s.faculties).toBe(3);
    expect(s.totals).toEqual({ quota: 285, placed: 284, vacant: 1 });
    expect(s.byType.map((t) => [t.type, t.programs, t.quota])).toEqual([["DEVLET", 2, 275], ["VAKIF", 1, 10]]);
    expect(s.quotaByYear.map((q) => q.year)).toEqual([2023, 2024, 2025, 2026]);
    expect(s.quotaByYear[0]).toEqual({ year: 2023, quota: 340, programs: 2 }); // gk3: 170 + 170 (X'te null → sayılmaz)
    expect(s.quotaByYear[3]).toEqual({ year: 2026, quota: 285, programs: 3 });
    expect(s.rankStats.find((r) => r.type === "DEVLET")).toEqual({ type: "DEVLET", n: 2, min: 965, median: 2982.5, max: 5000 });
    expect(s.accredited).toBe(2);
    expect(s.byCity[0]).toEqual({ city: "ANKARA", quota: 175, programs: 1 });
  });
});
