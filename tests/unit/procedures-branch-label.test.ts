// Birim — işlem kataloğu branş etiketi TEK KAYNAK (2026-10-02). Olay: v6.301 "estetik" etiketini yalnız lib/triage'da
// değiştirdi; lib/procedures BRANCH_LABELS (procedures.json) eski "Estetik Cerrahi"de kaldı → (1) beş kayıt/profil formu eski
// etiketi gösterdi ve kayıt API'leri yalnız onu kabul etti, (2) `branchKeyFromLabel(<güncel etiket>)` null döndü: o branşın
// işlem kataloğu, AI işlem önerisi ve ICD/LOINC ipuçları güncel etiketli doktor/vakada SESSİZCE boş kaldı (canlı teyitte bulundu).
// Sözleşme: etiket lib/triage BRANCHES'ten türetilir; katalog JSON'u da aynı etiketi taşır; eski etiket takma adla çözülür.
import { describe, it, expect } from "vitest";
import catalog from "@/data/procedures.json";
import { BRANCHES, BRANCH_LABEL_ALIASES } from "@/lib/triage";
import { BRANCH_LABELS, branchKeyFromLabel, branchLabel, getBranchProcedures } from "@/lib/procedures";
import { icd10ForBranchLabel, loincForBranchLabel } from "@/data/coding";

const NEW = "Plastik, Rekonstrüktif ve Estetik Cerrahi";
const OLD = "Estetik Cerrahi";
const RAW: Record<string, string> = catalog.branchLabels;
const TRIAGE: Record<string, string> = Object.fromEntries(BRANCHES.map((b) => [b.key, b.label]));

describe("işlem kataloğu branş etiketi — tek kaynak lib/triage", () => {
  it("BRANCH_LABELS her anahtarda triyaj etiketini taşır; triyajda karşılığı olmayan tek anahtar 'others'", () => {
    const orphan = Object.keys(BRANCH_LABELS).filter((k) => TRIAGE[k] === undefined);
    expect(orphan).toEqual(["others"]);
    for (const [key, label] of Object.entries(BRANCH_LABELS)) {
      if (key !== "others") expect(label, key).toBe(TRIAGE[key]);
    }
    expect(BRANCH_LABELS.estetik).toBe(NEW);
  });

  it("katalog JSON'u da güncel etiketi taşır (veri ↔ kod sürüklenmesi yok)", () => {
    for (const [key, label] of Object.entries(RAW)) {
      if (TRIAGE[key] !== undefined) expect(label, `procedures.json branchLabels.${key}`).toBe(TRIAGE[key]);
    }
  });

  it("kayıt/profil formlarının seçenek listesi: güncel etiket bir kez, eski takma adlar YOK, çift etiket YOK", () => {
    const options = Object.values(BRANCH_LABELS);
    expect(options.filter((l) => l === NEW)).toHaveLength(1);
    for (const alias of Object.keys(BRANCH_LABEL_ALIASES)) expect(options, alias).not.toContain(alias);
    expect(new Set(options).size).toBe(options.length);
  });

  it("branchKeyFromLabel: güncel etiket, eski takma ad ve diğer branşlar anahtara çözülür; tanınmayan → null", () => {
    expect(branchKeyFromLabel(NEW)).toBe("estetik");
    expect(branchKeyFromLabel(OLD)).toBe("estetik");
    expect(branchKeyFromLabel("Kardiyoloji")).toBe("kardiyoloji");
    expect(branchKeyFromLabel("kardiyoloji")).toBe("kardiyoloji"); // esnek (normalize) eşleme korunur
    expect(branchKeyFromLabel("Olmayan Dal")).toBeNull();
    expect(branchKeyFromLabel(null)).toBeNull();
    expect(branchKeyFromLabel("Acil Tıp")).toBeNull(); // doktor-only branş katalogda yok
  });

  it("katalogda olan her güncel triyaj etiketi kendi anahtarına çözülür", () => {
    for (const b of BRANCHES) {
      if (RAW[b.key] === undefined) continue;
      expect(branchKeyFromLabel(b.label), b.label).toBe(b.key);
    }
  });

  it("güncel etiketli kayıt işlem kataloğuna ve kodlama ipuçlarına ulaşır (v6.301 sonrası sessiz boşluk)", () => {
    const key = branchKeyFromLabel(NEW);
    expect(key).toBe("estetik");
    expect(getBranchProcedures(key as string).length).toBeGreaterThan(0);
    expect(icd10ForBranchLabel(NEW).length).toBeGreaterThan(0);
    expect(icd10ForBranchLabel(NEW)).toEqual(icd10ForBranchLabel(OLD));
    expect(loincForBranchLabel(NEW)).toEqual(loincForBranchLabel(OLD));
  });

  it("branchLabel(key) güncel etiketi verir; bilinmeyen anahtar aynen döner", () => {
    expect(branchLabel("estetik")).toBe(NEW);
    expect(branchLabel("others")).toBe(RAW.others);
    expect(branchLabel("yok-boyle-anahtar")).toBe("yok-boyle-anahtar");
  });
});
