import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { createWeeklyArchive, createWeeklyDraftClient, createWeeklyVideoRenderer, draftChannelPosts, prepareWeeklyDraft, weeklyTimes } from "../../infra/kart/lib/weekly-draft-producer.mjs";
const hash = (b: string | Buffer) => createHash("sha256").update(b).digest("hex");
const channels = ["facebook", "instagram", "linkedin", "x", "youtube"];
const policy = { isAiGenerated: false, madeForKids: false, notifySubscribers: true, categoryId: 27 };
const payload = { caption: "A source-checked caption.", hashtags: ["#Doctorium"], slides: [{ title: "Prepared title", body: "Prepared body" }] };
const fixture = () => {
  const items = ["karar-masasi", "etkinlik-radari", "ogrenci-kosesi"].map((seriesKey, i) => ({ id: `item${i}`, version: "2026-10-18T09:00:00.000Z", seriesKey,
    slotDay: `2026-10-${19 + i * 2}`, contentHash: hash(seriesKey), state: "DRAFT_REVIEW_ONLY", payload, gates: { gates: [{ id: "kimlik-onay", severity: "block", ok: false }] } }));
  const profiles = Object.fromEntries(items.map(i => [i.seriesKey, { accounts: Object.fromEntries(channels.map(c => [c, `test-${c}`])), scheduledAt: `${i.slotDay}T17:30:00.000Z`, youtubePolicy: policy }]));
  const source = { week: "2026-10-19", items, missing: [] };
  return { source, profiles };
};
async function temp(run: (dir: string) => Promise<void>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "weekly-producer-"));
  try { await run(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
describe("existing renderer -> immutable archive -> automatic DRAFT only", () => {
  it("derives future dates from reusable Istanbul clock policy and preserves an explicit early enqueue", () => {
    const result = weeklyTimes("2026-10-19", { publishClockTr: Object.fromEntries(channels.map(c => [c, "20:30"])), enqueueLeadHours: { youtube: 12 } });
    expect(result.publishTimes.youtube).toBe("2026-10-19T17:30:00.000Z"); expect(result.enqueueTimes.youtube).toBe("2026-10-19T05:30:00.000Z");
    expect(() => weeklyTimes("2026-10-19", { publishClockTr: { youtube: "29:00" } })).toThrow(/POLICY/);
  });
  it("derives all final channel copy and a complete X thread without truncation", () => {
    const p = draftChannelPosts({ ...payload, caption: "Reviewed word ".repeat(60) }, policy);
    expect(p.x.thread.length).toBeGreaterThan(1);
    expect(p.x.thread.every(s => [...s].length <= 280)).toBe(true);
    expect(p.x.thread.join(" ")).toBe(`${"Reviewed word ".repeat(60)}\n\n#Doctorium`.trim().replace(/\s+/g, " "));
    expect(p.youtube.isAiGenerated).toBe(false); expect(p.instagram.caption).toContain("#Doctorium");
    expect(() => draftChannelPosts(payload)).toThrow(/POLICY/);
    expect(() => draftChannelPosts({ ...payload, slides: [{ title: "x".repeat(101) }] }, policy)).toThrow(/EDITOR_REVIEW/);
  });
  it("only permits draft/read actions at the existing fixed app origin without credential redirects", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{"ok":true}'));
    const client = createWeeklyDraftClient({ token: "test-token", fetchImpl });
    await expect(client("approve", {})).rejects.toThrow(/DISABLED/); expect(fetchImpl).not.toHaveBeenCalled();
    await client("drafts", { week: "2026-10-19", action: "approve" });
    expect(fetchImpl.mock.calls[0][0]).toBe("https://doctorium.tr/api/social-calendar/haftalik");
    expect(fetchImpl.mock.calls[0][1].redirect).toBe("error");
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).action).toBe("drafts");
  });
  it("archives by content hash, verifies public bytes and refuses overwrite/tampering", () => temp(async dir => {
    const localPath = path.join(dir, "post.json"), bytes = Buffer.from('{"caption":"reviewed"}'); fs.writeFileSync(localPath, bytes);
    const asset = { channel: "youtube", name: "post.json", localPath, sha256: hash(bytes) };
    const fetchImpl = vi.fn().mockImplementation(async () => new Response(bytes, { headers: { "content-type": "application/json; charset=utf-8" } }));
    const options = { root: path.join(dir, "archive"), publicBaseUrl: "https://archive.example.test/weekly/", fetchImpl };
    await expect(createWeeklyArchive(options)([asset])).rejects.toThrow(/MAPPING_REQUIRED/); expect(fetchImpl).not.toHaveBeenCalled();
    const archive = createWeeklyArchive({ ...options, mappingVerified: true });
    const receipt = await archive([asset]); await archive([asset]);
    expect(receipt[0].url).toBe(`https://archive.example.test/weekly/weekly-${hash(bytes)}.json`); expect(receipt[0]).not.toHaveProperty("localPath");
    fs.writeFileSync(path.join(options.root, `weekly-${hash(bytes)}.json`), "corrupted");
    await expect(archive([asset])).rejects.toThrow(/WRITE_FAILED/);
  }));
  it("refuses truncated, redirected or oversized public archive evidence", () => temp(async dir => {
    const localPath = path.join(dir, "post.json"); fs.writeFileSync(localPath, "expected");
    const asset = { channel: "x", name: "post.json", localPath, sha256: hash("expected") };
    for (const content of ["wrong", "unbounded-content-larger-than-original"]) {
      const archive = createWeeklyArchive({ root: path.join(dir, "archive"), publicBaseUrl: "https://archive.example.test/", mappingVerified: true, fetchImpl: async () => new Response(content, { headers: { "content-type": "application/json" } }) });
      await expect(archive([asset])).rejects.toThrow();
    }
  }));
  it("refuses an otherwise identical public file served with the wrong media content type", () => temp(async dir => {
    const localPath = path.join(dir, "post.json"); fs.writeFileSync(localPath, "expected");
    const archive = createWeeklyArchive({ root: path.join(dir, "archive"), publicBaseUrl: "https://archive.example.test/", mappingVerified: true,
      fetchImpl: async () => new Response("expected", { headers: { "content-type": "video/mp4" } }) });
    await expect(archive([{ channel: "x", name: "post.json", localPath, sha256: hash("expected") }])).rejects.toThrow("ARCHIVE_CONTENT_TYPE_MISMATCH");
  }));
  it("uses the actual existing card/master/adaptation chain and blocks overflowing cards before encoding", () => temp(async dir => {
    const item = { render: { templateKey: "etkinlik-radari", seriesName: "Etkinlik", slotDay: "2026-10-21", slides: [{ role: "kapak", title: "Title", body: "Body", bullets: [] }] } };
    const render = vi.fn().mockResolvedValue({ slides: [{ png: Buffer.from("fixture"), tasma: true }] }), video = vi.fn(), adaptations = vi.fn();
    const renderer = createWeeklyVideoRenderer({ getBrowser: async () => "existing", spherePath: "fixture", render, video, adaptations });
    await expect(renderer({ item, outDir: path.join(dir, "overflow"), posts: {} })).rejects.toThrow(/OVERFLOW/); expect(video).not.toHaveBeenCalled();
    render.mockResolvedValue({ slides: [{ png: Buffer.from("fixture"), tasma: false }] });
    video.mockImplementation(async ({ outDir }: {outDir: string}) => { fs.mkdirSync(outDir); fs.writeFileSync(path.join(outDir, "youtube-review.srt"), "fixture captions"); });
    adaptations.mockResolvedValue({ assets: [] });
    expect((await renderer({ item, outDir: path.join(dir, "ok"), posts: {} })).assets[0]).toMatchObject({ channel: "youtube", name: "captions.srt" });
    expect(video).toHaveBeenCalledTimes(1); expect(adaptations).toHaveBeenCalledTimes(1);
  }));
  it("saves exactly one DRAFT after all three five-channel archives, with no approval or claim", () => temp(async dir => {
    const { source, profiles } = fixture();
    const client = vi.fn().mockImplementation(async (action: string) => action === "drafts" ? source : { package: { id: "draft-package", status: "DRAFT", hash: hash("manifest") } });
    const renderer = vi.fn().mockImplementation(async () => ({ state: "DRAFT_REVIEW_ONLY", approved: false, published: false, masterVideoHash: hash("master"), assets: channels.flatMap(channel => [{ channel, name: "video.mp4", sha256: hash(channel), sourceMasterHash: hash("master") }, { channel, name: "post.json", sha256: hash(channel) }]) }));
    const archive = vi.fn().mockImplementation(async assets => assets.map((a: {name: string}) => ({ ...a, url: `https://archive.example.test/${a.name}` })));
    const runDir = path.join(dir, "run");
    expect(await prepareWeeklyDraft({ week: source.week, runDir, profiles, client, renderer, archive })).toMatchObject({ state: "DRAFT_SAVED", approved: false, published: false, dailyDuplicateCheck: "UNKNOWN_NO_READ_ONLY_INDEX_REVIEW_REQUIRED" });
    expect(client.mock.calls.map(c => c[0])).toEqual(["drafts", "prepare"]); expect(archive).toHaveBeenCalledTimes(3);
    const manifest = client.mock.calls[1][1].manifest;
    expect(manifest.entries.every((e: {channels: string[]}) => e.channels.length === 5)).toBe(true);
    expect(renderer.mock.calls[0][0].posts.youtube).toMatchObject({ accountId: "test-youtube", title: "Prepared title" });
    await expect(prepareWeeklyDraft({ week: source.week, runDir, profiles, client, renderer, archive })).rejects.toThrow();
    expect(client).toHaveBeenCalledTimes(2);
  }));
  it("retains sanitized durable error and never saves partial/uncertain media or retries an uncertain save", () => temp(async dir => {
    const { source, profiles } = fixture();
    const client = vi.fn().mockResolvedValue(source), renderer = vi.fn().mockRejectedValue(new Error("credential must not reach state file")), archive = vi.fn();
    const runDir = path.join(dir, "run");
    await expect(prepareWeeklyDraft({ week: source.week, runDir, profiles, client, renderer, archive })).rejects.toThrow("PREPARATION_FAILED");
    expect(fs.readFileSync(path.join(runDir, "state.json"), "utf8")).not.toContain("credential"); expect(client).toHaveBeenCalledTimes(1); expect(archive).not.toHaveBeenCalled();
    const uncertain = createWeeklyDraftClient({ token: "test-only", fetchImpl: vi.fn().mockRejectedValue(new Error("connection reset")) });
    await expect(uncertain("prepare", {})).rejects.toThrow("DRAFT_SAVE_UNCERTAIN");
  }));
  it("does not archive or bypass a protected human-note/source/identity-scan gate", () => temp(async dir => {
    const { source, profiles } = fixture(); source.items[0].gates.gates = [{ id: "kimlik-tarama", severity: "block", ok: false }];
    const client = vi.fn().mockResolvedValue(source), renderer = vi.fn(), archive = vi.fn();
    await expect(prepareWeeklyDraft({ week: source.week, runDir: path.join(dir, "run"), profiles, client, renderer, archive })).rejects.toThrow("SOURCE_EDITORIAL_GATES_BLOCKED");
    expect(renderer).not.toHaveBeenCalled(); expect(archive).not.toHaveBeenCalled(); expect(client).toHaveBeenCalledTimes(1);
  }));
  it("blocks only weekly work on an existing daily hash and never mutates the read-only daily index", () => temp(async dir => {
    const { source, profiles } = fixture(), client = vi.fn().mockResolvedValue(source), archive = vi.fn();
    const renderer = vi.fn().mockResolvedValue({ state: "DRAFT_REVIEW_ONLY", approved: false, published: false, masterVideoHash: hash("daily-video"), assets: [] });
    const dailyIndex = Object.freeze({ contentHashes: Object.freeze([]), mediaHashes: Object.freeze([hash("daily-video")]) });
    await expect(prepareWeeklyDraft({ week: source.week, runDir: path.join(dir, "run"), profiles, client, renderer, archive, dailyIndex })).rejects.toThrow("WEEKLY_DUPLICATES_EXISTING_DAILY_CONTENT");
    expect(archive).not.toHaveBeenCalled(); expect(client.mock.calls.map(c => c[0])).toEqual(["drafts"]); expect(dailyIndex.mediaHashes).toEqual([hash("daily-video")]);
  }));
  it("retains the exact manifest and makes no retry when the application save outcome is uncertain", () => temp(async dir => {
    const { source, profiles } = fixture();
    const client = vi.fn().mockImplementation(async (action: string) => { if (action === "drafts") return source; throw new Error("DRAFT_SAVE_UNCERTAIN"); });
    const renderer = vi.fn().mockResolvedValue({ state: "DRAFT_REVIEW_ONLY", approved: false, published: false, masterVideoHash: hash("master"), assets: [] });
    const runDir = path.join(dir, "uncertain");
    await expect(prepareWeeklyDraft({ week: source.week, runDir, profiles, client, renderer, archive: async () => [] })).rejects.toThrow("DRAFT_SAVE_UNCERTAIN");
    expect(JSON.parse(fs.readFileSync(path.join(runDir, "manifest.json"), "utf8"))).toEqual(client.mock.calls[1][1].manifest);
    expect(JSON.parse(fs.readFileSync(path.join(runDir, "state.json"), "utf8"))).toMatchObject({ state: "BLOCKED", code: "DRAFT_SAVE_UNCERTAIN" });
    expect(client).toHaveBeenCalledTimes(2);
    for (const result of [new Response("service failed", { status: 503 }), new Response("invalid json", { status: 200 }), new Response("null", { status: 200 })]) {
      const fetchImpl = vi.fn().mockResolvedValue(result);
      await expect(createWeeklyDraftClient({ token: "test-only", fetchImpl })("prepare", {})).rejects.toThrow("DRAFT_SAVE_UNCERTAIN");
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    }
  }));
});
