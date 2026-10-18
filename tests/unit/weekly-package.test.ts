import { describe, expect, it } from "vitest";
import { payloadHash, type PlanPayload } from "../../src/lib/social-calendar/payload";
import { WEEKLY_CHANNELS, reviewWeeklyPackage, weeklyDeliveryKey, weeklyManifestHash, type WeeklyManifest, type WeeklySnapshot } from "../../src/lib/social-calendar/weekly-package";

function fixture() {
  const payload: PlanPayload = { v: 1, slides: [{ role: "kapak", title: "Review", body: "Source text" }], caption: "Review", hashtags: [], sources: [] };
  const rows: WeeklySnapshot[] = ["etkinlik-radari", "karar-masasi", "ogrenci-kosesi"].map((seriesKey, i) => ({
    id: `item-${i}`, version: "2026-10-18T01:00:00.000Z", seriesKey, slotDay: `2026-10-${19 + 2 * i}`, payload, gatesPassed: true,
  }));
  const manifest: WeeklyManifest = { v: 1, week: "2026-10-19", entries: rows.map(r => ({
    id: r.id, version: r.version, seriesKey: r.seriesKey, slotDay: r.slotDay, contentHash: payloadHash(r.payload), scheduledAt: `${r.slotDay}T09:00:00.000Z`,
    channels: [...WEEKLY_CHANNELS], assets: WEEKLY_CHANNELS.map(channel => ({ channel, name: channel === "youtube" ? "short.mp4" : "review.json", sha256: "a".repeat(64) })),
  })) };
  return { rows, manifest, now: new Date("2026-10-18T01:00:00Z") };
}

describe("weekly review contract (no DB approval or publishing)", () => {
  it("seals per-channel enqueue/publication times and requires native video for all five platforms", () => {
    const { rows, manifest, now } = fixture();
    const e = manifest.entries[0]; e.mediaKind = "video"; e.masterVideoHash = "b".repeat(64);
    e.publishTimes = { youtube: "2026-10-19T17:30:00.000Z" };
    e.enqueueTimes = { youtube: "2026-10-19T05:30:00.000Z" };
    expect(reviewWeeklyPackage(manifest, rows, now).some(x => x.includes("native video"))).toBe(true);
    e.assets = WEEKLY_CHANNELS.map(channel => ({ channel, name: "video.mp4", sha256: "a".repeat(64), sourceMasterHash: e.masterVideoHash }));
    expect(reviewWeeklyPackage(manifest, rows, now)).toEqual([]);
    const hash = weeklyManifestHash(manifest);
    e.enqueueTimes.youtube = "2026-10-19T06:30:00.000Z";
    expect(weeklyManifestHash(manifest)).not.toBe(hash);
    e.enqueueTimes.youtube = "2026-10-19T18:30:00.000Z";
    expect(reviewWeeklyPackage(manifest, rows, now).some(x => x.includes("enqueue"))).toBe(true);
  });
  it("accepts a complete future review without modifying it", () => {
    const { rows, manifest, now } = fixture();
    const before = JSON.stringify({ rows, manifest });
    expect(reviewWeeklyPackage(manifest, rows, now)).toEqual([]);
    expect(JSON.stringify({ rows, manifest })).toBe(before);
  });
  it("canonicalizes ordering but seals schedule, channel, version, content and media", () => {
    const { manifest } = fixture();
    const seal = weeklyManifestHash(manifest);
    manifest.entries.reverse(); manifest.entries[0].channels.reverse(); manifest.entries[0].assets.reverse();
    expect(weeklyManifestHash(manifest)).toBe(seal);
    for (const field of ["scheduledAt", "version", "contentHash", "id"] as const) {
      const altered = structuredClone(manifest); altered.entries[0][field] += "x";
      expect(weeklyManifestHash(altered)).not.toBe(seal);
    }
    manifest.entries[0].assets[0].sha256 = "b".repeat(64);
    expect(weeklyManifestHash(manifest)).not.toBe(seal);
  });
  it("refuses incomplete legal review and partial weeks", () => {
    const { manifest, rows, now } = fixture();
    rows[1].gatesPassed = false;
    expect(reviewWeeklyPackage(manifest, rows, now).join()).toContain("editorial gates");
    manifest.entries.splice(1, 1);
    expect(reviewWeeklyPackage(manifest, rows, now).join()).toContain("all three");
  });
  it("rejects stale versions and edited content", () => {
    const { manifest, rows, now } = fixture();
    rows[0].version = "2026-10-18T02:00:00.000Z";
    rows[0].payload = { ...rows[0].payload, caption: "Changed after review" };
    const errors = reviewWeeklyPackage(manifest, rows, now).join();
    expect(errors).toContain("stale"); expect(errors).toContain("content changed");
  });
  it("rejects backdating, malformed dates and the wrong Turkey day", () => {
    for (const scheduledAt of ["2026-10-17T09:00:00.000Z", "2026-10-19T22:00:00.000Z", "2026-10-19", "invalid"]) {
      const { manifest, rows, now } = fixture(); manifest.entries[0].scheduledAt = scheduledAt;
      expect(reviewWeeklyPackage(manifest, rows, now).join()).toContain("schedule");
    }
  });
  it("refuses missing channels, duplicate files, paths and missing YouTube MP4", () => {
    const { manifest, rows, now } = fixture();
    manifest.entries[0].channels.pop(); manifest.entries[0].assets[0].name = "../secret";
    manifest.entries[0].assets.push(manifest.entries[0].assets[1]);
    manifest.entries[1].assets = manifest.entries[1].assets.filter(a => a.channel !== "youtube");
    const errors = reviewWeeklyPackage(manifest, rows, now).join();
    expect(errors).toContain("five"); expect(errors).toContain("invalid or duplicate"); expect(errors).toContain("MP4 missing");
  });
  it("uses a different idempotency key for every channel and approved package revision", () => {
    const { manifest } = fixture(); const hash = weeklyManifestHash(manifest);
    const keys = WEEKLY_CHANNELS.map(c => weeklyDeliveryKey(hash, "item", c));
    expect(new Set(keys).size).toBe(5);
    expect(weeklyDeliveryKey(hash, "item", "x")).toBe(keys[3]);
    expect(weeklyDeliveryKey("b".repeat(64), "item", "x")).not.toBe(keys[3]);
    expect(() => weeklyDeliveryKey("invalid", "item", "x")).toThrow();
  });
});
