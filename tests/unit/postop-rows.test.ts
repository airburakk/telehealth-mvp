// Birim — lib/postop-rows.ts (hasta Post-Op listesi satır türetimi; kontrol raporu 2026-09-17 H02 + 19 Eylül D01).
// H02: liste ve detay AYNI kapanış kararını kullanır — status ACTIVE ama protokol süresi + tampon dolmuş takip
// listede de "kapalı" (AUTO) görünür; eskiden yalnız COMPLETED'e bakılıyordu.
import { describe, it, expect } from "vitest";
import { takipRowFor } from "@/lib/postop-rows";
import { autoCloseDays } from "@/lib/postop-access";

const NOW = new Date();
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);
const BRANCH = "Kardiyoloji"; // autoCloseDays = 30 + 30 tampon

const src = (recovery: Partial<NonNullable<Parameters<typeof takipRowFor>[0]["recovery"]>> | null) => ({
  id: "case-1",
  branch: BRANCH,
  recovery: recovery
    ? { status: "ACTIVE", startedAt: daysAgo(2), completedAt: null, reopenedAt: null, branch: BRANCH, checkIns: [], ...recovery }
    : null,
});

describe("takipRowFor — kapanış kararı (H02)", () => {
  it("ACTIVE ama süre dolmuş → closed:true reason:AUTO (detayla aynı hesap)", () => {
    const r = takipRowFor(src({ startedAt: daysAgo(autoCloseDays(BRANCH) + 1) }), NOW);
    expect(r.closed).toBe(true);
    expect(r.closeReason).toBe("AUTO");
    expect(r.completedAt).toBeNull(); // otomatik kapanış hesaplanır, DB'de tarih yok
  });

  it("COMPLETED → closed:true reason:MANUAL + bitiş tarihi", () => {
    const done = daysAgo(1);
    const r = takipRowFor(src({ status: "COMPLETED", completedAt: done }), NOW);
    expect(r.closed).toBe(true);
    expect(r.closeReason).toBe("MANUAL");
    expect(r.completedAt).toBe(done.toISOString());
  });

  it("taze ACTIVE → açık; yeniden açılmış takipte pencere reopenedAt'tan sayılır", () => {
    expect(takipRowFor(src({}), NOW).closed).toBe(false);
    const reopened = takipRowFor(src({ startedAt: daysAgo(400), reopenedAt: daysAgo(1) }), NOW);
    expect(reopened.closed).toBe(false);
  });

  it("recovery yoksa açık satır (savunma; liste zaten recovery:isNot null süzer)", () => {
    const r = takipRowFor(src(null), NOW);
    expect(r.closed).toBe(false);
    expect(r.startedAt).toBe("");
  });
});

describe("takipRowFor — ölçüm güncelliği (D01)", () => {
  it("kontrol yok → NO_DATA, severity NONE, ageDays null", () => {
    const r = takipRowFor(src({}), NOW);
    expect(r.measurement).toBe("NO_DATA");
    expect(r.severity).toBe("NONE");
    expect(r.lastCheckAt).toBeNull();
    expect(r.ageDays).toBeNull();
  });

  it("son kontrol taze → CURRENT + şiddet taşınır; eski → STALE + yaş", () => {
    const fresh = takipRowFor(src({ checkIns: [{ severity: "WATCH", createdAt: daysAgo(1) }] }), NOW);
    expect(fresh.measurement).toBe("CURRENT");
    expect(fresh.severity).toBe("WATCH");
    expect(fresh.ageDays).toBe(1);
    const stale = takipRowFor(src({ checkIns: [{ severity: "NONE", createdAt: daysAgo(10) }] }), NOW);
    expect(stale.measurement).toBe("STALE");
    expect(stale.ageDays).toBe(10);
  });
});
