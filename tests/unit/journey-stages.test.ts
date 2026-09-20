// Birim — lib/journey-stages (kontrol raporu 2026-09-17 H09, v6.283): ücretsiz kulvarın sahne sözlüğünde "ödeme"
// GEÇMEZ (sayfa "tamamen ücretsiz" diyor); sağlık turizmi ödemesiz "Onay" korunur; N/A sahne kalmadı.
import { describe, it, expect } from "vitest";
import { JOURNEY_STAGES, JOURNEY_SKIP_STAGES } from "@/lib/journey-stages";

describe("JOURNEY_STAGES", () => {
  it("FREE_CARE: ödeme kelimesi yok, 'Başvuru & Onay' gerçek adım, atlanan sahne yok", () => {
    expect(JOURNEY_STAGES.FREE_CARE.join(" ")).not.toMatch(/ödeme/i);
    expect(JOURNEY_STAGES.FREE_CARE).toContain("Başvuru & Onay");
    expect(JOURNEY_SKIP_STAGES.FREE_CARE).toEqual([]);
  });
  it("HEALTH_TOURISM ödemesiz 'Onay' (2026-07-23 kararı), GENERAL/SECOND_OPINION ödeme sahnesi taşır", () => {
    expect(JOURNEY_STAGES.HEALTH_TOURISM).toContain("Onay");
    expect(JOURNEY_STAGES.HEALTH_TOURISM.join(" ")).not.toMatch(/ödeme/i);
    expect(JOURNEY_STAGES.GENERAL[0]).toBe("Onay & Ödeme");
    expect(JOURNEY_STAGES.SECOND_OPINION[0]).toBe("Başvuru & Ödeme");
  });
  it("her kulvarın atlanan sahne indeksleri sahne sayısı içinde", () => {
    for (const k of Object.keys(JOURNEY_STAGES) as (keyof typeof JOURNEY_STAGES)[]) {
      for (const i of JOURNEY_SKIP_STAGES[k]) expect(i).toBeLessThan(JOURNEY_STAGES[k].length);
    }
  });
});
