// Haber kaynaklarının dil profili — çeviri kapsamı + seçki önceliği sözleşmesi (2026-09-02).
//
// Kilitlenen kararlar (kullanıcı, 2026-09-02 akşam):
//   1) İlaç modülü kaynağa bakmaksızın çevrilir (openFDA/ClinicalTrials İngilizce doğar).
//   2) Sektörelde YALNIZ İngilizce doğan kaynaklar (Medscape/Medical Xpress/WHO) çevrilir; Türkçe
//      doğan kurum/dernek beslemeleri çeviriden geçmez (gereksiz LLM + tekrar-çeviri riski).
//   3) Küme ile kaynak tabloları TUTARLI olmalı: genel medya beslemesi eklenip küme unutulursa
//      İngilizce başlık bültene sızar — bu test onu yakalar.
import { describe, it, expect } from "vitest";
import {
  FOREIGN_LANGUAGE_SOURCES, TRANSLATED_MODULES, needsTitleTranslation, needsSummaryTranslation,
  summaryTranslationWhere, isNativeTurkishSource,
} from "@/lib/news-language";
import { RSS_SOURCES, ASSOCIATION_RSS_SOURCES } from "@/lib/doctorium-sources";

describe("needsTitleTranslation: ingest çeviri kapısı", () => {
  it("ilaç modülü kaynağa bakmaksızın çevrilir", () => {
    expect(needsTitleTranslation({ module: "ilac", source: "clinicaltrials" })).toBe(true);
    expect(needsTitleTranslation({ module: "ilac", source: "herhangi" })).toBe(true);
  });
  it("sektörelde İngilizce doğan kaynaklar çevrilir", () => {
    for (const s of ["medscape", "medicalxpress", "who"]) {
      expect(needsTitleTranslation({ module: "sektorel", source: s })).toBe(true);
    }
  });
  it("Türkçe doğan kaynaklar çeviriden GEÇMEZ (RG/SGK/OHSAD/TTB/İTO/dernek)", () => {
    for (const s of ["resmi-gazete", "sgk", "ohsad", "ttb", "istabip", "klimik", "tjod"]) {
      expect(needsTitleTranslation({ module: "sektorel", source: s })).toBe(false);
      expect(needsTitleTranslation({ module: "mevzuat", source: s })).toBe(false);
    }
  });
  it("akademik hat bu kapıdan geçmez (kendi toplu çevirisi doctorium-ingest'te)", () => {
    expect(needsTitleTranslation({ module: "akademik", source: "pubmed" })).toBe(false);
  });
});

describe("kaynak tabloları ↔ dil kümesi tutarlılığı (sözleşme)", () => {
  it("genel medya RSS kaynaklarının HEPSİ yabancı kümesindedir — yeni İngilizce besleme kümeye de eklenmeli", () => {
    for (const def of RSS_SOURCES) expect(FOREIGN_LANGUAGE_SOURCES.has(def.source)).toBe(true);
  });
  it("uzmanlık dernekleri Türkçe doğar — hiçbiri yabancı kümesinde değildir", () => {
    for (const def of ASSOCIATION_RSS_SOURCES) {
      expect(isNativeTurkishSource(def.source)).toBe(true);
    }
  });
  it("isNativeTurkishSource kümenin tam tersidir", () => {
    expect(isNativeTurkishSource("medscape")).toBe(false);
    expect(isNativeTurkishSource("ttb")).toBe(true);
  });
});

// v6.206 — ÖZET girişi çevirisi kapsamı (api/cron/translate-news). Başlık kuralından farkı: akademik dahil.
describe("needsSummaryTranslation + summaryTranslationWhere: özet çeviri kapsamı", () => {
  it("akademik ve ilaç modülü kaynağa bakmaksızın; sektörelde yalnız İngilizce doğanlar", () => {
    expect(needsSummaryTranslation({ module: "akademik", source: "pubmed" })).toBe(true);
    expect(needsSummaryTranslation({ module: "akademik", source: "doaj" })).toBe(true);
    expect(needsSummaryTranslation({ module: "ilac", source: "openfda-drug" })).toBe(true);
    for (const s of ["medscape", "medicalxpress", "who"]) {
      expect(needsSummaryTranslation({ module: "sektorel", source: s })).toBe(true);
    }
  });
  it("Türkçe doğan kaynaklar ve hukuk (içtihat/doktrin) SEÇİLMEZ", () => {
    for (const s of ["resmi-gazete", "sgk", "ohsad", "ttb", "istabip", "yargitay", "trdizin"]) {
      expect(needsSummaryTranslation({ module: "sektorel", source: s })).toBe(false);
      expect(needsSummaryTranslation({ module: "mevzuat", source: s })).toBe(false);
    }
  });
  it("başlık kapsamı özet kapsamının ALT KÜMESİDİR — başlığı çevrilen her kaynağın özeti de çevrilir", () => {
    const ornekler = [
      { module: "ilac", source: "clinicaltrials" }, { module: "sektorel", source: "who" },
      { module: "sektorel", source: "ttb" }, { module: "akademik", source: "europepmc" },
    ];
    for (const a of ornekler) if (needsTitleTranslation(a)) expect(needsSummaryTranslation(a)).toBe(true);
  });
  it("SQL süzgeci fonksiyonla aynı kümeyi tarif eder; işlenmişi (summaryOriginal dolu) ve boş özeti dışlar", () => {
    const w = summaryTranslationWhere();
    expect(w.summaryOriginal).toBeNull();
    expect(w.summary).toEqual({ not: "" });
    const or = w.OR as { module?: { in: string[] }; source?: { in: string[] } }[];
    expect(or).toHaveLength(2);
    expect(or[0].module?.in).toEqual([...TRANSLATED_MODULES]);
    expect(new Set(or[1].source?.in)).toEqual(FOREIGN_LANGUAGE_SOURCES);
  });
});
