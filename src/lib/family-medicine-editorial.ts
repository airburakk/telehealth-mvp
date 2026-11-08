import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { FAMILY_MEDICINE_RESOURCES } from "./family-medicine";
import { FAMILY_MEDICINE_MONITORED_SOURCES } from "./family-medicine-refresh";
import { readFamilyMedicineWorkflowSourceState } from "./family-medicine-refresh-store";
import { ASM_WORKFLOWS, REPORT_WORKFLOWS, workflowPublicationGate, type WorkflowEditorialReview } from "./family-medicine-workflows";

export type EditorialEvidence = { sources: WorkflowEditorialReview["sources"]; nextReviewOn: string | null; sourceGap: string | null };
export type EditorialCommand = { workflowId: string; expectedRevision: number } & (
  | { action: "save"; evidence: EditorialEvidence }
  | { action: "review" | "revoke"; discipline: "clinical" | "legal" }
);
export class EditorialError extends Error { constructor(message: string, public status = 400) { super(message); } }
const catalog = [...REPORT_WORKFLOWS, ...ASM_WORKFLOWS];
function catalogHash(workflowId: string) {
  const workflow = catalog.find(w => w.id === workflowId);
  if (!workflow) return "retired-workflow"; // Historical rows must not break the queue. Mutations still reject unknown IDs.
  const sources = FAMILY_MEDICINE_RESOURCES.filter(s => workflow.sourceIds.includes(s.id));
  return createHash("sha256").update(JSON.stringify({ workflow, sources })).digest("hex");
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const exactKeys = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).every(k => keys.includes(k));
const bounded = (v: unknown, max: number): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= max;
function date(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const n = Date.parse(v + "T00:00:00Z");
  return Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === v;
}
export function parseEditorialCommand(value: unknown): EditorialCommand {
  if (!object(value) || !catalog.some(w => w.id === value.workflowId) || !Number.isSafeInteger(value.expectedRevision) || (Number(value.expectedRevision) < 0 || Number(value.expectedRevision) > 2147483646)) throw new EditorialError("Geçersiz başlık veya sürüm.");
  if (value.action === "save") {
    if (!exactKeys(value, ["workflowId", "expectedRevision", "action", "evidence"])) throw new EditorialError("Bilinmeyen alan.");
    const e = value.evidence;
    if (!object(e) || !exactKeys(e, ["sources", "nextReviewOn", "sourceGap"]) || !Array.isArray(e.sources) || e.sources.length > 12 || !(e.nextReviewOn === null || date(e.nextReviewOn)) || !(e.sourceGap === null || bounded(e.sourceGap, 2000))) throw new EditorialError("Geçersiz inceleme kanıtı.");
    for (const source of e.sources) {
      if (!object(source) || !exactKeys(source, ["url", "version", "locator", "applicability", "verifiedOn", "effectiveFrom", "effectiveUntil"]) || !bounded(source.url, 2000) || !bounded(source.version, 300) || !bounded(source.locator, 500) || !bounded(source.applicability, 2000) || !date(source.verifiedOn) || !date(source.effectiveFrom) || !(source.effectiveUntil === null || date(source.effectiveUntil))) throw new EditorialError("Kaynak alanları veya tarihleri geçersiz.");
      try { const u = new URL(source.url); if (u.protocol !== "https:" || u.username || u.password) throw new Error(); } catch { throw new EditorialError("Kaynak kimlik bilgisi içermeyen HTTPS adresi olmalı."); }
    }
  } else if ((value.action !== "review" && value.action !== "revoke") || !exactKeys(value, ["workflowId", "expectedRevision", "action", "discipline"]) || !["clinical", "legal"].includes(String(value.discipline))) throw new EditorialError("Geçersiz işlem.");
  return value as EditorialCommand;
}
export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !!origin && origin === new URL(request.url).origin && !["cross-site"].includes(request.headers.get("sec-fetch-site") ?? "");
}
export function schemaMissing(error: unknown) { return object(error) && ["P2021", "P2022"].includes(String(error.code)); }
export function grantIsActive(grant: { revokedAt: Date | null; grantedAt: Date; expiresAt: Date; qualificationReference: string } | null, now: Date) {
  return !!grant && !grant.revokedAt && grant.grantedAt <= now && grant.expiresAt > now && grant.qualificationReference.trim().length > 0;
}
export async function listEditorial(userId: string) {
  const now = new Date();
  const [items, events, grants] = await Promise.all([
    db.familyMedicineEditorial.findMany({ orderBy: { workflowId: "asc" } }),
    db.familyMedicineEditorialEvent.findMany({ orderBy: { createdAt: "desc" }, take: 300, select: { id: true, workflowId: true, revision: true, action: true, actorId: true, snapshotHash: true, createdAt: true } }),
    db.familyMedicineReviewerGrant.findMany({ where: { userId } }),
  ]);
  const enrichedItems = await Promise.all(items.map(async item => {
    const state = await readFamilyMedicineWorkflowSourceState(item.workflowId, now);
    const sourceChanged = !item.sourceFingerprint || item.sourceFingerprint !== state.fingerprint;
    return { ...item, catalogChanged: item.catalogHash !== catalogHash(item.workflowId), sourceChanged, sourceBlockers: state.blockers, events: events.filter(e => e.workflowId === item.workflowId) };
  }));
  return { items: enrichedItems, grants: { clinical: grants.some(g => g.discipline === "clinical" && grantIsActive(g, now)), legal: grants.some(g => g.discipline === "legal" && grantIsActive(g, now)) } };
}
export async function executeEditorial(command: EditorialCommand, actorId: string) {
  command = parseEditorialCommand(command);
  const now = new Date();
  return db.$transaction(async tx => {
    // DB role is checked again within the same transaction as the ledger write.
    const actor = await tx.user.findUnique({ where: { id: actorId }, select: { role: true } });
    if (actor?.role !== "ADMIN") throw new EditorialError("Yönetici yetkisi gerekli.", 403);
    const row = await tx.familyMedicineEditorial.findUnique({ where: { workflowId: command.workflowId } });
    if ((row?.revision ?? 0) !== command.expectedRevision) throw new EditorialError("Kayıt değişti; yenileyip tekrar inceleyin.", 409);
    if (!row && command.action !== "save") throw new EditorialError("Önce kanıt taslağını kaydedin.", 409);
    if (command.action === "review" && row!.catalogHash !== catalogHash(command.workflowId)) throw new EditorialError("Başlık veya kaynak kataloğu değişti; kanıtı yeniden kaydedip inceleyin.", 409);
    const sourceState = await readFamilyMedicineWorkflowSourceState(command.workflowId, now, tx);
    if (command.action === "review" && (sourceState.blockers.length > 0 || !sourceState.fingerprint || row!.sourceFingerprint !== sourceState.fingerprint)) throw new EditorialError("Kaynak izleme güncel değil veya kaynak değişti. " + sourceState.blockers.join(" ") + " Kanıtı yeniden kaydedip inceleyin.", 409);
    const revision = command.expectedRevision + 1;
    let evidence = (command.action === "save" ? command.evidence : row!.evidence) as EditorialEvidence;
    // Re-validate persisted evidence, failing closed if a manual DB edit broke the contract.
    evidence = (parseEditorialCommand({ action: "save", workflowId: command.workflowId, expectedRevision: command.expectedRevision, evidence }) as Extract<EditorialCommand, { action: "save" }>).evidence;
    let clinicalById = row?.clinicalById ?? null, clinicalAt = row?.clinicalAt ?? null;
    let legalById = row?.legalById ?? null, legalAt = row?.legalAt ?? null;
    if (command.action === "save") { clinicalById = null; clinicalAt = null; legalById = null; legalAt = null; }
    if (command.action === "review") {
      const monitored = new Set(FAMILY_MEDICINE_MONITORED_SOURCES.filter(s => s.workflowIds.includes(command.workflowId)).map(s => s.url));
      if (evidence.sources.some(source => !monitored.has(source.url))) throw new EditorialError("Kanıttaki kaynak izleme kapsamına kayıtlı değil. Taslak kaydedilebilir; kaynak yetkili kataloğa alınmadan onaylanamaz.");
      const grant = await tx.familyMedicineReviewerGrant.findUnique({ where: { userId_discipline: { userId: actorId, discipline: command.discipline } } });
      if (!grantIsActive(grant, now)) throw new EditorialError("Bu inceleme için doğrulanmış uzman yetkisi yok veya süresi dolmuş.", 403);
      const other = command.discipline === "clinical" ? legalById : clinicalById;
      if (other === actorId) throw new EditorialError("Hekim ve hukuk incelemelerini farklı kişiler yapmalı.", 403);
      const day = now.toISOString().slice(0, 10);
      const baseline = catalog.find(w => w.id === command.workflowId)!;
      // Test all evidence requirements with non-persisted placeholders for the OTHER
      // review; this does not record it or imply it took place.
      const gate = workflowPublicationGate({ ...baseline, status: "approved", sourceGap: evidence.sourceGap, review: { ...evidence, requiresPatientData: false, clinical: { reviewer: actorId, reviewedOn: day }, legal: { reviewer: actorId, reviewedOn: day } } }, now);
      if (!gate.publishable) throw new EditorialError(gate.blockers.join(" "));
      if (command.discipline === "clinical") { clinicalById = actorId; clinicalAt = now; } else { legalById = actorId; legalAt = now; }
    }
    if (command.action === "revoke") {
      if (command.discipline === "clinical") { clinicalById = null; clinicalAt = null; } else { legalById = null; legalAt = null; }
    }
    const data = { revision, sourceFingerprint: command.action === "save" ? sourceState.fingerprint : row!.sourceFingerprint, catalogHash: command.action === "save" ? catalogHash(command.workflowId) : row!.catalogHash, evidence: evidence as unknown as Prisma.InputJsonValue, clinicalById, clinicalAt, legalById, legalAt, updatedAt: now };
    if (row) {
      const result = await tx.familyMedicineEditorial.updateMany({ where: { workflowId: command.workflowId, revision: command.expectedRevision }, data });
      if (result.count !== 1) throw new EditorialError("Kayıt değişti; yenileyin.", 409);
    } else await tx.familyMedicineEditorial.create({ data: { workflowId: command.workflowId, ...data } });
    const snapshot = JSON.parse(JSON.stringify({ workflowId: command.workflowId, ...data })) as Prisma.InputJsonValue;
    const snapshotHash = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
    // Mandatory ledger insert: any failure rolls back the entire evidence/review write.
    await tx.familyMedicineEditorialEvent.create({ data: { workflowId: command.workflowId, revision, actorId, action: command.action === "save" ? "save" : `${command.action}:${command.discipline}`, snapshot, snapshotHash, createdAt: now } });
    return { ok: true, revision };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
