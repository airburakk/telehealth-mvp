// Kariyer bölümleme (2026-09-06): öğrenci Kariyer alt-sekmeleri (Fırsatlar | TUS), TUS bölümleri (?bolum=), EDU tür süzgeci (?tur=).
import { describe, it, expect } from "vitest";
import { STUDENT_CAREER_TABS } from "@/lib/doctorium";
import { TUS_SECTIONS, TUS_HREF, parseTusSection, resolveTusSection, tusSectionHref } from "@/lib/tus";
import { EDU_KINDS, EDU_KIND_SHORT, EDU_KIND_LABEL, parseEduKind, resolveEduKind } from "@/lib/edu-opportunities";

describe("Kariyer bölümleme", () => {
  it("öğrenci Kariyer çubuğu: Fırsatlar | TUS — Fırsatlar akış sayfasında, TUS ayrı rotada", () => {
    expect(STUDENT_CAREER_TABS.map((t) => t.label)).toEqual(["Fırsatlar", "TUS"]);
    expect(STUDENT_CAREER_TABS[0].href).toBe("/doktor/doctorium?m=kariyer");
    expect(STUDENT_CAREER_TABS[1].href).toBe(TUS_HREF);
  });

  it("TUS üç bölüm: Veriler (varsayılan) · Rehberler · Sınav dönemleri; kanonik URL tek (varsayılan bolum'suz)", () => {
    expect(TUS_SECTIONS.map((s) => s.key)).toEqual(["veriler", "rehberler", "donemler"]);
    expect(TUS_SECTIONS.map((s) => s.label)).toEqual(["Veriler", "Rehberler", "Sınav dönemleri"]);
    expect(parseTusSection("rehberler")).toBe("rehberler");
    expect(parseTusSection("donemler")).toBe("donemler");
    expect(parseTusSection("yok-boyle")).toBe("veriler");
    expect(parseTusSection(undefined)).toBe("veriler");
    expect(tusSectionHref("veriler")).toBe(TUS_HREF);
    expect(tusSectionHref("rehberler")).toBe(`${TUS_HREF}?bolum=rehberler`);
    // Özelleştir açılış tercihi (2026-09-06): tercih edilen bölüm bolum'suz, Veriler artık ?bolum= taşır; param tercihi ezer
    expect(tusSectionHref("rehberler", "rehberler")).toBe(TUS_HREF);
    expect(tusSectionHref("veriler", "rehberler")).toBe(`${TUS_HREF}?bolum=veriler`);
    expect(resolveTusSection(undefined, "donemler")).toBe("donemler");
    expect(resolveTusSection("veriler", "donemler")).toBe("veriler");
    expect(resolveTusSection("yok-boyle", "rehberler")).toBe("rehberler");
    for (const s of TUS_SECTIONS) expect(s.desc.length).toBeGreaterThan(10);
  });

  it("EDU tür süzgeci: üç tür, kısa çip etiketi, bilinmeyen değer süzgeçsiz", () => {
    expect(EDU_KINDS).toEqual(["staj", "degisim", "burs"]);
    expect(EDU_KIND_SHORT).toEqual({ staj: "Staj", degisim: "Değişim Programları", burs: "Burs" }); // 👤 2026-09-06: D ve P büyük
    for (const k of EDU_KINDS) expect(EDU_KIND_LABEL[k]).toBeTruthy();
    expect(parseEduKind("burs")).toBe("burs");
    expect(parseEduKind("staj")).toBe("staj");
    expect(parseEduKind("hepsi")).toBeNull();
    expect(parseEduKind(undefined)).toBeNull();
    // Açılış tercihi (2026-09-06): param yoksa tercih; "hepsi" tercihi kaldırır; geçerli tür kazanır
    expect(resolveEduKind(undefined, "burs")).toBe("burs");
    expect(resolveEduKind("hepsi", "burs")).toBeNull();
    expect(resolveEduKind("staj", "burs")).toBe("staj");
    expect(resolveEduKind("bilinmez", null)).toBeNull();
  });

  it("metinlerde 'hekim' yok", () => {
    const blob = JSON.stringify([STUDENT_CAREER_TABS, TUS_SECTIONS, EDU_KIND_SHORT]);
    expect(blob.toLocaleLowerCase("tr-TR")).not.toContain("hekim");
  });
});
