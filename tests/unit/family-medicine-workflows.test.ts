import { describe, expect, it } from "vitest";
import { ASM_WORKFLOWS, REPORT_WORKFLOWS, workflowPublicationGate, type FamilyMedicineWorkflow } from "../../src/lib/family-medicine-workflows";
const now = new Date("2026-11-07T12:00:00Z");
function reviewedFixture(): FamilyMedicineWorkflow {
  return {
    ...REPORT_WORKFLOWS[0], status: "approved", sourceGap: null,
    review: {
      requiresPatientData: false,
      sources: [{ url: "https://example.org/regulation", version: "Test version", locator: "Test section", applicability: "Test scope only", verifiedOn: "2026-11-05", effectiveFrom: "2026-05-19", effectiveUntil: null }],
      clinical: { reviewer: "Test clinician", reviewedOn: "2026-11-06" },
      legal: { reviewer: "Test legal reviewer", reviewedOn: "2026-11-06" }, nextReviewOn: "2026-12-07",
    },
  };
}
describe("family medicine draft workflow catalog", () => {
  it("covers five report types and five administrative ASM preparation topics", () => {
    expect(REPORT_WORKFLOWS.map(x => x.id)).toEqual(["driver", "employment", "marriage", "military", "sick-leave"]);
    expect(ASM_WORKFLOWS.map(x => x.id)).toEqual(["cold-chain", "expiry", "maintenance", "hygiene", "training"]);
    const all = [...REPORT_WORKFLOWS, ...ASM_WORKFLOWS];
    expect(new Set(all.map(x => x.id)).size).toBe(all.length);
    for (const item of all) {
      expect(item.status).toBe("draft");
      expect(item.sourceGap).toBeTruthy();
      expect(item.review.requiresPatientData).toBe(false);
      expect(item.review.clinical).toBeNull(); expect(item.review.legal).toBeNull();
      expect(item.preparationQuestions.length).toBeGreaterThan(0);
      expect(workflowPublicationGate(item, now).publishable).toBe(false);
    }
  });
  it("does not imply the repealed report directive is current", () => {
    for (const item of REPORT_WORKFLOWS) {
      expect(item.sourceIds).toEqual(["report-regulation", "report-repeal"]);
      expect(item.sourceGap).toContain("eski yönerge güncel kural olarak kullanılmaz");
    }
    for (const item of ASM_WORKFLOWS) expect(item.sourceIds).toEqual(["asm-forms"]);
  });
});
describe("editorial publication gate", () => {
  it("accepts complete current metadata only (not an authentication mechanism)", () => {
    expect(workflowPublicationGate(reviewedFixture(), now)).toEqual({ publishable: true, blockers: [] });
  });
  it.each(["draft", "gap", "patient", "clinical", "legal", "sources", "next"])("blocks missing or unsafe %s", (field) => {
    const item = reviewedFixture();
    if (field === "draft") item.status = "draft";
    if (field === "gap") item.sourceGap = "Unverified section";
    if (field === "patient") item.review.requiresPatientData = true;
    if (field === "clinical") item.review.clinical = null;
    if (field === "legal") item.review.legal = null;
    if (field === "sources") item.review.sources = [];
    if (field === "next") item.review.nextReviewOn = null;
    expect(workflowPublicationGate(item, now).publishable).toBe(false);
  });
  it.each(["http://example.org", "javascript:alert(1)", "not a url", "https://name:secret@example.org"])("rejects unsafe source %s", url => {
    const item = reviewedFixture(); item.review.sources[0].url = url;
    expect(workflowPublicationGate(item, now).publishable).toBe(false);
  });
  it.each(["version", "locator", "applicability"] as const)("requires nonempty %s", field => {
    const item = reviewedFixture(); item.review.sources[0][field] = " ";
    expect(workflowPublicationGate(item, now).publishable).toBe(false);
  });
  it.each(["2026-02-30", "invalid", "2026-11-08"])("rejects invalid/future source check %s", date => {
    const item = reviewedFixture(); item.review.sources[0].verifiedOn = date;
    expect(workflowPublicationGate(item, now).publishable).toBe(false);
  });
  it.each(["2026-02-30", "2026-12-01"])("rejects invalid or future effective date %s", date => {
    const item = reviewedFixture(); item.review.sources[0].effectiveFrom = date;
    expect(workflowPublicationGate(item, now).publishable).toBe(false);
  });
  it.each(["2026-02-30", "2026-11-06", "2026-01-01"])("rejects invalid/expired validity %s", date => {
    const item = reviewedFixture(); item.review.sources[0].effectiveUntil = date;
    expect(workflowPublicationGate(item, now).publishable).toBe(false);
  });
  it.each(["2026-02-30", "2026-11-08", "2026-11-04"])("rejects invalid, future, or superseded reviewer dates %s", date => {
    const item = reviewedFixture(); item.review.clinical!.reviewedOn = date;
    expect(workflowPublicationGate(item, now).publishable).toBe(false);
  });
  it.each(["2026-02-30", "2026-11-07", "2026-11-06"])("rejects expired or invalid review deadline %s", date => {
    const item = reviewedFixture(); item.review.nextReviewOn = date;
    expect(workflowPublicationGate(item, now).publishable).toBe(false);
  });
  it("requires attributed reviewers and a valid evaluation clock", () => {
    const item = reviewedFixture(); item.review.legal!.reviewer = " ";
    expect(workflowPublicationGate(item, now).publishable).toBe(false);
    expect(workflowPublicationGate(reviewedFixture(), new Date("invalid")).publishable).toBe(false);
  });
  it("does not mutate a draft while inspecting it", () => {
    const before = JSON.stringify(REPORT_WORKFLOWS);
    REPORT_WORKFLOWS.forEach(item => workflowPublicationGate(item, now));
    expect(JSON.stringify(REPORT_WORKFLOWS)).toBe(before);
  });
});
