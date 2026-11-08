import { describe, it, expect } from "vitest";
import { FAMILY_MEDICINE_SOURCE_CANDIDATES } from "../../src/lib/family-medicine-source-candidates";
import { REPORT_WORKFLOWS, ASM_WORKFLOWS } from "../../src/lib/family-medicine-workflows";
describe("family medicine editorial source candidates", () => {
  it("references known topics and primary HTTPS evidence without approving content", () => {
    const ids = new Set([...REPORT_WORKFLOWS, ...ASM_WORKFLOWS].map(w => w.id));
    for (const candidate of FAMILY_MEDICINE_SOURCE_CANDIDATES) {
      expect(ids.has(candidate.workflowId)).toBe(true);
      expect(new URL(candidate.url).protocol).toBe("https:");
      expect(candidate.locator).toBeTruthy();
      expect(candidate.scope).toBeTruthy();
      expect(candidate.remainingReview).toContain("onayı yok");
      expect(candidate).not.toHaveProperty("approvedAt");
      expect(candidate).not.toHaveProperty("reviewer");
    }
  });
});
