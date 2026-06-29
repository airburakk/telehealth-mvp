// Birim testleri — lib/pricing.ts (Modül 3 fiyatlandırma + 3 kademeli sigorta motoru). Saf, DB yok.
import { describe, it, expect } from "vitest";
import {
  branchRiskMult,
  effectiveInsuranceLevel,
  computeInsurance,
  computePackage,
  tryToUsd,
  formatUSD,
  type PackageSelection,
} from "@/lib/pricing";

describe("branchRiskMult", () => {
  it("yüksek riskli branşları doğru çarpar", () => {
    expect(branchRiskMult("Onkoloji")).toBe(1.8);
    expect(branchRiskMult("Kardiyoloji")).toBe(1.6);
  });
  it("düşük riskli branşları substring eşleştirir", () => {
    expect(branchRiskMult("Saç Ekimi")).toBe(0.7); // "Saç" içerir
    expect(branchRiskMult("Diş Tedavisi")).toBe(0.7);
  });
  it("eşleşmeyen branş → 1.0 (nötr)", () => {
    expect(branchRiskMult("Dahiliye")).toBe(1.0);
    expect(branchRiskMult("Bilinmeyen Branş")).toBe(1.0);
  });
});

describe("effectiveInsuranceLevel", () => {
  it("açık insuranceLevel verilmişse o esastır", () => {
    expect(effectiveInsuranceLevel({ insuranceLevel: 3 })).toBe(3);
    expect(effectiveInsuranceLevel({ insuranceLevel: 1, insuranceMalpractice: true })).toBe(1);
  });
  it("eski booleanlardan türetir (geriye uyum)", () => {
    expect(effectiveInsuranceLevel({ insuranceMalpractice: true })).toBe(3);
    expect(effectiveInsuranceLevel({ insuranceExtended: true })).toBe(2);
    expect(effectiveInsuranceLevel({})).toBe(1);
  });
});

describe("computeInsurance", () => {
  it("Seviye 1 → yalnız taban prim (p2=p3=0)", () => {
    const q = computeInsurance({ level: 1, coverageBaseUsd: 10000, treatmentTotalUsd: 5000, branch: "Kardiyoloji" });
    expect(q.p1).toBe(120);
    expect(q.p2).toBe(0);
    expect(q.p3).toBe(0);
    expect(q.total).toBe(120);
  });

  it("Seviye 2 → operasyon teminat primi = taban × r2 × branş riski", () => {
    const q = computeInsurance({ level: 2, coverageBaseUsd: 10000, treatmentTotalUsd: 5000, branch: "Kardiyoloji" });
    // 10000 × 0.025 × 1.6 = 400
    expect(q.p2).toBe(400);
    expect(q.p3).toBe(0);
    expect(q.total).toBe(120 + 400);
  });

  it("Seviye 3 → doktor MMSS boşluğu varsa malpraktis primi eklenir", () => {
    const q = computeInsurance({
      level: 3,
      coverageBaseUsd: 10000,
      treatmentTotalUsd: 5000, // target = 5000×2 = 10000
      branch: "Kardiyoloji",
      doctorMmssLimitUsd: 4000, // gap = 10000 − 4000 = 6000
    });
    expect(q.targetCoverage).toBe(10000);
    expect(q.gap).toBe(6000);
    // p3 = 6000 × 0.04 × 1.6 = 384
    expect(q.p3).toBe(384);
    expect(q.total).toBe(120 + 400 + 384);
  });

  it("Seviye 3 → doktor MMSS hedefi karşılıyorsa boşluk 0 → ek prim yok", () => {
    const q = computeInsurance({
      level: 3,
      coverageBaseUsd: 10000,
      treatmentTotalUsd: 5000, // target = 10000
      branch: "Kardiyoloji",
      doctorMmssLimitUsd: 20000, // hedefi aşıyor → gap 0
    });
    expect(q.gap).toBe(0);
    expect(q.p3).toBe(0);
  });
});

describe("tryToUsd", () => {
  it("₺ → $ dönüştürür (yuvarlanmış)", () => {
    expect(tryToUsd(40000, 40)).toBe(1000);
    expect(tryToUsd(45000, 40)).toBe(1125);
  });
  it("rate 0 → fallback kuru kullanır (bölme-sıfır yok)", () => {
    expect(tryToUsd(40000, 0)).toBe(1000); // TRY_PER_USD=40 fallback
  });
});

describe("computePackage", () => {
  const base: PackageSelection = {
    branch: "Kardiyoloji",
    country: "TR",
    tier: "Standart",
    hotelStars: 4,
    hospitalType: "Özel",
    nights: 5,
    translator: false,
    insuranceLevel: 2,
    insuranceExtended: true,
    insuranceMalpractice: false,
  };

  it("kalemleri ve toplamı deterministik hesaplar", () => {
    const q = computePackage(base);
    // treatment 9000 (Kardiyoloji×Özel 1.0) · hotel 80×5=400 · flight TR 90 · transfer Standart 90 · sigorta 503
    // p2 = (9000+400+90+90)×0.025×1.6 = 9580×0.04 = 383 → sigorta = 120+383 = 503
    expect(q.insurance.p2).toBe(383);
    expect(q.insurance.total).toBe(503);
    expect(q.subtotal).toBe(10083);
    expect(q.platformFee).toBe(1512); // round(10083×0.15)
    expect(q.total).toBe(11595);
  });

  it("toplam = ara toplam + platform komisyonu (değişmez kural)", () => {
    const q = computePackage(base);
    expect(q.total).toBe(q.subtotal + q.platformFee);
    expect(q.platformFee).toBe(Math.round(q.subtotal * 0.15));
    expect(q.currency).toBe("USD");
  });

  it("doktorun tavsiye ettiği tedavi varsa ₺ fiyatı $'a çevrilir", () => {
    const q = computePackage(base, [{ code: "X", name: "Bypass", priceTRY: 40000 }], 40);
    const tx = q.items.find((i) => i.key === "tx-X");
    expect(tx?.amount).toBe(1000); // 40000 / 40
  });
});

describe("formatUSD", () => {
  it("USD biçimlendirir", () => {
    expect(formatUSD(1000)).toContain("1,000");
  });
});
