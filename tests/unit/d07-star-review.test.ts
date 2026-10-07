import { describe, expect, it, vi } from "vitest";
const eduFindMany = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ db: { calendarEntry: { findMany: vi.fn(async () => []) }, eduOpportunity: { findMany: eduFindMany } } }));
vi.mock("@/lib/doctorium", () => ({ followedCongressIds: vi.fn(async () => new Set()) }));
import { approvedEduOpportunities, EDU_OPPORTUNITIES, isEduClosed } from "@/lib/edu-opportunities";
import { reviewD07Star, type StarSnapshot } from "../../scripts/lib/d07-star-review";
import { doctorCalendarMonth } from "@/lib/calendar";

const star = EDU_OPPORTUNITIES.find((o) => o.id === "tubitak-2247c-star")!;
// Synthetic previous metadata; production row has NOT been read for D07.
const old: StarSnapshot = {
  ...star, title: "TÜBİTAK 2247-C Stajyer Araştırmacı Bursu (STAR)", deadline: null,
  deadlineNote: "Dönemsel çağrılar", verifiedAt: "2026-09-05", updatedAt: "2026-09-06T00:00:00Z",
};
describe("D07 STAR 2026 second call", () => {
  it("real calendar renderer puts the student deadline on 16 November", async () => {
    eduFindMany.mockResolvedValueOnce([{ id: star.id, title: star.title, deadline: new Date(`${star.deadline}T00:00:00Z`) }]);
    const rows = await doctorCalendarMonth("synthetic-student", 2026, 11, { includeEdu: true });
    expect(rows.find((o) => o.key === `edu-${star.id}`)).toMatchObject({
      kind: "edu-son-tarih", start: "2026-11-16", end: "2026-11-16",
    });
    expect(rows.some((o) => o.start === "2026-10-12")).toBe(false);
  });
  it("uses student deadline, never project-request or evaluation deadline", () => {
    expect(star.deadline).toBe("2026-11-16");
    expect(star.deadlineNote).toBeNull();
    expect(star.eligibility).toContain("2–16 Kasım 2026");
    expect(star.eligibility).toContain("28 Eylül–12 Ekim");
    expect(star.eligibility).toContain("7–21 Aralık");
  });
  it("does not invent a project start date from the application opening date", () => {
    expect(star.startsAt).toBeNull();
  });
  it("uses the official Turkish source and refreshed verification date", () => {
    expect(star.sourceUrl).toContain("tubitak.gov.tr/tr/");
    expect(star.verifiedAt).toBe("2026-10-06");
    expect(star.eligibility).toContain("TYBS");
    expect(star.eligibility).not.toContain("sonraki çağrı");
  });
  it("retains approval and makes the approved student deadline sortable", () => {
    expect(star.approvedAt).toBe("2026-09-05");
    expect(approvedEduOpportunities(undefined, "2026-10-06").find((o) => o.id === star.id)?.deadline).toBe("2026-11-16");
  });
  it("stays available after project requests close; closes only after student deadline", () => {
    expect(isEduClosed(star, "2026-10-13")).toBe(false);
    expect(isEduClosed(star, "2026-11-16")).toBe(false);
    expect(isEduClosed(star, "2026-11-17")).toBe(true);
  });
  it("draft has exact old values, preserves approval and never writes", () => {
    const plan = reviewD07Star(old);
    expect(plan.mode).toBe("dry-run");
    expect(plan.status).toBe("approval-required");
    if (!plan.proposed) throw new Error("Expected draft");
    expect(plan.expectedOldValue).toEqual(old);
    expect(plan.proposed.deadline).toBe("2026-11-16");
    expect(Object.keys(plan.proposed)).not.toContain("approvedAt");
    expect(Object.keys(plan.proposed)).not.toContain("startsAt");
  });
  it.each([{ id: "another" }, { sourceUrl: "https://example.com" }, { updatedAt: "" }])("rejects unsafe snapshot %j", (override) => {
    expect(reviewD07Star({ ...old, ...override }).proposed).toBeNull();
  });
  it("updated metadata is a no-op; revoked approval is never restored", () => {
    const plan = reviewD07Star({ ...star, updatedAt: old.updatedAt, approvedAt: null });
    expect(plan.status).toBe("no-change");
    expect(plan.proposed).toBeNull();
  });
});
