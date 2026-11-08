import { describe, expect, it } from "vitest";
import { FAMILY_MEDICINE_RESOURCES, FAMILY_MEDICINE_ENTRY_POINTS, FAMILY_MEDICINE_BRANCH, familyMedicineSourceReviewLabels } from "../../src/lib/family-medicine";
import { BRANCHES, PATIENT_BRANCHES } from "../../src/lib/triage";
import { SELECTABLE_SPECIALTY_BRANCHES } from "../../src/lib/specialty-branch";
import { BRANCH_JOURNALS } from "../../src/lib/academic-journals";
import { BRANCH_COLORS } from "../../src/lib/branch-visuals";

describe("family medicine first release", () => {
  it("has a selectable physician specialty without changing patient routing", () => {
    expect(BRANCHES.find(b => b.key === FAMILY_MEDICINE_BRANCH)).toMatchObject({ label: "Aile Hekimliği", doctorOnly: true, keywords: [] });
    expect(SELECTABLE_SPECIALTY_BRANCHES).toContain("Aile Hekimliği");
    expect(PATIENT_BRANCHES.some(b => b.key === FAMILY_MEDICINE_BRANCH)).toBe(false);
    expect(BRANCH_JOURNALS[FAMILY_MEDICINE_BRANCH].length).toBeGreaterThan(0);
    expect(BRANCH_COLORS[FAMILY_MEDICINE_BRANCH]).toBeTruthy();
  });
  it("provides identified HTTPS sources, not copied clinical protocols", () => {
    expect(new Set(FAMILY_MEDICINE_RESOURCES.map(r => r.id)).size).toBe(FAMILY_MEDICINE_RESOURCES.length);
    for (const source of FAMILY_MEDICINE_RESOURCES) {
      expect(new URL(source.url).protocol).toBe("https:");
      expect(source.publisher).toBeTruthy();
      expect(source.description).toBeTruthy();
    }
  });
  it("keeps all workspace navigation in the protected portal", () => {
    for (const entry of FAMILY_MEDICINE_ENTRY_POINTS) expect(entry.href).toMatch(/^\/doktor\/doctorium/);
  });
});

describe("family medicine source review transparency", () => {
  it("does not turn source titles or HTTPS links into verification claims", () => {
    for (const source of FAMILY_MEDICINE_RESOURCES.filter(s => !["report-regulation", "report-repeal", "asm-forms", "hyp", "hyp-versions"].includes(s.id))) {
      expect(source.review.sourceVersion).toEqual({ label: null, verifiedAt: null });
      expect(source.review.technicalCheck.checkedAt).toBeNull();
      expect(source.review.clinicalReview).toEqual({ status: "pending" });
      expect(familyMedicineSourceReviewLabels(source.review)).toEqual({
        version: "Henüz doğrulanmadı", technical: "Henüz yapılmadı", clinical: "Henüz yapılmadı",
      });
    }
  });
  it("tracks the officially linked May2026 HYP revision and its version page without granting clinical approval", () => {
    const source = FAMILY_MEDICINE_RESOURCES.find(s => s.id === "hyp")!;
    const landing = FAMILY_MEDICINE_RESOURCES.find(s => s.id === "hyp-versions")!;
    expect(source.url).toContain("/Rehberler/HYP_TARAMA_VE_TAKIP_KILAVUZU_14042026.pdf");
    expect(source.url).not.toContain("/Yonerge/Ek_Hastalik");
    expect(source.review.sourceVersion).toMatchObject({ label: expect.stringContaining("1 Mayıs 2026"), verifiedAt: "2026-11-08" });
    expect(source.review.technicalCheck.checkedAt).toBe("2026-11-08");
    expect(landing.url).toBe("https://hsgm.saglik.gov.tr/tr/ah-tarama-takip");
    expect(source.review.clinicalReview).toEqual({ status: "pending" });
    expect(landing.review.clinicalReview).toEqual({ status: "pending" });
  });
  it("keeps a technical check separate from source and clinical review", () => {
    expect(familyMedicineSourceReviewLabels({
      sourceVersion: { label: "Test edition", verifiedAt: null },
      technicalCheck: { checkedAt: "2026-11-07" },
      clinicalReview: { status: "pending" },
    })).toEqual({ version: "Henüz doğrulanmadı", technical: "2026-11-07", clinical: "Henüz yapılmadı" });
  });
  it("shows completed review attribution without hiding a missing link check", () => {
    expect(familyMedicineSourceReviewLabels({
      sourceVersion: { label: "Test edition", verifiedAt: "2026-11-06" },
      technicalCheck: { checkedAt: null },
      clinicalReview: { status: "reviewed", reviewer: "Test editor", reviewedAt: "2026-11-07" },
    })).toEqual({
      version: "Test edition (sürüm kontrolü: 2026-11-06)", technical: "Henüz yapılmadı", clinical: "Test editor · 2026-11-07",
    });
  });
});
