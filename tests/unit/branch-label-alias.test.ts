// Birim testleri — branş etiketi değişimi + eski etiket takma adları (2026-09-29, 👤 "Estetik Cerrahi" →
// "Plastik, Rekonstrüktif ve Estetik Cerrahi"). Sözleşme: etiket VERİDİR (Doctor/Case/Recovery… `branch` kolonu) →
// eski dize BRANCH_LABEL_ALIASES ile tanınmaya devam eder; etiketle indeksli haritalar (NEWS_QUERIES, demo profil)
// GÜNCEL etiketi taşır; slugForLabel/second-opinion/vaka listesi çözümleyicileri eski kaydı da anahtara bağlar.
import { describe, it, expect } from "vitest";
import { BRANCHES, BRANCH_LABEL_ALIASES, branchKeyForLabel, canonicalBranchLabel } from "@/lib/triage";
import { slugForLabel, branchLabel } from "@/lib/doctorium";
import { NEWS_QUERIES } from "@/lib/medical-news";

const NEW = "Plastik, Rekonstrüktif ve Estetik Cerrahi";
const OLD = "Estetik Cerrahi";

describe("branş etiketi: Plastik, Rekonstrüktif ve Estetik Cerrahi", () => {
  it("BRANCHES 'estetik' anahtarının etiketi TUK resmî dal adıdır; eski etiket listede YOK", () => {
    const b = BRANCHES.find((x) => x.key === "estetik");
    expect(b?.label).toBe(NEW);
    expect(BRANCHES.some((x) => x.label === OLD)).toBe(false);
    expect(b?.doctorOnly).toBeFalsy(); // hasta yüzeyinde de aynı etiket (👤: her yüzeyde tek etiket)
  });

  it("takma ad: eski etiket → anahtar; güncel etiket → anahtar; tanınmayan → null", () => {
    expect(BRANCH_LABEL_ALIASES[OLD]).toBe("estetik");
    expect(branchKeyForLabel(OLD)).toBe("estetik");
    expect(branchKeyForLabel(NEW)).toBe("estetik");
    expect(branchKeyForLabel("Kardiyoloji")).toBe("kardiyoloji");
    expect(branchKeyForLabel("Olmayan Dal")).toBeNull();
    expect(branchKeyForLabel(null)).toBeNull();
  });

  it("canonicalBranchLabel: eski → güncel; güncel ve tanınmayan aynen", () => {
    expect(canonicalBranchLabel(OLD)).toBe(NEW);
    expect(canonicalBranchLabel(NEW)).toBe(NEW);
    expect(canonicalBranchLabel("Kardiyoloji")).toBe("Kardiyoloji");
    expect(canonicalBranchLabel("")).toBe("");
  });

  it("her takma ad var olan bir anahtara işaret eder (ölü takma ad yok)", () => {
    const keys = new Set(BRANCHES.map((b) => b.key));
    for (const [alias, key] of Object.entries(BRANCH_LABEL_ALIASES)) {
      expect(keys.has(key), `${alias} → ${key}`).toBe(true);
      expect(BRANCHES.some((b) => b.label === alias), `${alias} hâlâ güncel etiket olmamalı`).toBe(false);
    }
  });

  it("Doctorium slugForLabel eski etiketli doktor kaydını da çözer; branchLabel güncel etiketi verir", () => {
    expect(slugForLabel(OLD)).toBe("estetik");
    expect(slugForLabel(NEW)).toBe("estetik");
    expect(branchLabel("estetik")).toBe(NEW);
  });

  it("NEWS_QUERIES güncel etiketle indekslidir (PubMed sorgusu kaybolmaz)", () => {
    expect(NEWS_QUERIES[NEW]).toBe("surgery, plastic[mh]");
    expect(NEWS_QUERIES[OLD]).toBeUndefined();
  });
});
