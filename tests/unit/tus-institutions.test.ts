// TUS kurum tablosu (K2) — saf birleştirici: branş süzgeci, 3 dönem eğilimi (kod → yedek kurum+branş eşlemesi), ek yerleştirme, süzgeç/sıralama.
import { describe, it, expect } from "vitest";
import { buildInstitutionTable, parseInstitutionType, parseQuotaType, parseSort, summarizeInstitutionTable } from "@/lib/tus-institutions";
import type { TusRow } from "@/lib/tus-normalize";

const row = (o: Partial<TusRow>): TusRow => ({
  code: "100", institution: "Ankara Üniversitesi Tıp Fakültesi", institutionType: "UNIVERSITE", branch: "İÇ HASTALIKLARI", branchLabel: "İç Hastalıkları",
  quotaType: "GENEL", quota: 10, placed: 10, vacant: 0, minScore: 60, maxScore: 70, ...o,
});

describe("tus-institutions", () => {
  const cur = [
    row({ code: "100", institution: "Ankara Üniversitesi Tıp Fakültesi", minScore: 61.5 }),
    row({ code: "200", institution: "Hacettepe Üniversitesi Tıp Fakültesi", minScore: 64.2, quota: 12, placed: 12 }),
    row({ code: "300", institution: "SBÜ Ankara Eğitim ve Araştırma Hastanesi", institutionType: "SBU_EAH", minScore: 58.1, quota: 8, placed: 6, vacant: 2 }),
    row({ code: "300", institution: "SBÜ Ankara Eğitim ve Araştırma Hastanesi", institutionType: "SBU_EAH", quotaType: "YABANCI", minScore: null, quota: 1, placed: 0, vacant: 1 }),
    row({ code: "900", institution: "X", branch: "KARDİYOLOJİ", branchLabel: "Kardiyoloji" }),
  ];
  const H = "Hacettepe Üniversitesi Tıp Fakültesi";
  const prev2 = [row({ code: "100", minScore: 59.0 }), row({ code: "200", institution: H, minScore: 62.0 })]; // en eski
  const prev1 = [row({ code: "101", institution: "Ankara Üniversitesi Tıp Fakültesi", minScore: 60.4 }), row({ code: "200", institution: H, minScore: 63.1 })]; // Ankara'nın kodu değişmiş → kurum+branş ile eşleşir
  const ek = [row({ code: "300", institution: "SBÜ Ankara Eğitim ve Araştırma Hastanesi", institutionType: "SBU_EAH", quota: 2, placed: 2, vacant: 0, minScore: 55.5, maxScore: 57 })];

  it("branşa süzer, en küçük puana göre azalan sıralar, eğilim eskiden yeniye (kod → yedek eşleme), ek yerleştirmeyi bağlar", () => {
    const t = buildInstitutionTable("İÇ HASTALIKLARI", cur, [prev2, prev1], ek);
    expect(t.map((r) => r.code)).toEqual(["200", "100", "300", "300"]); // 64.2 · 61.5 · 58.1 · null (sona)
    expect(t[1].trend).toEqual([59.0, 60.4, 61.5]);
    expect(t[0].trend).toEqual([62.0, 63.1, 64.2]);
    expect(t[2].ek).toEqual({ quota: 2, placed: 2, vacant: 0, minScore: 55.5, maxScore: 57 });
    expect(t[3].ek).toBeNull(); // YABANCI satırına GENEL ek eşlenmez
    expect(t[0].ek).toBeNull();
    expect(t.some((r) => r.code === "900")).toBe(false);
  });
  it("süzgeçler: kurum türü, kontenjan türü, arama (tr küçük harf); sıralamalar", () => {
    expect(buildInstitutionTable("İÇ HASTALIKLARI", cur, [], null, { type: "SBU_EAH" }).length).toBe(2);
    expect(buildInstitutionTable("İÇ HASTALIKLARI", cur, [], null, { quotaType: "YABANCI" }).length).toBe(1);
    expect(buildInstitutionTable("İÇ HASTALIKLARI", cur, [], null, { q: "HACETTEPE" }).map((r) => r.code)).toEqual(["200"]);
    expect(buildInstitutionTable("İÇ HASTALIKLARI", cur, [], null, { sort: "quota" })[0].code).toBe("200");
    expect(buildInstitutionTable("İÇ HASTALIKLARI", cur, [], null, { sort: "vacant" })[0].vacant).toBe(2);
    expect(buildInstitutionTable("İÇ HASTALIKLARI", cur, [], null, { sort: "name" })[0].institution).toMatch(/^Ankara/);
    // geçmiş dönem yokken eğilim tek elemanlı
    expect(buildInstitutionTable("İÇ HASTALIKLARI", cur, [], null)[0].trend).toEqual([64.2]);
  });
  it("özet ve URL ayrıştırıcılar", () => {
    const t = buildInstitutionTable("İÇ HASTALIKLARI", cur, [], ek);
    expect(summarizeInstitutionTable(t)).toEqual({ institutions: 3, programs: 4, quota: 31, placed: 28, vacant: 3, ekPlaced: 2, withEk: 1 });
    expect(parseInstitutionType("SBU_EAH")).toBe("SBU_EAH"); expect(parseInstitutionType("x")).toBe("ALL"); expect(parseInstitutionType(undefined)).toBe("ALL");
    expect(parseQuotaType("YABANCI")).toBe("YABANCI"); expect(parseQuotaType("hepsi")).toBe("ALL");
    expect(parseSort("name")).toBe("name"); expect(parseSort("zzz")).toBe("min");
  });
});
