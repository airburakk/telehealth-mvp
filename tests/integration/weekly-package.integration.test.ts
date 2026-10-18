// Real transactions/locks/trigger on TEST_DATABASE_URL only. No external fetch or platform API.
import { describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { prepareWeeklyPackage, approveWeeklyPackage, claimWeeklyDelivery, completeWeeklyDelivery, reconcileWeeklyDelivery, revokeWeeklyPackage } from "@/lib/social-calendar/weekly-store";
import { payloadHash, type PlanPayload } from "@/lib/social-calendar/payload";
import { WEEKLY_CHANNELS, type WeeklyManifest } from "@/lib/social-calendar/weekly-package";
import { slotsOfWeek, weekStart } from "@/lib/social-calendar/series";
import type { SessionUser } from "@/lib/session";
import { parsePublication } from "@/lib/social-calendar/publication";
vi.mock("@/lib/audit", () => ({ recordAccess: vi.fn() }));

const actor: SessionUser = { id: "itest-week-reviewer", name: "Test reviewer", email: "weekly@itest.local", role: "ADMIN" };
async function fixture() {
  const run = `itest_week_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const year = 7000 + Math.floor(Math.random() * 1500), week = weekStart(`${year}-10-19`);
  const sourceId = `${run}_source`;
  const quote = "Kaynak incelemesinde kayıtların tamamının değerlendirilmesi gerektiği belirtildi.";
  await db.newsArticle.create({ data: { id: sourceId, source: "itest-week", externalId: run, module: "mevzuat", kind: "mevzuat", title: "Test only source", summary: quote, sourceName: "Test", url: "https://www.yargitay.gov.tr/", publishedAt: new Date() } });
  const ids: string[] = [];
  const entries = [];
  for (const { series, slotDay } of slotsOfWeek(week)) {
    const payload: PlanPayload = { v: 1, caption: "Kaynaklı inceleme için hazırlanmış test taslağı; gerçek bir karar veya duyuru değildir.", hashtags: [], sources: [{ label: "Test source", ref: "https://www.yargitay.gov.tr/" }],
      slides: series.slideRoles.map(role => ({ role, title: "Kaynak incelemesi", body: role === "kaynak" ? "Bilgilendirme amaçlıdır; hukuki görüş değildir." : quote,
        ...(series.quoteRoles.includes(role) ? { quote: true } : {}), ...(role === "cikarim" ? { bullets: ["Kaynak tarihini işlem öncesinde kontrol edin.", "Karar kapsamını asıl metinden kontrol edin.", "Dosya içeriğini ayrıca değerlendirmek gerekir."] } : {}) })) };
    const row = await db.contentPlanItem.create({ data: { id: `${run}_${series.key}`, seriesKey: series.key, slotDay, status: "DRAFT", payload: JSON.stringify(payload), sourceIds: JSON.stringify([sourceId]), attestIdentity: true } });
    ids.push(row.id);
    entries.push({ id: row.id, version: row.updatedAt.toISOString(), seriesKey: row.seriesKey, slotDay, contentHash: payloadHash(payload), scheduledAt: `${slotDay}T09:00:00.000Z`, channels: [...WEEKLY_CHANNELS],
      accounts: Object.fromEntries(WEEKLY_CHANNELS.map(c => [c, `${c}:test-account`])), assets: WEEKLY_CHANNELS.flatMap(c => [{ channel: c, name: c === "youtube" ? "video.mp4" : "cards.png", sha256: "a".repeat(64), url: `https://example.com/${c}.${c === "youtube" ? "mp4" : "png"}` }, { channel: c, name: "post.json", sha256: "c".repeat(64), url: `https://example.com/${c}.json` }]) });
  }
  const manifest: WeeklyManifest = { v: 1, week, entries };
  return { manifest, ids, sourceId, async cleanup() {
    vi.useRealTimers();
    const pkgs = await db.weeklyContentPackage.findMany({ where: { manifest: { contains: run } }, select: { id: true } });
    const packageIds = pkgs.map(p => p.id);
    const ds = await db.weeklyChannelDelivery.findMany({ where: { packageId: { in: packageIds } }, select: { id: true } });
    await db.weeklyDeliveryEvent.deleteMany({ where: { deliveryId: { in: ds.map(d => d.id) } } });
    await db.weeklyChannelDelivery.deleteMany({ where: { packageId: { in: packageIds } } });
    await db.contentPlanItem.updateMany({ where: { id: { in: ids } }, data: { weeklyPackageId: null } });
    await db.contentPlanItem.deleteMany({ where: { id: { in: ids } } });
    await db.weeklyContentPackage.deleteMany({ where: { id: { in: packageIds } } });
    await db.newsArticle.delete({ where: { id: sourceId } });
  } };
}
async function approved(f: Awaited<ReturnType<typeof fixture>>) {
  const p = await prepareWeeklyPackage({ actor, manifest: f.manifest });
  return approveWeeklyPackage({ actor, id: p.id, version: p.updatedAt.toISOString(), hash: p.manifestHash, confirmed: true });
}

describe.skipIf(!process.env.TEST_DATABASE_URL)("weekly package real DB integrity", () => {
  it("rejects stale preview atomically without approving any item", async () => {
    const f = await fixture();
    try {
      const p = await prepareWeeklyPackage({ actor: null, manifest: f.manifest });
      expect(p.status).toBe("DRAFT"); expect(p.approvedAt).toBeNull();
      expect((await prepareWeeklyPackage({ actor: null, manifest: f.manifest })).id).toBe(p.id);
      await db.contentPlanItem.update({ where: { id: f.ids[2] }, data: { attestIdentity: false } });
      await expect(approveWeeklyPackage({ actor, id: p.id, version: p.updatedAt.toISOString(), hash: p.manifestHash, confirmed: true })).rejects.toThrow();
      expect(await db.contentPlanItem.count({ where: { id: { in: f.ids }, status: "APPROVED" } })).toBe(0);
      expect(await db.weeklyChannelDelivery.count({ where: { packageId: p.id } })).toBe(0);
    } finally { await f.cleanup(); }
  });
  it("allows exactly one concurrent human approval and revokes atomically on editor change", async () => {
    const f = await fixture();
    try {
      const unattested = await db.contentPlanItem.update({ where: { id: f.ids[1] }, data: { attestIdentity: false } });
      f.manifest.entries[1].version = unattested.updatedAt.toISOString();
      const p = await prepareWeeklyPackage({ actor, manifest: f.manifest });
      expect((await db.contentPlanItem.findUniqueOrThrow({ where: { id: f.ids[1] } })).attestIdentity).toBe(false);
      const input = { actor, id: p.id, version: p.updatedAt.toISOString(), hash: p.manifestHash, confirmed: true };
      const results = await Promise.allSettled([approveWeeklyPackage(input), approveWeeklyPackage(input)]);
      expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
      const approvedLegal = await db.contentPlanItem.findUniqueOrThrow({ where: { id: f.ids[1] } });
      expect(approvedLegal.attestIdentity).toBe(true);
      expect(JSON.parse(approvedLegal.gateReport!).ok).toBe(true);
      expect(await db.weeklyChannelDelivery.count({ where: { packageId: p.id } })).toBe(15);
      await db.contentPlanItem.update({ where: { id: f.ids[0] }, data: { payload: JSON.stringify({ ...JSON.parse((await db.contentPlanItem.findUniqueOrThrow({ where: { id: f.ids[0] } })).payload!), caption: "Edited after approval" }) } });
      expect((await db.weeklyContentPackage.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("REVOKED");
      expect(await db.weeklyChannelDelivery.count({ where: { packageId: p.id, state: "CANCELLED" } })).toBe(15);
    } finally { await f.cleanup(); }
  });
  it("claims once, preserves success across retries, and requires human reconciliation for uncertain uploads", async () => {
    const f = await fixture();
    try {
      const p = await approved(f);
      const ds = await db.weeklyChannelDelivery.findMany({ where: { packageId: p.id, itemId: f.ids[0] }, orderBy: { channel: "asc" } });
      vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(ds[0].scheduledAt);
      const input = { id: ds[0].id, hash: p.manifestHash, accountId: ds[0].accountId, assetHashes: { "cards.png": "a".repeat(64), "post.json": "c".repeat(64) } };
      const attempts = await Promise.allSettled([claimWeeklyDelivery(input), claimWeeklyDelivery(input)]);
      expect(attempts.filter(r => r.status === "fulfilled")).toHaveLength(1);
      const win = attempts.find(r => r.status === "fulfilled"); if (win?.status !== "fulfilled") throw new Error("No winner");
      const done = { id: input.id, claimToken: win.value.claimToken, result: "SUCCEEDED" as const, platformId: "test-platform-post" };
      await completeWeeklyDelivery(done);
      expect((await completeWeeklyDelivery(done)).repeated).toBe(true);
      await expect(claimWeeklyDelivery(input)).rejects.toThrow();
      const second = ds[1];
      const claim2 = await claimWeeklyDelivery({ ...input, id: second.id, accountId: second.accountId });
      expect((await completeWeeklyDelivery({ id: second.id, claimToken: claim2.claimToken, result: "FAILED" })).state).toBe("UNKNOWN");
      await expect(claimWeeklyDelivery({ ...input, id: second.id, accountId: second.accountId })).rejects.toThrow();
      const current = await db.weeklyChannelDelivery.findUniqueOrThrow({ where: { id: second.id } });
      await reconcileWeeklyDelivery({ actor, id: second.id, version: current.updatedAt.toISOString(), outcome: "FOUND", evidence: "Checked the test platform account and found the already uploaded post.", platformId: "found-post" });
      expect((await db.weeklyChannelDelivery.findUniqueOrThrow({ where: { id: second.id } })).state).toBe("SUCCEEDED");
      expect(await db.weeklyDeliveryEvent.count({ where: { deliveryId: second.id } })).toBe(4);
      const entry = f.manifest.entries.find(e => e.id === f.ids[0])!;
      for (const d of ds.slice(2)) {
        const claimed = await claimWeeklyDelivery({ id: d.id, hash: p.manifestHash, accountId: d.accountId, assetHashes: Object.fromEntries(entry.assets.filter(a => a.channel === d.channel).map(a => [a.name, a.sha256])) });
        await completeWeeklyDelivery({ id: d.id, claimToken: claimed.claimToken, result: "SUCCEEDED", platformId: `post-${d.channel}` });
      }
      const finished = await db.contentPlanItem.findUniqueOrThrow({ where: { id: f.ids[0] } });
      expect(finished.status).toBe("PUBLISHED");
      expect(parsePublication(finished.publishedRefs)?.channels).toHaveLength(5);
    } finally { await f.cleanup(); }
  }, 120000);
  it("blocks wrong account/media and backdating; revocation releases only unattempted drafts", async () => {
    const f = await fixture();
    try {
      const p = await approved(f), d = await db.weeklyChannelDelivery.findFirstOrThrow({ where: { packageId: p.id } });
      vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(d.scheduledAt);
      const entry = f.manifest.entries.find(e => e.id === d.itemId)!;
      const a = entry.assets.find(a => a.channel === d.channel)!;
      const input = { id: d.id, hash: p.manifestHash, accountId: d.accountId, assetHashes: Object.fromEntries(entry.assets.filter(a => a.channel === d.channel).map(a => [a.name, a.sha256])) };
      await expect(claimWeeklyDelivery({ ...input, accountId: "wrong" })).rejects.toThrow();
      await expect(claimWeeklyDelivery({ ...input, assetHashes: { [a.name]: "b".repeat(64) } })).rejects.toThrow();
      vi.setSystemTime(new Date(d.scheduledAt.getTime() + 16 * 60000));
      await expect(claimWeeklyDelivery(input)).rejects.toThrow();
      await revokeWeeklyPackage({ actor, id: p.id, version: p.updatedAt.toISOString() });
      expect(await db.contentPlanItem.count({ where: { id: { in: f.ids }, status: "DRAFT", weeklyPackageId: null } })).toBe(3);
    } finally { await f.cleanup(); }
  });
});
