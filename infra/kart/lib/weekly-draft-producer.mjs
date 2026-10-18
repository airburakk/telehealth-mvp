// No timer, publisher or Daily Selection invocation. Explicit draft preparation only.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { renderRubrik, rubrikGovdeDogrula } from "./social-rubrik.mjs";
import { renderYoutubeReview } from "./review-video.mjs";
import { renderVideoReviewAdaptations } from "./video-adaptations.mjs";
import { validateWeeklyVideo } from "./weekly-video-media.mjs";

const CHANNELS = ["facebook", "instagram", "linkedin", "x", "youtube"];
const hash = b => createHash("sha256").update(b).digest("hex");
const fail = code => { throw new Error(code); };
const write = (file, value) => { const tmp = `${file}.tmp`; fs.writeFileSync(tmp, JSON.stringify(value, null, 2)); fs.renameSync(tmp, file); };
const publicUrl = value => {
  const u = new URL(value);
  if (u.protocol !== "https:" || u.username || u.password || u.search || u.hash || !u.hostname.includes(".") || /^(localhost|127\.|10\.|192\.168\.|169\.254\.)/.test(u.hostname)) fail("PUBLIC_ARCHIVE_URL_REQUIRED");
  return u;
};

/** Deterministic channel copy from the existing source-checked draft, never an
 * LLM call or manual rewrite. Long X captions become an ordered text thread;
 * unbreakable over-limit tokens fail instead of silently removing source text.
 */
export function draftChannelPosts(payload, { isAiGenerated, madeForKids, notifySubscribers, categoryId } = {}) {
  if (typeof isAiGenerated !== "boolean" || typeof madeForKids !== "boolean" || typeof notifySubscribers !== "boolean" || !Number.isInteger(categoryId)) fail("EXPLICIT_YOUTUBE_POLICY_REQUIRED");
  const text = [payload.caption, payload.hashtags?.join(" ")].filter(Boolean).join("\n\n");
  const title = payload.slides?.[0]?.title;
  if (!text || text.length > 2200 || typeof title !== "string" || !title.trim() || [...title].length > 100) fail("CHANNEL_TEXT_REQUIRES_EDITOR_REVIEW");
  const thread = []; let current = "";
  for (const word of text.split(/\s+/u)) {
    // UTF-8 bytes are deliberately conservative for X's weighted Unicode count.
    if (Buffer.byteLength(word) > 280) fail("X_TEXT_REQUIRES_EDITOR_REVIEW");
    if (Buffer.byteLength(current ? `${current} ${word}` : word) > 280) { thread.push(current); current = word; }
    else current = current ? `${current} ${word}` : word;
  }
  if (current) thread.push(current);
  return { facebook: { caption: text }, instagram: { caption: text }, linkedin: { text }, x: { text: thread[0], thread },
    youtube: { title, description: text, visibility: "public", isAiGenerated, madeForKids, notifySubscribers, categoryId } };
}

/** Reusable operator policy: local clock/account/disclosure choices are set once;
 * dates come from the existing weekly slots, never manually backdated content.
 */
export function weeklyTimes(slotDay, profile) {
  if (profile.scheduledAt) return { scheduledAt: profile.scheduledAt, publishTimes: profile.publishTimes, enqueueTimes: profile.enqueueTimes };
  const publishTimes = {}, enqueueTimes = {};
  for (const c of CHANNELS) {
    const clock = profile.publishClockTr?.[c], lead = profile.enqueueLeadHours?.[c] ?? 0;
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(clock ?? "") || !Number.isFinite(lead) || lead < 0 || lead > 24) fail("CHANNEL_TIME_POLICY_REQUIRED");
    const due = new Date(`${slotDay}T${clock}:00+03:00`);
    if (!Number.isFinite(due.getTime())) fail("CHANNEL_TIME_POLICY_REQUIRED");
    publishTimes[c] = due.toISOString(); enqueueTimes[c] = new Date(due.getTime() - lead * 3600000).toISOString();
  }
  return { scheduledAt: publishTimes.youtube, publishTimes, enqueueTimes };
}

/** Existing token stays in kart. This client can only read drafts/save a DRAFT.
 * Fixed production application origin; no redirects forwarding credentials.
 * Construction/import performs no requests. No network retry after uncertain saves.
 */
export function createWeeklyDraftClient({ token, fetchImpl = fetch }) {
  return async (action, data) => {
    if (!token || !["drafts", "prepare"].includes(action)) fail("DRAFT_CLIENT_DISABLED");
    let r, body;
    try {
      r = await fetchImpl("https://doctorium.tr/api/social-calendar/haftalik", { method: "POST", redirect: "error", signal: AbortSignal.timeout(120000),
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ ...data, action }) });
      body = await r.text();
    } catch { fail(action === "prepare" ? "DRAFT_SAVE_UNCERTAIN" : "DRAFT_READ_FAILED"); }
    if (action === "prepare" && r.status >= 500) fail("DRAFT_SAVE_UNCERTAIN");
    if (body.length > 4 * 1024 * 1024) fail(action === "prepare" ? "DRAFT_SAVE_UNCERTAIN" : "DRAFT_RESPONSE_TOO_LARGE");
    let j; try { j = JSON.parse(body); } catch { fail(action === "prepare" ? "DRAFT_SAVE_UNCERTAIN" : "DRAFT_RESPONSE_INVALID"); }
    if (!r.ok) fail(`DRAFT_REQUEST_REJECTED_${r.status}`);
    if (!j || j.ok !== true) fail(action === "prepare" ? "DRAFT_SAVE_UNCERTAIN" : "DRAFT_RESPONSE_INVALID");
    return j;
  };
}

/** Reuses an explicitly confirmed EXISTING HTTPS/static archive mapping. It does
 * not provision storage or add a public server route. Unconfirmed mapping blocks
 * writes. Content-addressed, exclusive files cannot replace reviewed media.
 * Read-back verifies every public byte before allowing the DRAFT manifest save.
 */
export function createWeeklyArchive({ root, publicBaseUrl, mappingVerified = false, fetchImpl = fetch }) {
  return async assets => {
    if (!mappingVerified) fail("EXISTING_PUBLIC_ARCHIVE_MAPPING_REQUIRED");
    const base = publicUrl(publicBaseUrl);
    if (!base.pathname.endsWith("/")) fail("ARCHIVE_BASE_MUST_END_WITH_SLASH");
    const destination = path.resolve(root); fs.mkdirSync(destination, { recursive: true });
    const result = [];
    for (const a of assets) {
      if (!/^[a-f0-9]{64}$/.test(a.sha256) || !["video.mp4", "post.json", "captions.srt"].includes(a.name)) fail("INVALID_ARCHIVE_ASSET");
      const bytes = fs.readFileSync(a.localPath);
      if (hash(bytes) !== a.sha256) fail("LOCAL_ASSET_CHANGED");
      const name = `${a.sha256}.${a.name.split(".").at(-1)}`, target = path.join(destination, name);
      try { fs.writeFileSync(target, bytes, { flag: "wx" }); }
      catch (e) { if (e.code !== "EEXIST" || hash(fs.readFileSync(target)) !== a.sha256) fail("ARCHIVE_WRITE_FAILED"); }
      const url = new URL(name, base).href;
      let r, content;
      try { r = await fetchImpl(url, { redirect: "error", signal: AbortSignal.timeout(90000) });
        if (!r.ok || Number(r.headers.get("content-length")) > bytes.length) fail("ARCHIVE_READ_FAILED");
        const reader = r.body?.getReader(); if (!reader) fail("ARCHIVE_READ_FAILED");
        const chunks = []; let size = 0;
        try { for (;;) { const next = await reader.read(); if (next.done) break; size += next.value.length; if (size > bytes.length) fail("ARCHIVE_BYTES_CHANGED"); chunks.push(Buffer.from(next.value)); } }
        finally { await reader.cancel(); }
        content = Buffer.concat(chunks);
      } catch { fail("ARCHIVE_READBACK_FAILED"); }
      if (hash(content) !== a.sha256) fail("PUBLIC_ASSET_CHANGED");
      const { localPath: _local, ...publicAsset } = a;
      result.push({ ...publicAsset, url });
    }
    return result;
  };
}

/** Actual card -> readable master -> five native assets. Existing renderer is
 * injected by kart, never launch a second browser or invoke /sosyal/uret.
 */
export function createWeeklyVideoRenderer({ getBrowser, spherePath, render = renderRubrik, video = renderYoutubeReview, adaptations = renderVideoReviewAdaptations, validateVideo = validateWeeklyVideo }) {
  return async ({ item, outDir, posts }) => {
    const g = rubrikGovdeDogrula(item.render); if (!g.ok) fail("RENDER_MODEL_INVALID");
    fs.mkdirSync(outDir);
    const cards = await render({ model: g.model, browser: await getBrowser(), spherePath });
    if (!cards?.slides?.length || cards.slides.length !== g.model.slides.length || cards.slides.some(s => s.tasma)) fail("RENDER_OVERFLOW_OR_MISSING_SLIDE");
    const pngPaths = cards.slides.map((s, i) => { const file = path.join(outDir, `${i + 1}.png`); fs.writeFileSync(file, s.png); return file; });
    await video({ slides: g.model.slides, pngPaths, outDir: path.join(outDir, "master") });
    const report = await adaptations({ masterPath: path.join(outDir, "master", "youtube-review.mp4"), outDir: path.join(outDir, "channels"), posts });
    for (const asset of report.assets.filter(a => a.name === "video.mp4")) await validateVideo(asset.localPath, asset.channel);
    const srt = path.join(outDir, "master", "youtube-review.srt");
    report.assets.push({ channel: "youtube", name: "captions.srt", sha256: hash(fs.readFileSync(srt)), localPath: srt });
    return report;
  };
}

/** One exclusive local run directory; failed/uncertain output is retained for
 * diagnosis, never silently overwritten or force-replayed. Configured post text
 * is derived from the source-checked payload; profiles contain reusable policy.
 * No approval, identity attestation, delivery claim or provider operation exists.
 */
export async function prepareWeeklyDraft({ week, runDir, profiles, client, renderer, archive }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week) || new Date(`${week}T00:00:00Z`).getUTCDay() !== 1) fail("MONDAY_REQUIRED");
  // mkdir is the cross-process lock; completed jobs are intentionally not removed.
  fs.mkdirSync(runDir, { recursive: false });
  const state = path.join(runDir, "state.json");
  write(state, { state: "READING_DRAFTS", approved: false, published: false });
  try {
    const source = await client("drafts", { week });
    if (source.week !== week || !Array.isArray(source.items) || source.items.length !== 3 || source.missing?.length || new Set(source.items.map(i => i.id)).size !== 3) fail("THREE_CURRENT_DRAFTS_REQUIRED");
    // Preflight the entire week before any card/media/archive side effects.
    const prepared = source.items.map(item => {
      const profile = profiles[item.seriesKey];
      if (item.state !== "DRAFT_REVIEW_ONLY" || !profile || !CHANNELS.every(c => profile.accounts?.[c])) fail("COMPLETE_CHANNEL_PROFILE_REQUIRED");
      // Identity ATTESTATION is supplied only by the eventual human approval.
      // Identity scanning, quotations, sources and protected human-note gates
      // must already pass before any potentially public staged media is written.
      if (!Array.isArray(item.gates?.gates) || item.gates.gates.some(g => g.severity === "block" && !g.ok && g.id !== "kimlik-onay")) fail("SOURCE_EDITORIAL_GATES_BLOCKED");
      const adaptedPosts = draftChannelPosts(item.payload, profile.youtubePolicy);
      const times = weeklyTimes(item.slotDay, profile);
      // Bind per-channel public text to the same explicit account/time as review.
      const posts = Object.fromEntries(CHANNELS.map(c => [c, { ...adaptedPosts[c], accountId: profile.accounts[c], dueAt: times.publishTimes?.[c] ?? times.scheduledAt }]));
      return { item, profile, times, posts };
    });
    const entries = [];
    for (const [index, { item, profile, times, posts }] of prepared.entries()) {
      write(state, { state: "RENDERING", item: index + 1, total: 3, approved: false, published: false });
      const report = await renderer({ item, outDir: path.join(runDir, `item-${index}`), posts });
      if (report.state !== "DRAFT_REVIEW_ONLY" || report.approved !== false || report.published !== false || !/^[a-f0-9]{64}$/.test(report.masterVideoHash)) fail("DRAFT_RENDER_RECEIPT_REQUIRED");
      write(state, { state: "ARCHIVING_AND_VERIFYING", item: index + 1, total: 3, approved: false, published: false });
      const assets = await archive(report.assets);
      if (assets.length !== report.assets.length || report.assets.some(a => !assets.some(b => b.channel === a.channel && b.name === a.name && b.sha256 === a.sha256 && b.sourceMasterHash === a.sourceMasterHash))) fail("ARCHIVE_RECEIPT_MISMATCH");
      entries.push({ id: item.id, version: item.version, seriesKey: item.seriesKey, slotDay: item.slotDay, contentHash: item.contentHash,
        ...times,
        mediaKind: "video", masterVideoHash: report.masterVideoHash, channels: CHANNELS, accounts: profile.accounts, assets });
    }
    const manifest = { v: 1, week, entries };
    write(path.join(runDir, "manifest.json"), manifest);
    write(state, { state: "SAVING_DRAFT", approved: false, published: false });
    const saved = await client("prepare", { manifest });
    if (!saved.package?.id || saved.package.status !== "DRAFT" || !/^[a-f0-9]{64}$/.test(saved.package.hash)) fail("DRAFT_SAVE_UNCERTAIN");
    const result = { state: "DRAFT_SAVED", package: saved.package, approved: false, published: false };
    write(state, result); return result;
  } catch (e) {
    // Never log arbitrary upstream text (may contain credentials/content).
    const code = /^[A-Z][A-Z0-9_]{1,99}$/.test(e.message) ? e.message : "PREPARATION_FAILED";
    write(state, { state: "BLOCKED", code, approved: false, published: false });
    throw new Error(code);
  }
}
