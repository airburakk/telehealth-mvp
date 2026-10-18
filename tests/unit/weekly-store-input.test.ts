import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({ db: { $transaction: vi.fn(() => { throw new Error("DB must not be called"); }) } }));
import { db } from "@/lib/db";
import { normalizeWeeklyManifest, approveWeeklyPackage, prepareWeeklyPackage } from "../../src/lib/social-calendar/weekly-store";
import { WEEKLY_CHANNELS, weeklyManifestHash } from "../../src/lib/social-calendar/weekly-package";
import type { SessionUser } from "../../src/lib/session";
beforeEach(() => { vi.mocked(db.$transaction).mockReset(); });
function input() {
  return { v: 1, week: "2026-10-19", entries: [0, 1, 2].map(i => ({ id: `item-${i}`, version: "2026-10-18T00:00:00.000Z", seriesKey: ["etkinlik-radari", "karar-masasi", "ogrenci-kosesi"][i], slotDay: `2026-10-${19 + 2 * i}`, contentHash: "a".repeat(64), scheduledAt: `2026-10-${19 + 2 * i}T09:00:00.000Z`, channels: [...WEEKLY_CHANNELS], accounts: Object.fromEntries(WEEKLY_CHANNELS.map(c => [c, `${c}:account`])), assets: WEEKLY_CHANNELS.flatMap(c => [{ channel: c, name: c === "youtube" ? "review.mp4" : "review.txt", sha256: "b".repeat(64), url: `https://example.com/${c}.mp4` }, { channel: c, name: "post.json", sha256: "c".repeat(64), url: `https://example.com/${c}.json` }]) })) };
}
describe("weekly preparation and explicit human approval input", () => {
  it("seals the exact accounts and public asset URLs", () => {
    const m = normalizeWeeklyManifest(input()), hash = weeklyManifestHash(m);
    m.entries[0].accounts!.x = "x:other";
    expect(weeklyManifestHash(m)).not.toBe(hash);
    const changed = normalizeWeeklyManifest(input()); changed.entries[0].assets[0].url += "-changed";
    expect(weeklyManifestHash(changed)).not.toBe(hash);
  });
  it("rejects malformed data and token-bearing, active or insecure links", () => {
    for (const bad of [null, [], {}, { ...input(), entries: [] }]) expect(() => normalizeWeeklyManifest(bad)).toThrow();
    for (const url of ["javascript:alert(1)", "http://example.com/video.mp4", "https://a:b@example.com/video.mp4", "https://example.com/video.mp4?token=secret"]) {
      const m = input(); m.entries[0].assets[0].url = url; expect(() => normalizeWeeklyManifest(m)).toThrow();
    }
    const m = input(); m.entries[0].accounts.x = ""; expect(() => normalizeWeeklyManifest(m)).toThrow();
  });
  it("does not begin a transaction without admin authority and explicit confirmation", async () => {
    const actor = { id: "x", role: "DOCTOR" } as SessionUser;
    await expect(prepareWeeklyPackage({ actor, manifest: input() })).rejects.toMatchObject({ status: 401 });
    await expect(approveWeeklyPackage({ actor: { ...actor, role: "ADMIN" }, id: "p", version: "v", hash: "h", confirmed: false })).rejects.toMatchObject({ status: 400 });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("retries only definite database rollbacks, at most three attempts", async () => {
    const actor = { id: "x", role: "ADMIN" } as SessionUser;
    vi.mocked(db.$transaction).mockRejectedValueOnce({ code: "P2034" }).mockRejectedValueOnce({ code: "P2010", meta: { code: "40001" } }).mockRejectedValueOnce({ code: "P2034" });
    await expect(prepareWeeklyPackage({ actor, manifest: input() })).rejects.toMatchObject({ status: 409 });
    expect(db.$transaction).toHaveBeenCalledTimes(3);
  });
  it("does not retry an uncertain connection failure or uniqueness conflict", async () => {
    const actor = { id: "x", role: "ADMIN" } as SessionUser;
    vi.mocked(db.$transaction).mockRejectedValueOnce({ code: "P1017" });
    await expect(prepareWeeklyPackage({ actor, manifest: input() })).rejects.toMatchObject({ code: "P1017" });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    vi.mocked(db.$transaction).mockReset().mockRejectedValueOnce({ code: "P2002" });
    await expect(prepareWeeklyPackage({ actor, manifest: input() })).rejects.toMatchObject({ status: 409 });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });
});
