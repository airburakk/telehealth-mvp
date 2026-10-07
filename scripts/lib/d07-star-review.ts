// Offline, targeted review. A real metadata export is required; no DB or env imports.
import { EDU_OPPORTUNITIES } from "../../src/lib/edu-opportunities";

export interface StarSnapshot {
  id: string; kind: string; title: string; organizer: string;
  deadline: string | null; deadlineNote: string | null; startsAt: string | null;
  eligibility: string; sourceUrl: string; verifiedAt: string;
  approvedAt: string | null; updatedAt: string;
}

export function reviewD07Star(row: StarSnapshot) {
  const star = EDU_OPPORTUNITIES.find((o) => o.id === "tubitak-2247c-star")!;
  let official = false;
  try { official = new URL(row.sourceUrl).hostname === "tubitak.gov.tr"; } catch { /* fail closed */ }
  if (row.id !== star.id || row.kind !== "burs" || row.organizer !== star.organizer ||
      !official || !row.updatedAt || Number.isNaN(Date.parse(row.updatedAt))) {
    return { mode: "dry-run", status: "identity-or-snapshot-mismatch", proposed: null } as const;
  }
  const proposed = {
    title: star.title, deadline: star.deadline, deadlineNote: star.deadlineNote,
    eligibility: star.eligibility, sourceUrl: star.sourceUrl, verifiedAt: star.verifiedAt,
  };
  const same = Object.entries(proposed).every(([key, value]) => row[key as keyof StarSnapshot] === value);
  return {
    mode: "dry-run", status: same ? "no-change" : "approval-required",
    expectedOldValue: { ...row }, proposed: same ? null : proposed,
    preserve: ["approvedAt", "startsAt", "kind", "organizer", "country", "createdAt", "follows", "sentAlerts"],
    guard: "Future approved transaction must compare every old value, including updatedAt; exactly one row, no upsert or bulk seed",
  } as const;
}
