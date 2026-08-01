// Doctorium — hekim bilgi portalı, OKUMA katmanı (v6.48).
// Yazma/toplama tarafı: lib/doctorium-ingest.ts (günlük bakım cron'u çağırır).
//
// Modüller (kullanıcı kararı 2026-08-01): A akış+tercih · B sektörel/mevzuat · C akademik+AI özet ·
// E kongre takvimi. Modül D (ilaç tanıtımı / e-mümessil) PARK — TİTCK tanıtım yönetmeliği + ruhsat
// sahibi sıfatı hukuki görüş ister (wiki/todo.md Doctorium bloğu).
import { createHash } from "crypto";
import { db } from "./db";
import { translateText, summarizeArticleForClinician } from "./ai-clinical";
import { BRANCHES } from "./triage";

export const DOCTORIUM_NAME = "Doctorium";

export type ModuleKey = "akis" | "akademik" | "sektorel" | "kongre";

export interface ModuleDef {
  key: ModuleKey;
  label: string;
  desc: string;
}

// Sekme sırası = hekimin günlük kullanım sıklığı varsayımı (kişisel akış önce).
export const DOCTORIUM_MODULES: ModuleDef[] = [
  { key: "akis", label: "Akışım", desc: "Seçtiğiniz branşlara göre kişiselleştirilmiş" },
  { key: "akademik", label: "Akademik", desc: "Hakemli yayınlar — PubMed" },
  { key: "sektorel", label: "Sektörel & Mevzuat", desc: "Resmî Gazete sağlık düzenlemeleri" },
  { key: "kongre", label: "Kongre Takvimi", desc: "Ulusal ve uluslararası kongreler" },
];

export const KIND_LABEL: Record<string, string> = {
  makale: "Makale",
  ilac: "Klinik Çalışma",
  mevzuat: "Mevzuat",
  haber: "Haber",
};

// ── Branş tercihleri (Modül A) ──────────────────────────────────────────────

export const BRANCH_OPTIONS = BRANCHES.map((b) => ({ slug: b.key, label: b.label }));
const SLUG_SET = new Set(BRANCH_OPTIONS.map((b) => b.slug));
const LABEL_BY_SLUG: Record<string, string> = Object.fromEntries(BRANCH_OPTIONS.map((b) => [b.slug, b.label]));
const SLUG_BY_LABEL: Record<string, string> = Object.fromEntries(BRANCH_OPTIONS.map((b) => [b.label, b.slug]));

export function branchLabel(slug: string): string {
  return LABEL_BY_SLUG[slug] ?? slug;
}
export function slugForLabel(label: string | null | undefined): string | null {
  return label ? SLUG_BY_LABEL[label] ?? null : null;
}

/** Saklanan JSON'u güvenle çöz — bozuk/eski veri akışı düşürmesin. */
export function parseBranchPrefs(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && SLUG_SET.has(s)) : [];
  } catch {
    return [];
  }
}

/** Yazmadan önce doğrula: bilinmeyen slug'ları at, tekrarı temizle, tavan uygula. */
export function normalizeBranchPrefs(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return [...new Set(input.filter((s): s is string => typeof s === "string" && SLUG_SET.has(s)))].slice(0, 30);
}

/**
 * Hekimin akışında kullanılacak branşlar: tercih ettikleri; hiç tercih girmemişse KENDİ branşı
 * (tercih ekranına girmemiş hekim boş akış görmesin). Personelde (doktor profili yok) boş = genel.
 */
export function effectiveBranches(newsBranches: string | null | undefined, ownBranchLabel: string | null | undefined): string[] {
  const prefs = parseBranchPrefs(newsBranches);
  if (prefs.length) return prefs;
  const own = slugForLabel(ownBranchLabel);
  return own ? [own] : [];
}

// ── Akış sorguları ──────────────────────────────────────────────────────────

export interface FeedItem {
  id: string;
  module: string;
  kind: string;
  title: string;
  titleOriginal: string | null;
  summary: string;
  sourceName: string;
  authors: string | null;
  url: string | null;
  doi: string | null;
  publishedAt: Date;
  branchSlugs: string[];
  hasAiSummary: boolean;
}

type Row = {
  id: string; module: string; kind: string; title: string; titleOriginal: string | null;
  summary: string; sourceName: string; authors: string | null; url: string | null;
  doi: string | null; publishedAt: Date; branchSlugs: string; aiSummary: string | null;
};

function toFeedItem(r: Row): FeedItem {
  let slugs: string[] = [];
  try {
    const v = JSON.parse(r.branchSlugs);
    if (Array.isArray(v)) slugs = v.filter((s): s is string => typeof s === "string");
  } catch { /* bozuk JSON = branşsız göster */ }
  return { ...r, branchSlugs: slugs, hasAiSummary: !!r.aiSummary };
}

const ROW_SELECT = {
  id: true, module: true, kind: true, title: true, titleOriginal: true, summary: true,
  sourceName: true, authors: true, url: true, doi: true, publishedAt: true,
  branchSlugs: true, aiSummary: true,
} as const;

/**
 * Kişisel akış (Modül A): seçili branşların yayınları + mevzuat (mevzuat herkesi ilgilendirir).
 * Branş eşleşmesi JSON string içinde arama ile yapılır — slug'lar benzersiz ve tırnak içinde
 * arandığı için ("onkoloji" ⊄ "radyasyon-onkolojisi") yanlış eşleşme olmaz.
 */
export async function personalFeed(branchSlugs: string[], limit = 30): Promise<FeedItem[]> {
  if (!branchSlugs.length) {
    const rows = await db.newsArticle.findMany({ orderBy: { publishedAt: "desc" }, take: limit, select: ROW_SELECT });
    return rows.map(toFeedItem);
  }
  const rows = await db.newsArticle.findMany({
    where: {
      OR: [
        ...branchSlugs.map((s) => ({ branchSlugs: { contains: `"${s}"` } })),
        { module: "sektorel" },
      ],
    },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: ROW_SELECT,
  });
  return rows.map(toFeedItem);
}

/**
 * TEK branşa daraltılmış akış (v6.49): hekim akışındaki branş çipine tıklayınca. Yalnız o branşın
 * yayınları — mevzuat DAHİL EDİLMEZ (kullanıcı bir branşa odaklanmak istiyor; mevzuat gürültü olur).
 */
export async function singleBranchFeed(slug: string, limit = 30): Promise<FeedItem[]> {
  const rows = await db.newsArticle.findMany({
    where: { branchSlugs: { contains: `"${slug}"` } },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: ROW_SELECT,
  });
  return rows.map(toFeedItem);
}

// Sektörel/mevzuat zaman aralığı (v6.49, kullanıcı isteği): hekim "kaç gün geriye" görmek
// istediğini seçer. Değer URL'de taşınır (?d=) — paylaşılabilir, şema gerektirmez.
export const RANGE_OPTIONS = [
  { key: "1", label: "Günlük", days: 1 },
  { key: "7", label: "Haftalık", days: 7 },
  { key: "30", label: "Aylık", days: 30 },
  { key: "180", label: "6 aylık", days: 180 },
  { key: "365", label: "1 yıllık", days: 365 },
] as const;
export const DEFAULT_RANGE = "30";

export function rangeDays(key: string | undefined): number {
  return RANGE_OPTIONS.find((r) => r.key === key)?.days ?? 30;
}

/** Modül akışı (akademik/sektörel). Branş verilirse akademikte süzülür; days verilirse tarih penceresi. */
export async function moduleFeed(
  module: "akademik" | "sektorel",
  branchSlugs: string[],
  opts: { limit?: number; days?: number } = {},
): Promise<FeedItem[]> {
  const { limit = 30, days } = opts;
  const rows = await db.newsArticle.findMany({
    where: {
      module,
      ...(days ? { publishedAt: { gte: new Date(Date.now() - days * 86400000) } } : {}),
      ...(module === "akademik" && branchSlugs.length
        ? { OR: branchSlugs.map((s) => ({ branchSlugs: { contains: `"${s}"` } })) }
        : {}),
    },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: ROW_SELECT,
  });
  return rows.map(toFeedItem);
}

export async function articleById(id: string): Promise<(FeedItem & { aiSummary: string | null }) | null> {
  const r = await db.newsArticle.findUnique({ where: { id }, select: ROW_SELECT });
  return r ? { ...toFeedItem(r), aiSummary: r.aiSummary } : null;
}

// ── Kongre takvimi (Modül E) ────────────────────────────────────────────────

// Alarm tercihleri (v6.49). Seçenekler gün cinsinden; UI hafta olarak da sunar (7/14/28).
export const ALERT_DAY_OPTIONS = [
  { days: 1, label: "1 gün önce" },
  { days: 3, label: "3 gün önce" },
  { days: 7, label: "1 hafta önce" },
  { days: 14, label: "2 hafta önce" },
  { days: 30, label: "1 ay önce" },
] as const;
const ALERT_DAY_SET = new Set<number>(ALERT_DAY_OPTIONS.map((o) => o.days));

/** null = alarm kapalı. Listede olmayan değer de kapalı sayılır (bozuk/eski veri). */
export function normalizeAlertDays(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && ALERT_DAY_SET.has(n) ? n : null;
}

export async function followedCongressIds(doctorId: string): Promise<Set<string>> {
  const rows = await db.congressFollow.findMany({ where: { doctorId }, select: { congressId: true } });
  return new Set(rows.map((r) => r.congressId));
}

export async function upcomingCongresses(branchSlugs: string[], limit = 40) {
  const rows = await db.medicalCongress.findMany({
    where: { startDate: { gte: new Date(Date.now() - 86400000) } }, // bugün başlayan dahil
    orderBy: { startDate: "asc" },
    take: limit,
  });
  if (!branchSlugs.length) return rows;
  // Branşsız (tüm branşlara açık) kongreler herkeste görünür.
  return rows.filter((c) => {
    const s = c.branchSlugs || "[]";
    return s === "[]" || branchSlugs.some((b) => s.includes(`"${b}"`));
  });
}

// ── Çeviri (okuma anında, önbellekli) ───────────────────────────────────────
// PubMed başlık/özeti İngilizce gelir. Translation tablosunda (lang, sourceHash) ile önbelleklenir.
// ⚠️ Buraya YALNIZ herkese açık literatür girer — klinik/PHI metin ASLA (bkz. translateClinical).

const TR = "Türkçe";
const TRANSLATE_BUDGET_MS = 6000; // aşılırsa özgün dil gösterilir; çeviri arkada önbelleğe yazılır

function tHash(s: string): string {
  return createHash("sha1").update(s).digest("hex");
}

async function translateMissing(missing: string[]): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  try {
    const numbered = missing.map((s, i) => `${i + 1}. ${s}`).join("\n");
    const out = await translateText(numbered, TR);
    const lines = out.split("\n").map((l) => l.replace(/^\s*\d+\.\s*/, "").trim()).filter(Boolean);
    // Satır sayısı tutmuyorsa TAMAMEN yok say: yanlış eşleşme başlıkları birbirine karıştırır.
    if (lines.length !== missing.length) throw new Error(`satır uyuşmazlığı ${lines.length}≠${missing.length}`);
    const data = missing.map((s, i) => ({ lang: TR, sourceHash: tHash(s), source: s, translated: lines[i] }));
    await db.translation.createMany({ data, skipDuplicates: true });
    for (const d of data) map[d.source] = d.translated;
  } catch (e) {
    console.warn("[doctorium] çeviri atlandı:", e instanceof Error ? e.message : e);
  }
  return map;
}

async function translateToTurkish(texts: string[]): Promise<Record<string, string>> {
  const uniq = [...new Set(texts.map((t) => t.trim()).filter(Boolean))];
  const map: Record<string, string> = {};
  if (!uniq.length) return map;

  const rows = await db.translation.findMany({ where: { lang: TR, sourceHash: { in: uniq.map(tHash) } } });
  for (const r of rows) map[r.source] = r.translated;

  const missing = uniq.filter((s) => map[s] === undefined);
  if (!missing.length || !process.env.ANTHROPIC_API_KEY) return map;

  const work = translateMissing(missing);
  const timed = await Promise.race([work, new Promise<null>((r) => setTimeout(() => r(null), TRANSLATE_BUDGET_MS))]);
  if (timed) Object.assign(map, timed);
  else void work.catch(() => {}); // bilinçli floating promise: önbellek arkada dolsun
  return map;
}

/** Liste görünümü için başlıkları TR'ye çevir (özet listede kısaltıldığı için yalnız başlık çevrilir). */
export async function localizeTitles(items: FeedItem[]): Promise<FeedItem[]> {
  const needs = items.filter((i) => i.module === "akademik").map((i) => i.title);
  if (!needs.length) return items;
  const tx = await translateToTurkish(needs);
  return items.map((i) => {
    const t = tx[i.title];
    return t && t !== i.title ? { ...i, title: t, titleOriginal: i.title } : i;
  });
}

// ── AI klinik özet (Modül C) ────────────────────────────────────────────────

export interface ClinicalSummary {
  takeaways: string[];
  design: string;
  limits: string;
}

export function parseClinicalSummary(raw: string | null): ClinicalSummary | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (!v || !Array.isArray(v.takeaways)) return null;
    return {
      // 4 = üreticinin (summarizeArticleForClinician) tavanı; ikisi ayrışırsa DB'deki eski kayıt
      // ekranda farklı uzunlukta görünürdü.
      takeaways: v.takeaways.filter((s: unknown): s is string => typeof s === "string").slice(0, 4),
      design: typeof v.design === "string" ? v.design : "",
      limits: typeof v.limits === "string" ? v.limits : "",
    };
  } catch {
    return null;
  }
}

/**
 * Yayının 2 dakikalık Türkçe klinik özetini üretir ve kaydeder (bir kez; sonraki okumalar DB'den).
 * TEMBEL üretim: yalnız hekim yayını AÇTIĞINDA çalışır → okunmayan ~90 yayın için AI parası ödenmez.
 * ⚠️ Bu bir KLİNİK KARAR ARACI DEĞİLDİR; arayüz bu uyarıyı göstermek zorundadır.
 */
export async function ensureClinicalSummary(id: string): Promise<ClinicalSummary | null> {
  const row = await db.newsArticle.findUnique({
    where: { id },
    select: { aiSummary: true, title: true, summary: true, module: true },
  });
  if (!row) return null;
  const existing = parseClinicalSummary(row.aiSummary);
  if (existing) return existing;
  // Abstract'ı olmayan kalemde (ör. mevzuat başlığı) üretilecek bir şey yok — uydurma YAPILMAZ.
  if (row.module !== "akademik" || !row.summary || !process.env.ANTHROPIC_API_KEY) return null;

  try {
    const s = await summarizeArticleForClinician(row.title, row.summary);
    await db.newsArticle.update({ where: { id }, data: { aiSummary: JSON.stringify(s) } });
    return s;
  } catch (e) {
    console.warn("[doctorium] klinik özet üretilemedi:", e instanceof Error ? e.message : e);
    return null;
  }
}
