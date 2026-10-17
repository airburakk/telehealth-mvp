// Daily preparation on the existing reminder cron. Only empty FUTURE Etkinlik radarı slots.
// No editor edits, approvals, legal content, credentials, or social publishing here.
import { db } from "../db";
import { EVENT_TYPE_LABEL } from "../doctorium";
import { todayIsoTr } from "../iso-day";
import { adayNedeni, buildEtkinlikDraft, resmiAdlar, type EtkinlikKaydi } from "./etkinlik";
import { verifyEventPage } from "./event-evidence";
import { evaluateGates } from "./gates";
import { normalizePayload, parsePayload } from "./payload";
import { readPrimaryPage } from "./primary-page";
import { addDays, isoWeekday, seriesByKey } from "./series";

export function nextEventSlot(today: string): string {
  return addDays(today, ((8 - isoWeekday(today)) % 7) || 7);
}

export function sourceKey(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.username || u.password) return null;
    u.hash = "";
    for (const key of [...u.searchParams.keys()]) if (/^utm_|^(fbclid|gclid)$/i.test(key)) u.searchParams.delete(key);
    u.searchParams.sort();
    return u.toString().replace(/\/$/, "");
  } catch { return null; }
}

function ids(raw: string): string[] {
  try { const v: unknown = JSON.parse(raw); return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []; }
  catch { return []; }
}

const SELECT = {
  id: true, title: true, organizer: true, city: true, country: true, venue: true, startDate: true, endDate: true,
  abstractDeadline: true, earlyBirdDeadline: true, eventType: true, scope: true, ttbCode: true, url: true, warning: true,
  updatedAt: true, sourceUrls: true,
} as const;

export interface PreparationResult {
  slotDay: string;
  status: "created" | "preserved" | "blocked" | "conflict";
  reasons: string[];
  checked: number;
  itemId?: string;
}

export async function prepareEventDraft(now = new Date(), readPage = readPrimaryPage): Promise<PreparationResult> {
  const slotDay = nextEventSlot(todayIsoTr(now));
  const seriesKey = "etkinlik-radari";
  const where = { seriesKey_slotDay: { seriesKey, slotDay } };
  const base = { slotDay, reasons: [] as string[], checked: 0 };
  const existing = await db.contentPlanItem.findUnique({ where });
  if (existing && (existing.status !== "PLANNED" || existing.payload)) return { ...base, status: "preserved", itemId: existing.id };
  const previous = await db.contentPlanItem.findMany({
    where: { seriesKey, NOT: { slotDay } }, select: { sourceIds: true, payload: true },
  });
  const usedIds = new Set(previous.flatMap((r) => ids(r.sourceIds)));
  const usedUrls = new Set(previous.flatMap((r) => parsePayload(r.payload)?.sources.map((s) => sourceKey(s.ref)).filter(Boolean) ?? []));
  const pool = await db.medicalCongress.findMany({
    where: { source: "curated", confidence: "dogrulandi", startDate: { gte: new Date(`${slotDay}T00:00:00Z`), lte: new Date(`${addDays(slotDay, 60)}T23:59:59Z`) } },
    select: SELECT, orderBy: [{ startDate: "asc" }, { id: "asc" }], take: 100,
  });
  const selected: EtkinlikKaydi[] = [];
  const evidence: { id: string; url: string; hash: string; updatedAt: Date }[] = [];
  for (const event of pool) {
    const key = event.url ? sourceKey(event.url) : null;
    if (usedIds.has(event.id) || (key && usedUrls.has(key))) continue;
    if (!key || !ids(event.sourceUrls).some((u) => sourceKey(u) === key)) { base.reasons.push(`${event.id}:primary-url-missing`); continue; }
    if (!adayNedeni(event, slotDay)) continue;
    if (base.checked >= 5 || selected.length >= 3) break;
    base.checked++;
    try {
      const result = verifyEventPage(event, await readPage(event.url!));
      if (!result.ok) { base.reasons.push(`${event.id}:${result.reason}`); continue; }
      // Only start-window candidates are supported; deadline parsing must not establish eligibility.
      selected.push({ ...result.event, abstractDeadline: null, earlyBirdDeadline: null });
      evidence.push({ id: event.id, url: event.url!, hash: result.hash, updatedAt: event.updatedAt });
      usedUrls.add(key);
    } catch {
      // Network errors may contain URLs or intermediary details; persist only the stable reason.
      base.reasons.push(`${event.id}:primary-fetch-failed`);
    }
  }
  if (!selected.length) return { ...base, status: "blocked", reasons: [...base.reasons, "no-verified-unused-candidate"] };
  const raw = buildEtkinlikDraft(selected, slotDay, EVENT_TYPE_LABEL)!;
  raw.meta = { preparation: { checkedAt: now.toISOString(), sources: evidence.map(({ id, url, hash }) => ({ id, url, hash })) } };
  const normalized = normalizePayload(raw);
  if (!normalized.ok) return { ...base, status: "blocked", reasons: [...base.reasons, "payload-limits"] };
  const payload = normalized.payload;
  const series = seriesByKey(seriesKey)!;
  const report = evaluateGates({ series, payload, attestIdentity: false, sourceIds: selected.map((e) => e.id), sourceTexts: resmiAdlar(selected) });
  // A failing report is still an honest DRAFT, never an implicit approval.
  const data = { status: "DRAFT", sourceKind: "etkinlik", sourceIds: JSON.stringify(selected.map((e) => e.id)), payload: JSON.stringify(payload),
    gateReport: JSON.stringify(report), attestIdentity: false, approvedAt: null, approvedById: null, approvedBy: null, approvedHash: null };
  try {
    // Verification occurs outside the transaction; recheck source versions and CAS the empty slot inside it.
    const itemId = await db.$transaction(async (tx) => {
      // Recheck under a transaction-scoped lock: two runs around a Monday midnight may target
      // different slots, where the slot's unique key alone cannot prevent source reuse.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${0x4350}::int4, ${1}::int4)`;
      const current = await tx.contentPlanItem.findMany({ where: { seriesKey, NOT: { slotDay } }, select: { sourceIds: true, payload: true } });
      const selectedIds = new Set(selected.map((e) => e.id));
      const selectedUrls = new Set(evidence.map((e) => sourceKey(e.url)));
      if (current.some((r) => ids(r.sourceIds).some((id) => selectedIds.has(id))
        || parsePayload(r.payload)?.sources.some((s) => selectedUrls.has(sourceKey(s.ref))))) return null;
      const unchanged = await tx.medicalCongress.count({ where: { OR: evidence.map((e) => ({ id: e.id, updatedAt: e.updatedAt })) } });
      if (unchanged !== evidence.length) return null;
      if (existing) {
        const result = await tx.contentPlanItem.updateMany({ where: { id: existing.id, updatedAt: existing.updatedAt, status: "PLANNED", payload: null }, data });
        return result.count === 1 ? existing.id : null;
      }
      const row = await tx.contentPlanItem.create({ data: { ...data, seriesKey, slotDay } });
      return row.id;
    });
    return itemId ? { ...base, status: "created", itemId } : { ...base, status: "conflict", reasons: [...base.reasons, "source-or-slot-changed"] };
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") return { ...base, status: "conflict", reasons: [...base.reasons, "slot-already-created"] };
    throw e;
  }
}
