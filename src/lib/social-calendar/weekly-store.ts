import { randomUUID } from "node:crypto";
import type { Prisma, ContentPlanItem } from "@prisma/client";
import { db } from "../db";
import { recordAccess } from "../audit";
import type { SessionUser } from "../session";
import { evaluateGates, type GateReport } from "./gates";
import { parsePayload, payloadHash } from "./payload";
import { loadSourceTexts, PlanError } from "./plan";
import { seriesByKey, isDayString, slotsOfWeek } from "./series";
import { renderRequestBody } from "./render-client";
import { WEEKLY_CHANNELS, reviewWeeklyPackage, weeklyDeliveryKey, weeklyManifestHash, type WeeklyManifest, type WeeklySnapshot, type WeeklyChannel } from "./weekly-package";

type Tx = Prisma.TransactionClient;
type Actor = { actor: SessionUser; ip?: string | null; userAgent?: string | null };
type PreparationActor = Omit<Actor, "actor"> & { actor: SessionUser | null };
function conflict(message: string): never { throw new PlanError(message, 409); }
const requireAdmin = (actor: SessionUser) => { if (actor.role !== "ADMIN") throw new PlanError("Yetkisiz.", 401); };
const asString = (s: unknown) => typeof s === "string" ? s : "";
const HASH = /^[a-f0-9]{64}$/;
const channel = (s: string): s is WeeklyChannel => WEEKLY_CHANNELS.includes(s as WeeklyChannel);
const cleanNote = (s: string) => s.trim().slice(0, 500).replace(/[\u0000-\u001f]/g, " ");

/** Input is a prepared review bundle, not an approval. No fetches or URL-based authorization. */
export function normalizeWeeklyManifest(raw: unknown): WeeklyManifest {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new PlanError("Paket biçimi geçersiz.");
  const m = raw as Record<string, unknown>;
  if (m.v !== 1 || !isDayString(m.week) || !Array.isArray(m.entries) || m.entries.length !== 3) throw new PlanError("Üç rubrik içeren haftalık paket gerekli.");
  const entries = m.entries.map(rawEntry => {
    if (!rawEntry || typeof rawEntry !== "object") throw new PlanError("Paket öğesi geçersiz.");
    const e = rawEntry as Record<string, unknown>;
    if (!Array.isArray(e.channels) || e.channels.some(c => typeof c !== "string" || !channel(c)) || !Array.isArray(e.assets) || e.assets.length > 60 || !e.accounts || typeof e.accounts !== "object") throw new PlanError("Kanal, hesap ve son medya bilgileri gerekli.");
    const accounts: Partial<Record<WeeklyChannel, string>> = {};
    for (const c of WEEKLY_CHANNELS) {
      const account = asString((e.accounts as Record<string, unknown>)[c]);
      if (!/^[a-zA-Z0-9@:_./-]{1,160}$/.test(account)) throw new PlanError("Her kanal için açık hesap kimliği gerekli.");
      accounts[c] = account;
    }
    const assets = e.assets.map(rawAsset => {
      if (!rawAsset || typeof rawAsset !== "object") throw new PlanError("Medya bilgisi geçersiz.");
      const a = rawAsset as Record<string, unknown>;
      const c = asString(a.channel), name = asString(a.name), sha256 = asString(a.sha256), url = asString(a.url);
      let parsed: URL;
      try { parsed = new URL(url); } catch { throw new PlanError("Medya bağlantısı geçersiz."); }
      if (!channel(c) || !HASH.test(sha256) || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/.test(name) || parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.hostname === "localhost" || !parsed.hostname.includes(".")) throw new PlanError("Herkese açık HTTPS medya bağlantısı ve SHA256 gerekli; erişim jetonu içermemeli.");
      return { channel: c, name, sha256, url: parsed.href };
    });
    for (const c of WEEKLY_CHANNELS) if (!assets.some(a => a.channel === c && a.name === "post.json")) throw new PlanError("Her kanalın son açıklama/başlık/gönderi verisini içeren post.json dosyası gerekli.");
    const id = asString(e.id), version = asString(e.version), seriesKey = asString(e.seriesKey), slotDay = asString(e.slotDay), contentHash = asString(e.contentHash), scheduledAt = asString(e.scheduledAt);
    if (!id || id.length > 100 || !HASH.test(contentHash)) throw new PlanError("Öğe kimliği ve içerik hash'i gerekli.");
    return { id, version, seriesKey, slotDay, contentHash, scheduledAt, channels: e.channels as WeeklyChannel[], accounts, assets };
  });
  return { v: 1, week: m.week, entries };
}

async function transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  // These callbacks contain DB work only. Retry ONLY PostgreSQL's definite
  // transaction rollback, never network/unknown outcomes or platform requests.
  for (let attempt = 0; ; attempt++) {
    try { return await db.$transaction(fn, { isolationLevel: "Serializable", timeout: 30000 }); }
    catch (e) {
      const error = e as { code?: string; meta?: { code?: string } };
      const rolledBack = error.code === "P2034" || (error.code === "P2010" && ["40001", "40P01"].includes(error.meta?.code ?? ""));
      if (rolledBack && attempt < 2) continue;
      if (rolledBack || error.code === "P2002") conflict("Paket başka bir işlemde değişti; yenileyin.");
      throw e;
    }
  }
}
async function lockedPackage(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT "id" FROM "WeeklyContentPackage" WHERE "id"=${id} FOR UPDATE`;
  const p = await tx.weeklyContentPackage.findUnique({ where: { id } });
  if (!p) throw new PlanError("Paket bulunamadı.", 404);
  return p;
}
async function snapshots(tx: Tx, manifest: WeeklyManifest, lock: boolean, reviewAttestation = false) {
  const rows: ContentPlanItem[] = [], views: WeeklySnapshot[] = [];
  const reports = new Map<string, GateReport>();
  for (const e of [...manifest.entries].sort((a, b) => a.id.localeCompare(b.id))) {
    if (lock) await tx.$queryRaw`SELECT "id" FROM "ContentPlanItem" WHERE "id"=${e.id} FOR UPDATE`;
    const row = await tx.contentPlanItem.findUnique({ where: { id: e.id } });
    if (!row) conflict("Paketin içerik kaydı bulunamadı.");
    const payload = parsePayload(row.payload), series = seriesByKey(row.seriesKey);
    if (!payload || !series) throw new PlanError("Kaynaklı rubrik taslağı eksik.", 422);
    let ids: unknown;
    try { ids = JSON.parse(row.sourceIds); } catch { throw new PlanError("Kaynak kayıtları geçersiz.", 422); }
    if (!Array.isArray(ids) || ids.some(id => typeof id !== "string")) throw new PlanError("Kaynak kayıtları geçersiz.", 422);
    // A preparation preview is not an attestation. The single explicit weekly
    // confirmation supplies the human attestation at approval; dispatch uses DB state.
    const report = evaluateGates({ series, payload, attestIdentity: reviewAttestation ? true : row.attestIdentity, sourceIds: ids, sourceTexts: await loadSourceTexts(series, ids, tx) });
    views.push({ id: row.id, version: row.updatedAt.toISOString(), seriesKey: row.seriesKey, slotDay: row.slotDay, payload, gatesPassed: report.ok });
    reports.set(row.id, report);
    rows.push(row);
  }
  return { rows, views, reports };
}
function reviewOrThrow(manifest: WeeklyManifest, views: WeeklySnapshot[], now: Date) {
  const errors = reviewWeeklyPackage(manifest, views, now);
  if (errors.length) throw new PlanError(errors.join("; "), 422);
}
async function audit(input: PreparationActor, action: string, id: string, hash: string) {
  await recordAccess({ ...input, action, resourceType: "weekly-content-package", resourceId: id, subjectUserId: null, detail: hash.slice(0, 16) });
}

/** Authenticated preparation saves a draft bundle. It cannot approve anything. */
export async function prepareWeeklyPackage(input: PreparationActor & { manifest: unknown }) {
  // actor:null is reserved for the token-authenticated preparation endpoint/internal worker.
  // This path cannot save attestation, approval, or a delivery claim.
  if (input.actor) requireAdmin(input.actor);
  const manifest = normalizeWeeklyManifest(input.manifest), hash = weeklyManifestHash(manifest);
  const p = await transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('doctorium-week'), hashtext(${manifest.week}))`;
    const existing = await tx.weeklyContentPackage.findFirst({ where: { week: manifest.week, status: { in: ["DRAFT", "APPROVED"] } } });
    if (existing?.status === "DRAFT" && existing.manifestHash === hash) return existing;
    if (existing) conflict("Bu hafta için açık paket var; değiştirmeden önce geri çekin.");
    const { rows, views } = await snapshots(tx, manifest, true, true);
    reviewOrThrow(manifest, views, new Date());
    if (rows.some(r => r.status !== "DRAFT" || r.weeklyPackageId)) conflict("Yalnız pakete alınmamış taslaklar hazırlanabilir.");
    return tx.weeklyContentPackage.create({ data: { week: manifest.week, manifest: JSON.stringify(manifest), manifestHash: hash } });
  });
  await audit(input, "CONTENT_WEEK_PREPARE", p.id, hash);
  return p;
}

/** All-or-nothing human approval. The browser must echo the exact reviewed hash and version. */
export async function approveWeeklyPackage(input: Actor & { id: string; version: string; hash: string; confirmed: boolean }) {
  requireAdmin(input.actor);
  if (input.confirmed !== true) throw new PlanError("Tüm içerik, medya, hesap ve saatler için açık onay gerekli.");
  const p = await transaction(async tx => {
    const p = await lockedPackage(tx, input.id);
    if (p.status !== "DRAFT" || p.updatedAt.toISOString() !== input.version || p.manifestHash !== input.hash) conflict("Görüntülenen paket değişti veya onaylanabilir durumda değil.");
    const manifest = normalizeWeeklyManifest(JSON.parse(p.manifest));
    if (weeklyManifestHash(manifest) !== input.hash) conflict("Paket mührü geçersiz.");
    const { rows, views, reports } = await snapshots(tx, manifest, true, input.confirmed);
    const now = new Date();
    reviewOrThrow(manifest, views, now);
    for (const row of rows) {
      if (row.status !== "DRAFT" || row.weeklyPackageId) conflict("Taslak başka bir onay veya yayına alınmış.");
      const e = manifest.entries.find(e => e.id === row.id)!;
      const updated = await tx.contentPlanItem.updateMany({ where: { id: row.id, status: "DRAFT", weeklyPackageId: null, updatedAt: new Date(e.version) }, data: {
        status: "APPROVED", weeklyPackageId: p.id, approvedAt: now, approvedById: input.actor.id,
        attestIdentity: seriesByKey(row.seriesKey)?.attestIdentity ? true : row.attestIdentity,
        gateReport: JSON.stringify(reports.get(row.id)),
        approvedBy: input.actor.name || input.actor.email, approvedHash: e.contentHash,
      } });
      if (updated.count !== 1) conflict("Taslak onay sırasında değişti.");
      for (const c of e.channels) {
        const previous = await tx.weeklyChannelDelivery.findUnique({ where: { itemId_channel: { itemId: row.id, channel: c } } });
        if (previous && (previous.attempt !== 0 || previous.state !== "CANCELLED")) conflict("Bu içerik/kanal için önceki yayın denemesi var; yeniden paketlenemez.");
        const data = {
        id: weeklyDeliveryKey(p.manifestHash, row.id, c), packageId: p.id, itemId: row.id, channel: c,
        accountId: e.accounts![c]!, scheduledAt: new Date(e.scheduledAt), state: "PENDING", resultNote: null,
        events: { create: { state: "PENDING", note: `HUMAN_WEEK_APPROVAL:${p.id}:${p.manifestHash}`, actorId: input.actor.id } },
        };
        if (previous) await tx.weeklyChannelDelivery.update({ where: { id: previous.id }, data });
        else await tx.weeklyChannelDelivery.create({ data });
      }
    }
    return tx.weeklyContentPackage.update({ where: { id: p.id }, data: { status: "APPROVED", approvedAt: now, approvedById: input.actor.id, approvedBy: input.actor.name || input.actor.email } });
  });
  await audit(input, "CONTENT_WEEK_APPROVE", p.id, p.manifestHash);
  return p;
}

export async function revokeWeeklyPackage(input: Actor & { id: string; version: string }) {
  requireAdmin(input.actor);
  const p = await transaction(async tx => {
    const p = await lockedPackage(tx, input.id);
    if (p.updatedAt.toISOString() !== input.version) conflict("Paket değişti; yenileyin.");
    await tx.weeklyChannelDelivery.updateMany({ where: { packageId: p.id, state: "PENDING" }, data: { state: "CANCELLED", resultNote: "HUMAN_REVOKE" } });
    const owned = await tx.contentPlanItem.findMany({ where: { weeklyPackageId: p.id } });
    for (const item of owned) {
      const attempted = await tx.weeklyChannelDelivery.count({ where: { itemId: item.id, attempt: { gt: 0 } } });
      // No request could have started. Restore only these items for a NEW human-reviewed revision.
      if (!attempted) await tx.contentPlanItem.update({ where: { id: item.id }, data: { weeklyPackageId: null, status: "DRAFT", approvedHash: null, approvedAt: null, approvedById: null, approvedBy: null } });
    }
    return tx.weeklyContentPackage.update({ where: { id: p.id }, data: { status: "REVOKED", revokedReason: "HUMAN_REVOKE" } });
  });
  await audit(input, "CONTENT_WEEK_REVOKE", p.id, p.manifestHash);
  return p;
}

/** Read-only. Never turns an expired CLAIMED lease back into PENDING. */
export async function getWeeklyPackage(week: string) {
  if (!isDayString(week)) throw new PlanError("Geçersiz hafta.");
  const p = await db.weeklyContentPackage.findFirst({ where: { week }, orderBy: { createdAt: "desc" }, include: { deliveries: { orderBy: [{ scheduledAt: "asc" }, { channel: "asc" }], include: { events: { orderBy: { createdAt: "asc" } } } }, items: { select: { id: true, payload: true, approvedHash: true, status: true } } } });
  if (!p) return null;
  const manifest = normalizeWeeklyManifest(JSON.parse(p.manifest));
  // Do not expose claim tokens in admin HTML or read-only worker inspection.
  return { ...p, manifest, deliveries: p.deliveries.map(d => {
    const { claimToken, ...view } = d;
    void claimToken;
    return { ...view, effectiveState: d.state === "CLAIMED" && d.claimedAt && Date.now() - d.claimedAt.getTime() > 20 * 60000 ? "UNKNOWN" : d.state };
  }) };
}

/** Authenticated preparation input: read existing drafts, never create slots,
 * mutate editor work or approve. The renderer receives the existing card model.
 */
export async function getWeeklyDrafts(week: string) {
  if (!isDayString(week) || new Date(`${week}T00:00:00Z`).getUTCDay() !== 1) throw new PlanError("Pazartesi tarihi gerekli.");
  const slots = slotsOfWeek(week);
  const rows = await db.contentPlanItem.findMany({ where: { slotDay: { in: slots.map(s => s.slotDay) }, status: "DRAFT", weeklyPackageId: null } });
  const items: Array<{
    id: string; version: string; seriesKey: string; slotDay: string; contentHash: string;
    payload: NonNullable<ReturnType<typeof parsePayload>>; render: ReturnType<typeof renderRequestBody>;
    gates: GateReport; state: "DRAFT_REVIEW_ONLY";
  }> = [];
  for (const { series, slotDay } of slots) {
    const row = rows.find(r => r.seriesKey === series.key && r.slotDay === slotDay), payload = parsePayload(row?.payload);
    if (!row || !payload) continue;
    let ids: unknown;
    try { ids = JSON.parse(row.sourceIds); } catch { continue; }
    if (!Array.isArray(ids) || ids.some(id => typeof id !== "string")) continue;
    const gates = evaluateGates({ series, payload, attestIdentity: row.attestIdentity, sourceIds: ids, sourceTexts: await loadSourceTexts(series, ids) });
    items.push({ id: row.id, version: row.updatedAt.toISOString(), seriesKey: row.seriesKey, slotDay, contentHash: payloadHash(payload), payload,
      render: renderRequestBody(series, payload, slotDay), gates, state: "DRAFT_REVIEW_ONLY" });
  }
  return { week, items, missing: slots.filter(s => !items.some(i => i.seriesKey === s.series.key && i.slotDay === s.slotDay)).map(s => ({ seriesKey: s.series.key, slotDay: s.slotDay })) };
}

async function intact(tx: Tx, p: Awaited<ReturnType<typeof lockedPackage>>, itemId: string) {
  if (p.status !== "APPROVED" || !p.approvedById || !p.approvedAt) conflict("Paketin geçerli insan onayı yok.");
  const m = normalizeWeeklyManifest(JSON.parse(p.manifest));
  if (weeklyManifestHash(m) !== p.manifestHash) conflict("Paket değişmiş.");
  const e = m.entries.find(e => e.id === itemId);
  if (!e) conflict("İçerik bu pakette değil.");
  await tx.$queryRaw`SELECT "id" FROM "ContentPlanItem" WHERE "id"=${itemId} FOR UPDATE`;
  const { rows, views } = await snapshots(tx, { ...m, entries: [e] }, false);
  const row = rows[0];
  if (row.weeklyPackageId !== p.id || !["APPROVED", "PUBLISHING"].includes(row.status) || row.approvedHash !== e.contentHash || payloadHash(views[0].payload) !== e.contentHash || !views[0].gatesPassed) conflict("İçerik veya hukuk kapıları onayla eşleşmiyor.");
  return e;
}

/** Only a connected worker may call this after hashing downloaded final assets and
 * resolving its actual platform account. No scheduler or platform upload lives here. */
export async function claimWeeklyDelivery(input: { id: string; hash: string; accountId: string; assetHashes: Record<string, string> }) {
  return transaction(async tx => {
    const initial = await tx.weeklyChannelDelivery.findUnique({ where: { id: input.id } });
    if (!initial) throw new PlanError("Kanal kaydı bulunamadı.", 404);
    const p = await lockedPackage(tx, initial.packageId);
    const e = await intact(tx, p, initial.itemId);
    if (p.manifestHash !== input.hash || initial.accountId !== input.accountId || e.accounts?.[initial.channel as WeeklyChannel] !== input.accountId) conflict("Paket veya kanal hesabı uyuşmuyor.");
    const now = new Date(), start = initial.scheduledAt.getTime();
    if (now.getTime() < start || now.getTime() >= start + 15 * 60000) conflict("Onaylanan yayın penceresi dışında; geriye tarihli yayın yok.");
    const assets = e.assets.filter(a => a.channel === initial.channel);
    if (Object.keys(input.assetHashes).length !== assets.length || assets.some(a => input.assetHashes[a.name] !== a.sha256)) conflict("İndirilen son dosyalar onaylanan hash'lerle eşleşmiyor.");
    const token = randomUUID();
    const changed = await tx.weeklyChannelDelivery.updateMany({ where: { id: input.id, state: "PENDING" }, data: { state: "CLAIMED", claimToken: token, claimedAt: now, attempt: { increment: 1 }, resultNote: null } });
    if (changed.count !== 1) conflict("Kanal daha önce alınmış; başarı veya belirsiz sonuç doğrulanmadan tekrar alınamaz.");
    await tx.contentPlanItem.updateMany({ where: { id: initial.itemId, status: "APPROVED", weeklyPackageId: p.id }, data: { status: "PUBLISHING", publishedRefs: JSON.stringify({ v: 1, manual: false, channels: [], at: now.toISOString() }) } });
    await tx.weeklyDeliveryEvent.create({ data: { deliveryId: input.id, state: "CLAIMED", note: "ASSETS_AND_ACCOUNT_MATCHED" } });
    return { id: input.id, claimToken: token, manifestHash: p.manifestHash, accountId: initial.accountId, channel: initial.channel, entry: e };
  });
}

async function finalizeItem(tx: Tx, itemId: string, packageId: string) {
  const deliveries = await tx.weeklyChannelDelivery.findMany({ where: { itemId }, select: { state: true, channel: true } });
  if (deliveries.length !== WEEKLY_CHANNELS.length || deliveries.some(d => d.state !== "SUCCEEDED")) return;
  const now = new Date();
  await tx.contentPlanItem.updateMany({ where: { id: itemId, status: "PUBLISHING", weeklyPackageId: packageId }, data: {
    status: "PUBLISHED", publishedAt: now,
    publishedRefs: JSON.stringify({ v: 1, manual: false, channels: deliveries.map(d => ({ channel: d.channel })), at: now.toISOString(), weeklyPackageId: packageId }),
  } });
}

export async function completeWeeklyDelivery(input: { id: string; claimToken: string; result: "SUCCEEDED" | "FAILED" | "UNKNOWN"; platformId?: string; noRequestSent?: boolean }) {
  return transaction(async tx => {
    const initial = await tx.weeklyChannelDelivery.findUnique({ where: { id: input.id } });
    if (!initial) throw new PlanError("Kanal kaydı bulunamadı.", 404);
    // Same lock order as claim/revoke. Revocation does not hide already in-flight results.
    await lockedPackage(tx, initial.packageId);
    const d = await tx.weeklyChannelDelivery.findUniqueOrThrow({ where: { id: input.id } });
    if (!input.claimToken || d.claimToken !== input.claimToken) conflict("Bu yayın denemesinin belirteci uyuşmuyor.");
    const state = input.result === "FAILED" && input.noRequestSent !== true ? "UNKNOWN" : input.result;
    const platformId = input.result === "SUCCEEDED" ? asString(input.platformId).trim() : null;
    if (state === "SUCCEEDED" && (!platformId || platformId.length > 300 || /[\u0000-\u001f]/.test(platformId))) throw new PlanError("Başarı için platformun yayın kimliği gerekli.");
    if (d.state !== "CLAIMED") {
      if (d.state === state && d.platformId === platformId) return { state: d.state, repeated: true };
      conflict("Kanal sonucu daha önce farklı kaydedilmiş; otomatik üzerine yazılamaz.");
    }
    await tx.weeklyChannelDelivery.update({ where: { id: d.id }, data: { state, platformId, resultNote: state === "UNKNOWN" ? "VERIFY_PLATFORM_BEFORE_RETRY" : state === "FAILED" ? "NO_REQUEST_SENT" : "PLATFORM_ID_RECORDED" } });
    await tx.weeklyDeliveryEvent.create({ data: { deliveryId: d.id, state, note: state === "SUCCEEDED" ? "PLATFORM_ID_RECORDED" : "VERIFY_PLATFORM_BEFORE_RETRY" } });
    await finalizeItem(tx, d.itemId, d.packageId);
    return { state, repeated: false };
  });
}

/** A human must inspect the platform, not just click retry. Never resets SUCCEEDED. */
export async function reconcileWeeklyDelivery(input: Actor & { id: string; version: string; outcome: "FOUND" | "NOT_FOUND"; evidence: string; platformId?: string }) {
  requireAdmin(input.actor);
  const evidence = cleanNote(input.evidence);
  if (evidence.length < 20) throw new PlanError("Platformda yaptığınız kontrolü en az 20 karakterle kaydedin.");
  return transaction(async tx => {
    const initial = await tx.weeklyChannelDelivery.findUnique({ where: { id: input.id } });
    if (!initial) throw new PlanError("Kanal kaydı bulunamadı.", 404);
    const p = await lockedPackage(tx, initial.packageId);
    const d = await tx.weeklyChannelDelivery.findUniqueOrThrow({ where: { id: input.id } });
    if (d.updatedAt.toISOString() !== input.version || !["UNKNOWN", "CLAIMED", "FAILED"].includes(d.state)) conflict("Kanal sonucu değişti veya uzlaştırılabilir durumda değil.");
    // A recent in-flight request may still succeed; it must not be recycled.
    if (input.outcome === "NOT_FOUND" && ["CLAIMED", "UNKNOWN"].includes(d.state) && d.claimedAt && Date.now() - d.claimedAt.getTime() < 20 * 60000) conflict("Yayın denemesi hâlâ sürüyor olabilir; en az 20 dakika bekleyin.");
    const platformId = input.outcome === "FOUND" ? asString(input.platformId).trim() : null;
    if (input.outcome === "FOUND" && (!platformId || platformId.length > 300)) throw new PlanError("Bulunan yayının platform kimliği gerekli.");
    if (input.outcome === "NOT_FOUND") await intact(tx, p, d.itemId);
    const state = input.outcome === "FOUND" ? "SUCCEEDED" : "PENDING";
    await tx.weeklyChannelDelivery.update({ where: { id: d.id }, data: { state, platformId, claimToken: null, resultNote: evidence, reconciledAt: new Date(), reconciledById: input.actor.id } });
    await tx.weeklyDeliveryEvent.create({ data: { deliveryId: d.id, state, note: evidence, actorId: input.actor.id } });
    if (state === "SUCCEEDED") await finalizeItem(tx, d.itemId, d.packageId);
    return { state };
  });
}
