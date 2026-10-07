// İçerik takvimi — SERVİS katmanı (v6.328, 2026-10-06): ContentPlanItem üzerinde okuma/yazma + durum geçişleri + onay mührü.
//
// Tasarım ilkeleri:
//  • TEK EDİTÖR (👤 2026-10-06: hazırlayan = onaylayan). Yine de iki sekme/oturum çakışabilir → İYİMSER EŞZAMANLILIK: her yazma `expectedVersion`
//    (= updatedAt ISO) ister ve `updateMany({ where: { id, updatedAt, status } })` ile ATOMİK koşar; 0 satır → PlanConflict (409), sayfa yenilenir.
//  • ONAYIN DÜŞMESİ: onaylı içerik düzenlenirse/kaynağı değişirse DRAFT'a iner, `approved*` temizlenir (LegalTranslationApproval.textHash ilkesi) ve
//    audit'e UNAPPROVE yazılır. Yayın hattı (Faz 3) yalnız `isApprovedIntact` olanı yayınlar: onaydan sonra içerik 1 bayt değişmişse YAYINLANMAZ.
//  • ONAY KARARI HER ZAMAN YENİDEN HESAPLANIR: `gateReport` yalnız ekranda gösterilen son rapordur; approve() kapıları taze kaynak metniyle koşar.
//  • YAYINLANIYOR KİLİDİ (v6.334): otomasyon içeriği `claimForPublish` ile ALIR (APPROVED → PUBLISHING, atomik CAS) → EN FAZLA BİR KEZ yayın; takılı kalırsa
//    belirsizliği İNSAN çözer (`markPublished` elle / `retryPublish`). Makine çağrıları oturumsuzdur: `actor: null` → denetim/etiket "otomasyon".
//  • GET'te YAZMA YOK: yuva satırı yalnız "Yuvayı aç" ile oluşur (openSlot).
//  • İçerik PHI DEĞİL (kamuya açık karar/etkinlik metadata'sı + editör metni) → şifresiz; audit'e içerik YAZILMAZ, yalnız rubrik·gün·hash öneki.
import { db } from "../db";
import { recordAccess } from "../audit";
import type { SessionUser } from "../session";
import { evaluateGates, type GateReport } from "./gates";
import { buildKararDraft, pickKararCandidates, type KararCandidate, type PickContext, type PickResult } from "./karar";
import { LIMITS } from "./limits";
import { applyEditorNote, noteFromPayload, normalizePayload, parsePayload, payloadHash, type PlanPayload } from "./payload";
import { cleanErrorText, normalizeChannels, normalizeFailures, parsePublication, type Publication } from "./publication";
import { renderRubrik } from "./render-client";
import { isDayString, seriesByKey, slotMatchesSeries, slotsOfWeek, type SeriesDef, type SeriesKey } from "./series";
import { skeletonPayload } from "./skeleton";
import { isEditable, isPlanStatus, nextStatus, type PlanStatus } from "./status";

// ── Hatalar ──────────────────────────────────────────────────────────────────────────────────────────

/** İstek geçersiz / geçiş yasak. `status` HTTP kodunu taşır (400 varsayılan, 404 bulunamadı, 409 geçiş yasak). */
export class PlanError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
  }
}

/** Satır, kullanıcının gördüğünden beri değişti (başka sekme/oturum) → 409; sayfa yenilenir. */
export class PlanConflict extends PlanError {
  constructor(message = "İçerik, sayfayı açtığınızdan beri değişti — yenileyip tekrar deneyin.") {
    super(message, 409);
  }
}

/** Onay kapıları geçmedi → 422; rapor ekranda gösterilir. */
export class PlanGateError extends PlanError {
  constructor(readonly report: GateReport) {
    super("Onay kapıları geçilmedi.", 422);
  }
}

// ── Görünümler ───────────────────────────────────────────────────────────────────────────────────────

export interface PlanItemView {
  id: string;
  seriesKey: SeriesKey;
  slotDay: string;
  status: PlanStatus;
  sourceIds: string[];
  candidates: KararCandidate[];
  payload: PlanPayload | null;
  /** textarea metni: cikarim slaytı maddelerinden türetilir (gerçek kaynak payload'dır). */
  editorNote: string;
  attestIdentity: boolean;
  gateReport: GateReport | null;
  approvedAt: string | null;
  approvedBy: string | null;
  /** Onaylı + kayıtlı hash ile içerik hash'i eşleşiyor mu (yayın hattının kullanacağı bütünlük bilgisi). */
  approvedIntact: boolean;
  /** Yayınlandı olarak işaretlendiği an (PUBLISHED). */
  publishedAt: string | null;
  /** `publishedRefs`'ten: PUBLISHED'da kanallar + bağlantılar, FAILED'da hata notu; bozuk kayıt → null. */
  publication: Publication | null;
  /** İyimser eşzamanlılık belirteci (= updatedAt ISO). Her yazma bunu geri yollar. */
  version: string;
}

export interface WeekSlot {
  series: SeriesDef;
  slotDay: string;
  item: PlanItemSummary | null;
}

export interface PlanItemSummary {
  id: string;
  status: PlanStatus;
  headline: string | null;
  hasPayload: boolean;
  approvedAt: string | null;
  approvedBy: string | null;
  sourceIds: string[];
}

type Row = NonNullable<Awaited<ReturnType<typeof db.contentPlanItem.findUnique>>>;

function parseJsonArray<T>(s: string | null | undefined): T[] {
  if (!s) return [];
  try {
    const v: unknown = JSON.parse(s);
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

function parseGateReport(s: string | null | undefined): GateReport | null {
  if (!s) return null;
  try {
    const v = JSON.parse(s) as GateReport;
    return v && Array.isArray(v.gates) && typeof v.ok === "boolean" ? v : null;
  } catch {
    return null;
  }
}

/** Onay mührü içerikle eşleşiyor mu: kayıtlı hash == içeriğin şimdiki hash'i (durumdan BAĞIMSIZ — FAILED yeniden denemesi de bunu sorar). */
function sealMatches(row: { payload: string | null; approvedHash: string | null }): boolean {
  if (!row.approvedHash) return false;
  const p = parsePayload(row.payload);
  return !!p && payloadHash(p) === row.approvedHash;
}

/** Onaylı satırın yayın-bütünlüğü: APPROVED + kayıtlı hash == içeriğin şimdiki hash'i. */
export function isApprovedIntact(row: { status: string; payload: string | null; approvedHash: string | null }): boolean {
  return row.status === "APPROVED" && sealMatches(row);
}

export function toView(row: Row): PlanItemView {
  const payload = parsePayload(row.payload);
  return {
    id: row.id,
    seriesKey: row.seriesKey as SeriesKey,
    slotDay: row.slotDay,
    status: isPlanStatus(row.status) ? row.status : "PLANNED",
    sourceIds: parseJsonArray<string>(row.sourceIds).filter((x): x is string => typeof x === "string"),
    candidates: parseJsonArray<KararCandidate>(row.candidates),
    payload,
    editorNote: noteFromPayload(payload),
    attestIdentity: row.attestIdentity,
    gateReport: parseGateReport(row.gateReport),
    approvedAt: row.approvedAt?.toISOString() ?? null,
    approvedBy: row.approvedBy ?? null,
    approvedIntact: isApprovedIntact(row),
    publishedAt: row.publishedAt?.toISOString() ?? null,
    publication: parsePublication(row.publishedRefs),
    version: row.updatedAt.toISOString(),
  };
}

function toSummary(row: Row): PlanItemSummary {
  const payload = parsePayload(row.payload);
  return {
    id: row.id,
    status: isPlanStatus(row.status) ? row.status : "PLANNED",
    headline: payload?.slides.find((s) => s.role === "kapak")?.title || null,
    hasPayload: !!payload,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    approvedBy: row.approvedBy ?? null,
    sourceIds: parseJsonArray<string>(row.sourceIds).filter((x): x is string => typeof x === "string"),
  };
}

// ── Okuma ────────────────────────────────────────────────────────────────────────────────────────────

/** Haftanın rubrik yuvaları (gün sırasında) ve varsa satırları. Yazma YOK. */
export async function listWeek(monday: string): Promise<WeekSlot[]> {
  if (!isDayString(monday)) throw new PlanError("Geçersiz hafta.");
  const slots = slotsOfWeek(monday);
  const rows = await db.contentPlanItem.findMany({ where: { slotDay: { in: slots.map((s) => s.slotDay) } } });
  const byKey = new Map(rows.map((r) => [`${r.seriesKey}|${r.slotDay}`, r]));
  return slots.map(({ series, slotDay }) => {
    const row = byKey.get(`${series.key}|${slotDay}`);
    return { series, slotDay, item: row ? toSummary(row) : null };
  });
}

export async function getItem(id: string): Promise<PlanItemView | null> {
  const row = await db.contentPlanItem.findUnique({ where: { id } });
  return row ? toView(row) : null;
}

async function mustGet(id: string): Promise<Row> {
  const row = await db.contentPlanItem.findUnique({ where: { id } });
  if (!row) throw new PlanError("Yuva bulunamadı.", 404);
  return row;
}

function seriesOf(row: Row): SeriesDef {
  const s = seriesByKey(row.seriesKey);
  if (!s) throw new PlanError("Bilinmeyen rubrik.", 400);
  return s;
}

function parseVersion(v: unknown): Date {
  const d = typeof v === "string" ? new Date(v) : null;
  if (!d || Number.isNaN(d.getTime())) throw new PlanError("Sürüm bilgisi eksik ya da geçersiz — sayfayı yenileyin.");
  return d;
}

/** Seçili kaynakların metinleri (alıntı doğrulaması): hukuk günü NewsArticle.summary; diğer rubriklerde boş. */
async function loadSourceTexts(series: SeriesDef, ids: string[]): Promise<string[]> {
  if (series.sourceKind !== "ictihat" || ids.length === 0) return [];
  const rows = await db.newsArticle.findMany({ where: { id: { in: ids } }, select: { summary: true } });
  return rows.map((r) => r.summary);
}

// ── Yuva açma ────────────────────────────────────────────────────────────────────────────────────────

/** Yuva satırını oluşturur (varsa aynen döner — idempotent). Rubrik haftanın DOĞRU gününde olmalı. */
export async function openSlot(input: { seriesKey: string; slotDay: string }): Promise<PlanItemView> {
  const series = seriesByKey(input.seriesKey);
  if (!series) throw new PlanError("Bilinmeyen rubrik.");
  if (!slotMatchesSeries(series, input.slotDay)) throw new PlanError(`“${series.name}” bu günde yayınlanmaz.`);
  const where = { seriesKey_slotDay: { seriesKey: series.key, slotDay: input.slotDay } };
  try {
    const row = await db.contentPlanItem.upsert({ where, create: { seriesKey: series.key, slotDay: input.slotDay, sourceKind: series.sourceKind }, update: {} });
    return toView(row);
  } catch (e) {
    // Çift tıklama/iki sekme: Prisma upsert eşzamanlı INSERT'te benzersizlik ihlali (P2002) fırlatabilir → kazanan satır okunur (idempotent kalır).
    if ((e as { code?: string } | null)?.code !== "P2002") throw e;
    const row = await db.contentPlanItem.findUnique({ where });
    if (!row) throw e;
    return toView(row);
  }
}

// ── Aday seçimi (yalnız üreticili rubrik) ────────────────────────────────────────────────────────────

const POOL_SIZE = 150;

/** Önceki onaylı/yayınlanmış içeriklerden tema/sonuç bağlamı (çeşitlilik cezası için; en yeni başta). */
async function pickContext(series: SeriesDef, excludeId: string): Promise<PickContext> {
  const recent = await db.contentPlanItem.findMany({
    where: { seriesKey: series.key, status: { in: ["APPROVED", "PUBLISHED"] }, id: { not: excludeId } },
    orderBy: { slotDay: "desc" },
    take: 4,
    select: { payload: true },
  });
  const metas = recent.map((r) => parsePayload(r.payload)?.meta).filter((m): m is NonNullable<typeof m> => !!m);
  return {
    recentThemes: metas.map((m) => m.theme).filter((t): t is string => !!t),
    recentOutcomes: metas.map((m) => m.sonuc).filter((t): t is string => !!t),
  };
}

/** Başka yuvalarda (taslak/onaylı/yayınlanmış/hatalı) kullanılmış kaynak kimlikleri — aynı karar iki haftaya düşmesin. */
async function usedSourceIds(series: SeriesDef, excludeId: string): Promise<string[]> {
  const rows = await db.contentPlanItem.findMany({
    where: { seriesKey: series.key, status: { in: ["DRAFT", "APPROVED", "PUBLISHED", "FAILED"] }, id: { not: excludeId } },
    select: { sourceIds: true },
  });
  return rows.flatMap((r) => parseJsonArray<string>(r.sourceIds).filter((x): x is string => typeof x === "string"));
}

export async function computeCandidates(input: { id: string }): Promise<{ view: PlanItemView; stats: PickResult["stats"] }> {
  const row = await mustGet(input.id);
  const series = seriesOf(row);
  if (!series.generator) throw new PlanError("Bu rubrik için aday üretici henüz yok — içeriği elle hazırlayın.");
  if (!isEditable(row.status as PlanStatus)) throw new PlanError("Bu yuvada aday seçilemez (yayınlanmış ya da atlanmış).", 409);

  const [used, ctx] = await Promise.all([usedSourceIds(series, row.id), pickContext(series, row.id)]);
  const pool = await db.newsArticle.findMany({
    where: { source: "yargitay", category: "ictihat", ...(used.length ? { id: { notIn: used } } : {}) },
    select: { id: true, externalId: true, title: true, summary: true, publishedAt: true },
    orderBy: { publishedAt: "desc" },
    take: POOL_SIZE,
  });
  const picked = pickKararCandidates(pool, ctx, new Date(), 3);
  // adaylar durum/sürüm bozmadan saklanır; updatedAt yine de ilerler (iyimser belirteç taze döner)
  const updated = await db.contentPlanItem.update({ where: { id: row.id }, data: { candidates: JSON.stringify(picked.candidates) } });
  return { view: toView(updated), stats: picked.stats };
}

// ── Yazma işlemleri ──────────────────────────────────────────────────────────────────────────────────

type Actor = { actor: SessionUser; ip?: string | null; userAgent?: string | null };
/** Makine (otomasyon) çağrıları oturumsuzdur: `actor: null` → denetim kaydı + etiket "otomasyon". `Actor` buna atanabilir. */
type MachineActor = { actor: SessionUser | null; ip?: string | null; userAgent?: string | null };

/** Onay mührü alanlarını temizleme yaması (onay düştüğünde). */
const CLEAR_APPROVAL = { approvedAt: null, approvedById: null, approvedBy: null, approvedHash: null } as const;

type PlanAuditAction =
  | "CONTENT_PLAN_APPROVE"
  | "CONTENT_PLAN_UNAPPROVE"
  | "CONTENT_PLAN_SKIP"
  | "CONTENT_PLAN_CLAIM"
  | "CONTENT_PLAN_PUBLISH"
  | "CONTENT_PLAN_PUBLISH_FAIL"
  | "CONTENT_PLAN_RETRY";

async function auditPlan(a: MachineActor, action: PlanAuditAction, row: Row, detail: string): Promise<void> {
  await recordAccess({
    actor: a.actor,
    action,
    resourceType: "ContentPlanItem",
    resourceId: row.id,
    subjectUserId: null,
    detail: `${row.seriesKey}·${row.slotDay}·${detail}`,
    ip: a.ip,
    userAgent: a.userAgent,
  });
}

/** CAS yazımı: satır görülen sürümde VE izinli durumlardan birindeyse güncellenir; değilse PlanConflict. */
async function casUpdate(row: Row, version: Date, allowed: PlanStatus[], data: Record<string, unknown>): Promise<PlanItemView> {
  const r = await db.contentPlanItem.updateMany({ where: { id: row.id, updatedAt: version, status: { in: allowed } }, data });
  if (r.count === 0) throw new PlanConflict();
  return toView(await mustGet(row.id));
}

const EDITABLE: PlanStatus[] = ["PLANNED", "DRAFT", "APPROVED"];

/** Aday seç → kararın taslağını üret. Önceki içerik DEĞİŞİR (onaylıysa onay düşer); farklı kaynakta editör notu da sıfırlanır. */
export async function pickSource(input: { id: string; articleId: string; expectedVersion: string } & Actor): Promise<PlanItemView> {
  const row = await mustGet(input.id);
  const series = seriesOf(row);
  if (!series.generator) throw new PlanError("Bu rubrik için kaynak seçimi henüz yok — içeriği elle hazırlayın.");
  if (!isEditable(row.status as PlanStatus)) throw new PlanError("Bu yuvada kaynak seçilemez (yayınlanmış ya da atlanmış).", 409);
  const version = parseVersion(input.expectedVersion);

  const article = await db.newsArticle.findFirst({
    where: { id: input.articleId, source: "yargitay", category: "ictihat" },
    select: { id: true, externalId: true, title: true, summary: true, publishedAt: true },
  });
  if (!article) throw new PlanError("Karar bulunamadı.", 404);
  if ((await usedSourceIds(series, row.id)).includes(article.id)) throw new PlanError("Bu karar başka bir yuvada kullanılıyor.", 409);
  const draft = buildKararDraft(article);
  if (!draft) throw new PlanError("Bu karar taslak için uygun değil (iskelet/sonuç/alıntı kontrolü geçmedi).");

  const sameSource = parseJsonArray<string>(row.sourceIds)[0] === article.id;
  const note = sameSource ? noteFromPayload(parsePayload(row.payload)) : "";
  const payload = note ? applyEditorNote(draft, note) : draft;
  const wasApproved = row.status === "APPROVED";
  const view = await casUpdate(row, version, EDITABLE, {
    status: nextStatus(row.status as PlanStatus, "pick") ?? "DRAFT",
    sourceKind: series.sourceKind,
    sourceIds: JSON.stringify([article.id]),
    payload: JSON.stringify(payload),
    attestIdentity: sameSource ? row.attestIdentity : false,
    gateReport: null,
    ...CLEAR_APPROVAL,
  });
  if (wasApproved) await auditPlan(input, "CONTENT_PLAN_UNAPPROVE", row, "kaynak değişti");
  return view;
}

export interface SaveInput {
  id: string;
  expectedVersion: string;
  /** Verilirse slaytlar/altyazı/etiket/kaynaklar bununla değişir (normalize edilir). */
  payload?: unknown;
  /** Verilirse "Doktor için çıkarım" bu metinden cikarim slaytının maddelerine yansır. */
  editorNote?: string;
  attestIdentity?: boolean;
}

/** Taslağı kaydet. İçerik/not/onay kutusu değiştiyse DRAFT'a iner (onaylıysa onay düşer); değişmediyse no-op. */
export async function saveDraft(input: SaveInput & Actor): Promise<PlanItemView> {
  const row = await mustGet(input.id);
  const series = seriesOf(row);
  if (!isEditable(row.status as PlanStatus)) throw new PlanError("Bu yuva düzenlenemez (yayınlanmış ya da atlanmış).", 409);
  const version = parseVersion(input.expectedVersion);

  const current = parsePayload(row.payload);
  let next: PlanPayload;
  if (input.payload !== undefined) {
    const n = normalizePayload(input.payload);
    if (!n.ok) throw new PlanError(n.error);
    next = n.payload;
  } else next = current ?? skeletonPayload(series);
  if (input.editorNote !== undefined) {
    if (input.editorNote.length > LIMITS.note) throw new PlanError(`Çıkarım metni en çok ${LIMITS.note} karakter.`);
    if (series.noteLabel) next = applyEditorNote(next, input.editorNote);
  }
  const attest = series.attestIdentity ? (input.attestIdentity ?? row.attestIdentity) : false;

  const unchanged = !!current && payloadHash(current) === payloadHash(next) && attest === row.attestIdentity;
  if (unchanged) {
    if (row.updatedAt.getTime() !== version.getTime()) throw new PlanConflict();
    return toView(row);
  }

  const sourceIds = parseJsonArray<string>(row.sourceIds).filter((x): x is string => typeof x === "string");
  const report = evaluateGates({ series, payload: next, attestIdentity: attest, sourceIds, sourceTexts: await loadSourceTexts(series, sourceIds) });
  const wasApproved = row.status === "APPROVED";
  const view = await casUpdate(row, version, EDITABLE, {
    status: nextStatus(row.status as PlanStatus, "save") ?? "DRAFT",
    payload: JSON.stringify(next),
    attestIdentity: attest,
    gateReport: JSON.stringify(report),
    ...CLEAR_APPROVAL,
  });
  if (wasApproved) await auditPlan(input, "CONTENT_PLAN_UNAPPROVE", row, "içerik değişti");
  return view;
}

/** Onay: kapılar TAZE kaynak metniyle koşar; engelleyen kapı varsa PlanGateError (rapor ekranda). Başarıda içerik mühürlenir. */
export async function approve(input: { id: string; expectedVersion: string } & Actor): Promise<PlanItemView> {
  const row = await mustGet(input.id);
  const series = seriesOf(row);
  if (nextStatus(row.status as PlanStatus, "approve") === null) throw new PlanError("Yalnız taslak durumundaki içerik onaylanabilir.", 409);
  const version = parseVersion(input.expectedVersion);

  const payload = parsePayload(row.payload);
  const sourceIds = parseJsonArray<string>(row.sourceIds).filter((x): x is string => typeof x === "string");
  const report = evaluateGates({ series, payload, attestIdentity: row.attestIdentity, sourceIds, sourceTexts: await loadSourceTexts(series, sourceIds) });
  if (!report.ok || !payload) throw new PlanGateError(report);

  const hash = payloadHash(payload);
  const actorName = input.actor.name?.trim() || input.actor.email;
  const view = await casUpdate(row, version, ["DRAFT"], {
    status: "APPROVED",
    approvedAt: new Date(),
    approvedById: input.actor.id,
    approvedBy: actorName,
    approvedHash: hash,
    gateReport: JSON.stringify(report),
  });
  await auditPlan(input, "CONTENT_PLAN_APPROVE", row, hash.slice(0, 12));
  return view;
}

export async function unapprove(input: { id: string; expectedVersion: string } & Actor): Promise<PlanItemView> {
  const row = await mustGet(input.id);
  if (nextStatus(row.status as PlanStatus, "unapprove") === null) throw new PlanError("Geri alınacak onay yok.", 409);
  const view = await casUpdate(row, parseVersion(input.expectedVersion), ["APPROVED"], { status: "DRAFT", ...CLEAR_APPROVAL });
  await auditPlan(input, "CONTENT_PLAN_UNAPPROVE", row, "elle geri alındı");
  return view;
}

export async function skip(input: { id: string; expectedVersion: string } & Actor): Promise<PlanItemView> {
  const row = await mustGet(input.id);
  if (nextStatus(row.status as PlanStatus, "skip") === null) throw new PlanError("Bu yuva atlanamaz.", 409);
  const wasApproved = row.status === "APPROVED";
  // hatalı yayından atlanırsa eski hata notu da gider (geri alınınca bayat `publishedRefs` taşınmasın)
  const clearFailure = row.status === "FAILED" ? { publishedRefs: null } : {};
  const view = await casUpdate(row, parseVersion(input.expectedVersion), ["PLANNED", "DRAFT", "APPROVED", "FAILED"], { status: "SKIPPED", ...CLEAR_APPROVAL, ...clearFailure });
  await auditPlan(input, "CONTENT_PLAN_SKIP", row, wasApproved ? "onay düştü" : "atlandı");
  return view;
}

export async function restore(input: { id: string; expectedVersion: string } & Actor): Promise<PlanItemView> {
  const row = await mustGet(input.id);
  const target = nextStatus(row.status as PlanStatus, "restore", { hasPayload: !!parsePayload(row.payload) });
  if (target === null) throw new PlanError("Yalnız atlanmış yuva geri alınabilir.", 409);
  return casUpdate(row, parseVersion(input.expectedVersion), ["SKIPPED"], { status: target });
}

// ── Yayın durumu (v6.332, 2026-10-06) ────────────────────────────────────────────────────────────────

const actorLabel = (a: MachineActor): string => (a.actor ? a.actor.name?.trim() || a.actor.email : "otomasyon");

/** Yayına hazır içerik (makine yüzeyi): yalnız APPROVED + onay mührü sağlam. `version` sonuç bildiriminin CAS belirtecidir. */
export interface DueItem {
  id: string;
  version: string;
  seriesKey: SeriesKey;
  slotDay: string;
  payload: PlanPayload;
  approvedHash: string;
}

export interface DueSnapshot {
  gun: string;
  items: DueItem[];
  /** APPROVED ama yayına VERİLMEYEN (onay mührü bozuk) — izleme/alarm için. */
  atlanan: { id: string; seriesKey: string; neden: "muhur-bozuk" }[];
  /** O günün tüm yuvaları (yalnız durum) — sabah kontrolü/izleme. */
  slotlar: { id: string; seriesKey: string; status: PlanStatus }[];
}

/**
 * O günün yayına hazır içeriği — YALNIZ OKUMA (durum DEĞİŞMEZ): KURU prova (çiz + arşivle, yayın yok) ve izleme için.
 * Yalnız APPROVED + onay mührü sağlam olan verilir; mühür bozuksa `atlanan`a düşer ("yayınlanan = onaylanan").
 */
export async function dueForDay(gun: string): Promise<DueSnapshot> {
  if (!isDayString(gun)) throw new PlanError("Geçersiz gün (YYYY-AA-GG bekleniyor).");
  const rows = (await db.contentPlanItem.findMany({ where: { slotDay: gun } })).sort((a, b) => a.seriesKey.localeCompare(b.seriesKey));
  const items: DueItem[] = [];
  const atlanan: DueSnapshot["atlanan"] = [];
  for (const r of rows) {
    if (r.status !== "APPROVED") continue;
    const payload = parsePayload(r.payload);
    if (!payload || !r.approvedHash || !sealMatches(r)) {
      atlanan.push({ id: r.id, seriesKey: r.seriesKey, neden: "muhur-bozuk" });
      continue;
    }
    items.push({ id: r.id, version: r.updatedAt.toISOString(), seriesKey: r.seriesKey as SeriesKey, slotDay: r.slotDay, payload, approvedHash: r.approvedHash });
  }
  return { gun, items, atlanan, slotlar: rows.map((r) => ({ id: r.id, seriesKey: r.seriesKey, status: isPlanStatus(r.status) ? r.status : "PLANNED" })) };
}

/**
 * Yayın için AL (kilitle): o günün hazır içeriklerinin HER BİRİ APPROVED → YAYINLANIYOR (tek atomik CAS). Başka koşu önce aldıysa ya da içerik
 * değiştiyse o öğe SESSİZCE atlanır (hata DEĞİL) → en fazla BİR KEZ yayın. Dönen `version` YENİDİR (sonuç bildirimi bunu ister).
 * Yalnız BUGÜN (TR) alınır: yanlış hesaplanmış bir gün parametresi geleceğin içeriğini erken yayına sokmasın (`dueForDay` her gün için serbest).
 */
export async function claimForPublish(input: { gun: string; bugun: string } & MachineActor): Promise<DueSnapshot> {
  if (!isDayString(input.gun)) throw new PlanError("Geçersiz gün (YYYY-AA-GG bekleniyor).");
  if (input.gun !== input.bugun) throw new PlanError(`Yalnız bugünün (${input.bugun}) içeriği alınabilir; istenen: ${input.gun}.`);
  const snap = await dueForDay(input.gun);
  const claimed: DueItem[] = [];
  for (const it of snap.items) {
    const pub: Publication = { v: 1, manual: false, channels: [], at: new Date().toISOString() };
    const r = await db.contentPlanItem.updateMany({
      where: { id: it.id, updatedAt: new Date(it.version), status: "APPROVED" },
      data: { status: nextStatus("APPROVED", "claim") ?? "PUBLISHING", publishedRefs: JSON.stringify(pub) },
    });
    if (r.count === 0) continue; // başka koşu önce aldı / içerik değişti → bu öğe bizim DEĞİL
    const row = await mustGet(it.id);
    await auditPlan(input, "CONTENT_PLAN_CLAIM", row, "yayın için alındı");
    claimed.push({ ...it, version: row.updatedAt.toISOString() });
  }
  return { ...snap, items: claimed };
}

/**
 * Yayınlandı olarak işaretle: APPROVED | PUBLISHING → PUBLISHED (TERMİNAL — yayınlanmış içerik değiştirilemez, geri alınamaz).
 * `manual` (varsayılan true): editör içeriği elle paylaşıp kanal/bağlantıyı bildirdi (APPROVED'dan, ya da takılı YAYINLANIYOR'dan); `manual:false`: otomasyon —
 * YALNIZ ALDIĞI (YAYINLANIYOR) içerik için; kısmi başarıda `failures` (başarısız kanallar) kaydedilir.
 * Onay mührü sağlam değilse REDDEDİLİR: "yayınlanan = onaylanan" garantisi bu işaretin anlamıdır.
 */
export async function markPublished(
  input: { id: string; expectedVersion: string; channels: unknown; failures?: unknown; manual?: boolean } & MachineActor,
): Promise<PlanItemView> {
  const row = await mustGet(input.id);
  if (nextStatus(row.status as PlanStatus, "publish-ok") === null) throw new PlanError("Yalnız onaylı ya da yayınlanmakta olan içerik yayınlandı olarak işaretlenebilir.", 409);
  const manual = input.manual !== false;
  if (!manual && row.status !== "PUBLISHING") throw new PlanError("Otomasyon yalnız ALDIĞI (YAYINLANIYOR) içerik için sonuç bildirebilir.", 409);
  const version = parseVersion(input.expectedVersion);
  const ch = normalizeChannels(input.channels);
  if (!ch.ok) throw new PlanError(ch.error);
  const fl = normalizeFailures(input.failures);
  if (!fl.ok) throw new PlanError(fl.error);
  if (fl.failures.some((f) => ch.channels.some((c) => c.channel === f.channel))) throw new PlanError("Aynı kanal hem başarılı hem başarısız bildirilemez.");
  if (!sealMatches(row)) throw new PlanError("İçerik onay mührüyle eşleşmiyor — yayınlandı olarak işaretlenemez; yeniden hazırlanıp onaylanmalı.", 409);

  const now = new Date();
  const pub: Publication = { v: 1, manual, channels: ch.channels, by: actorLabel(input), at: now.toISOString() };
  if (fl.failures.length) pub.failures = fl.failures;
  const view = await casUpdate(row, version, ["APPROVED", "PUBLISHING"], { status: "PUBLISHED", publishedAt: now, publishedRefs: JSON.stringify(pub) });
  const detay = `${manual ? "elle" : "otomatik"}·${ch.channels.map((c) => c.channel).join(",")}${fl.failures.length ? `·başarısız:${fl.failures.map((f) => f.channel).join(",")}` : ""}`;
  await auditPlan(input, "CONTENT_PLAN_PUBLISH", row, detay);
  return view;
}

/** Yayın denemesi başarısız (otomasyon): YAYINLANIYOR → FAILED; onay mührü KORUNUR (yeniden denenebilir), hata notu `publishedRefs`'e yazılır. */
export async function markPublishFailed(input: { id: string; expectedVersion: string; error: string } & MachineActor): Promise<PlanItemView> {
  const row = await mustGet(input.id);
  if (nextStatus(row.status as PlanStatus, "publish-fail") === null) throw new PlanError("Yalnız ALINMIŞ (YAYINLANIYOR) içerik için yayın hatası bildirilebilir.", 409);
  const version = parseVersion(input.expectedVersion);
  const pub: Publication = { v: 1, manual: false, channels: [], at: new Date().toISOString(), error: cleanErrorText(input.error) };
  const view = await casUpdate(row, version, ["PUBLISHING"], { status: "FAILED", publishedRefs: JSON.stringify(pub) });
  await auditPlan(input, "CONTENT_PLAN_PUBLISH_FAIL", row, "yayın hatası");
  return view;
}

/**
 * Yeniden dene (İNSAN): FAILED → APPROVED (hata notu temizlenir) ya da takılı YAYINLANIYOR → APPROVED ("yayınlanmadığını kanalda doğruladım").
 * Mühür içerikle eşleşmiyorsa reddedilir.
 */
export async function retryPublish(input: { id: string; expectedVersion: string } & Actor): Promise<PlanItemView> {
  const row = await mustGet(input.id);
  if (nextStatus(row.status as PlanStatus, "retry") === null) throw new PlanError("Yeniden denenecek yayın hatası ya da takılı yayın yok.", 409);
  const version = parseVersion(input.expectedVersion);
  if (!sealMatches(row)) throw new PlanError("İçerik onay mührüyle eşleşmiyor — yeniden denenemez; yuvayı atlayıp yeniden hazırlayın.", 409);
  const takili = row.status === "PUBLISHING";
  const view = await casUpdate(row, version, ["FAILED", "PUBLISHING"], { status: "APPROVED", publishedRefs: null });
  await auditPlan(input, "CONTENT_PLAN_RETRY", row, takili ? "takılı yayın: yayınlanmadı" : "yeniden denenecek");
  return view;
}

// ── Önizleme (yazma YOK) ─────────────────────────────────────────────────────────────────────────────

/** Ekrandaki (kaydedilmemiş olabilir) içeriği PNG'ye çizdirir. `payload`/`editorNote` verilmezse kayıtlı taslak çizilir. */
export async function previewPlan(input: { id: string; payload?: unknown; editorNote?: string }) {
  const row = await mustGet(input.id);
  const series = seriesOf(row);
  let payload: PlanPayload | null;
  if (input.payload !== undefined) {
    const n = normalizePayload(input.payload);
    if (!n.ok) throw new PlanError(n.error);
    payload = n.payload;
  } else payload = parsePayload(row.payload);
  if (!payload) throw new PlanError("Önizlenecek taslak yok.");
  if (input.editorNote !== undefined && series.noteLabel) payload = applyEditorNote(payload, input.editorNote);
  return renderRubrik({ series, payload, slotDay: row.slotDay });
}
