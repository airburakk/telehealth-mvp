import { db } from "../db";
import { todayIsoTr } from "../iso-day";
import { evaluateGates } from "./gates";
import { normalizePayload, parsePayload } from "./payload";
import { sourceKey, type PreparationResult } from "./prepare-events";
import { readPrimaryPage, readPrimaryPdf } from "./primary-page";
import { addDays, isoWeekday, seriesByKey } from "./series";
import { buildStudentDraft, readStudentCall, sourceDigest, supportsStudentSource, TUBITAK_2209A_URL, verifyStudentRules } from "./student-evidence";

export function nextStudentSlot(today: string): string {
  return addDays(today, ((12 - isoWeekday(today)) % 7) || 7);
}

export async function readStudentPdf(url: string): Promise<{ text: string; hash: string }> {
  const bytes = await readPrimaryPdf(url);
  const hash = sourceDigest(bytes);
  const { extractText, getDocumentProxy } = await import("unpdf");
  const document = await getDocumentProxy(new Uint8Array(bytes));
  try {
    if (document.numPages > 25) throw new Error("primary-pdf-too-many-pages");
    const { text } = await extractText(document, { mergePages: true });
    if (typeof text !== "string" || text.length > 150_000) throw new Error("primary-pdf-text-rejected");
    return { text, hash };
  } finally { await document.loadingTask.destroy(); }
}

/** Supported official source adapter only; no approval of either the opportunity or the social draft. */
export async function prepareStudentDraft(now = new Date(), readers = { page: readPrimaryPage, pdf: readStudentPdf }): Promise<PreparationResult> {
  const slotDay = nextStudentSlot(todayIsoTr(now));
  const seriesKey = "ogrenci-kosesi";
  const base = { slotDay, reasons: [] as string[], checked: 0 };
  const existing = await db.contentPlanItem.findUnique({ where: { seriesKey_slotDay: { seriesKey, slotDay } } });
  if (existing && (existing.status !== "PLANNED" || existing.payload)) return { ...base, status: "preserved", itemId: existing.id };
  const opportunities = await db.eduOpportunity.findMany({ where: { approvedAt: { not: null } }, orderBy: { id: "asc" } });
  const supported = opportunities.filter(supportsStudentSource);
  if (!supported.length) return { ...base, status: "blocked", reasons: ["no-approved-supported-student-source"] };
  // Registry currently supports one program. Duplicate DB rows must not trigger duplicate requests.
  const opportunity = supported[0]!;
  base.checked = 1;
  let html: string;
  try { html = await readers.page(TUBITAK_2209A_URL); }
  catch { return { ...base, status: "blocked", reasons: ["student-primary-fetch-failed"] }; }
  const callResult = readStudentCall(html, slotDay, now);
  if (!callResult.ok) return { ...base, status: "blocked", reasons: [callResult.reason] };
  const call = callResult.value;
  const previous = await db.contentPlanItem.findMany({ where: { seriesKey, NOT: { slotDay } }, select: { sourceIds: true, payload: true } });
  const alreadyUsed = (rows: typeof previous) => rows.some((r) => {
    const p = parsePayload(r.payload);
    const callKey = p?.meta?.preparation?.callKey;
    if (callKey) return callKey === call.callKey;
    // Legacy/manual records have no cycle marker: do not assume they belong to an older call.
    let ids: unknown = [];
    try { ids = JSON.parse(r.sourceIds); } catch { /* Source URLs still protect manual drafts. */ }
    return (Array.isArray(ids) && supported.some((s) => ids.includes(s.id)))
      || !!p?.sources.some((s) => supportsStudentSource({ title: "2209-A", sourceUrl: sourceKey(s.ref) ?? "" }));
  });
  if (alreadyUsed(previous)) return { ...base, status: "blocked", reasons: ["student-call-already-used"] };
  let pdf: { text: string; hash: string };
  try { pdf = await readers.pdf(call.pdfUrl); }
  catch { return { ...base, status: "blocked", reasons: ["student-primary-pdf-failed"] }; }
  const rules = verifyStudentRules(pdf.text, call);
  if (!rules.ok) return { ...base, status: "blocked", reasons: [rules.reason] };
  const raw = buildStudentDraft(call);
  raw.meta = { preparation: { checkedAt: now.toISOString(), callKey: call.callKey, deadlineAt: call.deadlineAt, sources: [
    { id: opportunity.id, url: TUBITAK_2209A_URL, hash: sourceDigest(html) }, { id: opportunity.id, url: call.pdfUrl, hash: pdf.hash },
  ] } };
  const normalized = normalizePayload(raw);
  if (!normalized.ok) return { ...base, status: "blocked", reasons: ["student-payload-limits"] };
  const payload = normalized.payload;
  const report = evaluateGates({ series: seriesByKey(seriesKey)!, payload, attestIdentity: false, sourceIds: [opportunity.id], sourceTexts: [], now });
  const data = { status: "DRAFT", sourceKind: "kariyer-edu", sourceIds: JSON.stringify([opportunity.id]), payload: JSON.stringify(payload),
    gateReport: JSON.stringify(report), attestIdentity: false, approvedAt: null, approvedById: null, approvedBy: null, approvedHash: null };
  try {
    const itemId = await db.$transaction(async (tx) => {
      // Across a Friday midnight, concurrent requests can target different weeks. Serialize the
      // final duplicate check and write across slots, not only inserts into the same unique slot.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${0x4350}::int4, ${2}::int4)`;
      const current = await tx.contentPlanItem.findMany({ where: { seriesKey, NOT: { slotDay } }, select: { sourceIds: true, payload: true } });
      if (alreadyUsed(current)) return null;
      const unchanged = await tx.eduOpportunity.count({ where: { id: opportunity.id, updatedAt: opportunity.updatedAt, approvedAt: { not: null } } });
      if (unchanged !== 1) return null;
      if (existing) {
        const r = await tx.contentPlanItem.updateMany({ where: { id: existing.id, updatedAt: existing.updatedAt, status: "PLANNED", payload: null }, data });
        return r.count === 1 ? existing.id : null;
      }
      return (await tx.contentPlanItem.create({ data: { ...data, seriesKey, slotDay } })).id;
    });
    return itemId ? { ...base, status: "created", itemId } : { ...base, status: "conflict", reasons: ["student-source-or-slot-changed"] };
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") return { ...base, status: "conflict", reasons: ["student-slot-already-created"] };
    throw e;
  }
}
