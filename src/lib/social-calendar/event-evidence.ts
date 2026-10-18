// Conservative primary-source check. Unsupported page formats are blocked, never guessed.
import { createHash } from "node:crypto";
import { formatIsoDayTr } from "../iso-day";
import { tarihAraligi, type EtkinlikKaydi } from "./etkinlik";

const normalize = (s: string) => s.toLocaleLowerCase("tr-TR").normalize("NFKC")
  .replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&")
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ").replace(/[–—−]/g, "-")
  .replace(/\b0(?=\d\b)/g, "").replace(/\s+/g, " ").replace(/\s*-\s*/g, "-").trim();

function jsonEvents(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const visit = (v: unknown, depth = 0): void => {
    if (depth > 12 || !v || typeof v !== "object") return;
    if (Array.isArray(v)) { for (const x of v) visit(x, depth + 1); return; }
    const o = v as Record<string, unknown>;
    const types = Array.isArray(o["@type"]) ? o["@type"] : [o["@type"]];
    if (types.includes("Event") || types.includes("MedicalEvent")) out.push(o);
    if (o["@graph"]) visit(o["@graph"], depth + 1);
  };
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { visit(JSON.parse(m[1]!)); } catch { /* Unsupported source: no evidence. */ }
  }
  return out;
}

export type EventEvidence = { ok: true; hash: string; event: EtkinlikKaydi } | { ok: false; reason: string };

/** URL is the curated official event URL, not a search result or user-supplied request input. */
export function verifyEventPage(event: EtkinlikKaydi, html: string): EventEvidence {
  const start = event.startDate.toISOString().slice(0, 10);
  const end = event.endDate?.toISOString().slice(0, 10) ?? start;
  const text = normalize(html);
  if (/\b(?:iptal edil|ertelen|cancelled|canceled|postponed)/u.test(text)) return { ok: false, reason: "primary-event-status" };
  const date = (v: unknown): string | null => typeof v === "string" && /^\d{4}-\d{2}-\d{2}(?:$|T\d{2}:\d{2})/.test(v)
    && Number.isFinite(Date.parse(v)) ? v.slice(0, 10) : null;
  const structured = jsonEvents(html).filter((o) => typeof o.name === "string" && normalize(o.name) === normalize(event.title));
  // A current structured record that contradicts the DB must not be overridden by old footer text.
  if (structured.some((o) => date(o.startDate) !== start
    || (o.endDate !== undefined && date(o.endDate) !== end)
    || (typeof o.eventStatus === "string" && !/\/EventScheduled$/.test(o.eventStatus)))) {
    return { ok: false, reason: "primary-date-conflict" };
  }
  const matching = structured.find((o) => date(o.startDate) === start && (end === start ? !o.endDate || date(o.endDate) === end : date(o.endDate) === end));
  const dateText = normalize(tarihAraligi(event.startDate, event.endDate));
  if (!matching && !(text.includes(normalize(event.title)) && text.includes(dateText))) {
    return { ok: false, reason: "primary-evidence-missing" };
  }
  // Do not copy unverified registration deadlines, venue, or city into an automated draft.
  const confirmed = (s: string | null) => s && text.includes(normalize(s)) ? s : null;
  const deadline = (d: Date | null) => d && text.includes(normalize(formatIsoDayTr(d.toISOString().slice(0, 10)))) ? d : null;
  return { ok: true, hash: createHash("sha256").update(html).digest("hex"), event: {
    ...event, city: confirmed(event.city), venue: confirmed(event.venue), organizer: confirmed(event.organizer),
    abstractDeadline: deadline(event.abstractDeadline), earlyBirdDeadline: deadline(event.earlyBirdDeadline),
    // A TTB code is not established by a general event page.
    ttbCode: null,
  } };
}
