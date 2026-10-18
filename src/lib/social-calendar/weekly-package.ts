/** Offline contract for the weekly review. Not an approval store or a publishing endpoint.
 * A hash is integrity evidence, never proof that a human approved anything.
 * The future authenticated approval service must persist the receipt and delivery claims.
 */
import { createHash } from "node:crypto";
import { payloadHash, type PlanPayload } from "./payload";
import { addDays, isDayString, slotsOfWeek } from "./series";

export const WEEKLY_CHANNELS = ["facebook", "instagram", "linkedin", "x", "youtube"] as const;
export type WeeklyChannel = typeof WEEKLY_CHANNELS[number];
export interface WeeklyEntry {
  id: string;
  version: string;
  seriesKey: string;
  slotDay: string;
  contentHash: string;
  scheduledAt: string;
  publishTimes?: Partial<Record<WeeklyChannel, string>>;
  enqueueTimes?: Partial<Record<WeeklyChannel, string>>;
  mediaKind?: "video" | "carousel";
  masterVideoHash?: string;
  channels: WeeklyChannel[];
  accounts?: Partial<Record<WeeklyChannel, string>>;
  /** Final rendered files, including MP4, audio, captions and channel-specific text. */
  assets: { channel: WeeklyChannel; name: string; sha256: string; url?: string; sourceMasterHash?: string }[];
}
export interface WeeklyManifest { v: 1; week: string; entries: WeeklyEntry[] }
export interface WeeklySnapshot {
  id: string; version: string; seriesKey: string; slotDay: string; payload: PlanPayload;
  /** Fresh existing evaluateGates result, supplied by the authenticated server, never n8n input. */
  gatesPassed: boolean;
}
const HASH = /^[a-f0-9]{64}$/;
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
const instant = (s: string) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s) && Number.isFinite(Date.parse(s));

/** Canonical order makes a review stable; every schedule, channel and final file is sealed. */
export function weeklyManifestHash(manifest: WeeklyManifest): string {
  return digest(JSON.stringify({
    v: manifest.v, week: manifest.week,
    entries: [...manifest.entries].sort((a, b) => a.id.localeCompare(b.id)).map(e => ({
      id: e.id, version: e.version, seriesKey: e.seriesKey, slotDay: e.slotDay,
      contentHash: e.contentHash, scheduledAt: e.scheduledAt,
      publishTimes: e.publishTimes ? Object.fromEntries([...e.channels].sort().filter(c => e.publishTimes?.[c]).map(c => [c, e.publishTimes?.[c]])) : undefined,
      enqueueTimes: e.enqueueTimes ? Object.fromEntries([...e.channels].sort().filter(c => e.enqueueTimes?.[c]).map(c => [c, e.enqueueTimes?.[c]])) : undefined,
      mediaKind: e.mediaKind, masterVideoHash: e.masterVideoHash,
      channels: [...e.channels].sort(),
      accounts: e.accounts ? Object.fromEntries([...e.channels].sort().map(c => [c, e.accounts?.[c]])) : undefined,
      assets: [...e.assets].sort((a, b) => `${a.channel}/${a.name}`.localeCompare(`${b.channel}/${b.name}`))
        .map(a => ({ channel: a.channel, name: a.name, sha256: a.sha256, url: a.url, sourceMasterHash: a.sourceMasterHash })),
    })),
  }));
}

/** Review completeness only. This function never creates an approval or changes a plan status. */
export function reviewWeeklyPackage(manifest: WeeklyManifest, snapshots: WeeklySnapshot[], now: Date): string[] {
  const errors: string[] = [];
  if (manifest.v !== 1 || !isDayString(manifest.week) || new Date(`${manifest.week}T00:00:00Z`).getUTCDay() !== 1)
    return ["week: Monday date required"];
  if (!Number.isFinite(now.getTime())) return ["now: invalid time"];
  const slots = slotsOfWeek(manifest.week);
  if (manifest.entries.length !== slots.length) errors.push("week: all three rubric slots required");
  if (new Set(manifest.entries.map(e => e.id)).size !== manifest.entries.length) errors.push("week: duplicate item");
  if (new Set(snapshots.map(e => e.id)).size !== snapshots.length) errors.push("snapshots: duplicate item");
  for (const slot of slots) {
    if (manifest.entries.filter(e => e.seriesKey === slot.series.key && e.slotDay === slot.slotDay).length !== 1)
      errors.push(`${slot.slotDay}: rubric slot missing or duplicated`);
  }
  for (const e of manifest.entries) {
    const prefix = e.id || "item";
    const row = snapshots.find(s => s.id === e.id);
    if (!row || !e.id || !instant(e.version) || row.version !== e.version || row.seriesKey !== e.seriesKey || row.slotDay !== e.slotDay)
      errors.push(`${prefix}: stale or missing snapshot`);
    if (!HASH.test(e.contentHash) || (row && payloadHash(row.payload) !== e.contentHash)) errors.push(`${prefix}: content changed`);
    if (!row?.gatesPassed) errors.push(`${prefix}: existing editorial gates not passed`);
    const trDay = instant(e.scheduledAt) ? new Date(Date.parse(e.scheduledAt) + 3 * 3600_000).toISOString().slice(0, 10) : "";
    if (!trDay || trDay !== e.slotDay || e.slotDay < manifest.week || e.slotDay >= addDays(manifest.week, 7) || Date.parse(e.scheduledAt) <= now.getTime())
      errors.push(`${prefix}: schedule must be future and on its Turkey slot day`);
    for (const c of WEEKLY_CHANNELS) {
      const publish = e.publishTimes?.[c] ?? e.scheduledAt, enqueue = e.enqueueTimes?.[c] ?? publish;
      const day = instant(publish) ? new Date(Date.parse(publish) + 10800000).toISOString().slice(0, 10) : "";
      if (day !== e.slotDay || Date.parse(publish) <= now.getTime()) errors.push(`${prefix}: ${c} publication time invalid`);
      if (!instant(enqueue) || Date.parse(enqueue) <= now.getTime() || Date.parse(enqueue) > Date.parse(publish) || Date.parse(publish) - Date.parse(enqueue) > 86400000)
        errors.push(`${prefix}: ${c} enqueue time invalid`);
      if (e.mediaKind === "video" && (!HASH.test(e.masterVideoHash ?? "") || !e.assets.some(a => a.channel === c && a.name.endsWith(".mp4") && a.sourceMasterHash === e.masterVideoHash)))
        errors.push(`${prefix}: ${c} native video adaptation from the reviewed master missing`);
    }
    if (e.channels.length !== WEEKLY_CHANNELS.length || new Set(e.channels).size !== WEEKLY_CHANNELS.length || WEEKLY_CHANNELS.some(c => !e.channels.includes(c)))
      errors.push(`${prefix}: all five distinct channels required`);
    const names = new Set<string>();
    for (const a of e.assets) {
      const key = `${a.channel}/${a.name}`;
      if (!WEEKLY_CHANNELS.includes(a.channel) || !e.channels.includes(a.channel) || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/.test(a.name) || names.has(key) || !HASH.test(a.sha256))
        errors.push(`${prefix}: invalid or duplicate final asset`);
      names.add(key);
    }
    for (const c of WEEKLY_CHANNELS) if (!e.assets.some(a => a.channel === c)) errors.push(`${prefix}: ${c} preview missing`);
    if (!e.assets.some(a => a.channel === "youtube" && a.name.endsWith(".mp4"))) errors.push(`${prefix}: final YouTube MP4 missing`);
  }
  return errors;
}

/** Stable per-platform idempotency key. Persist and claim it BEFORE contacting a platform.
 * A timeout after upload stays UNKNOWN; retries require reconciliation with platform IDs.
 */
export function weeklyDeliveryKey(manifestHash: string, itemId: string, channel: WeeklyChannel): string {
  if (!HASH.test(manifestHash) || !itemId || !WEEKLY_CHANNELS.includes(channel)) throw new Error("Invalid delivery key input");
  return digest(JSON.stringify(["doctorium-weekly-v1", manifestHash, itemId, channel]));
}
