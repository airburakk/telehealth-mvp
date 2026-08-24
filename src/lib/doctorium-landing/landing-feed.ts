// Landing demo veri katmanı — SUNUCU (db import eder; istemciye ALINAMAZ). 2026-08-23.
//
// Kullanıcı kararı: "Canlı DB + fixture yedeği". Hero/Bugün/Kişiselleştirme demosu gerçek
// `personalFeedPage`'i (portalın Akışım mantığı — bölüm kotalı karışım + interleave) anonim
// ziyaretçi için çalıştırır. NewsArticle/MedicalCongress halka açık yayın/haber verisidir (PHI değil).
//
// Korumalar:
//   · Girdi allowlist: branş LANDING_BRANCHES, bölümler LANDING_MODULES (dışı → null, çağıran 400).
//   · YAZMA YOK: tercih/kayıt/takip dokunulmaz; `saved=null` ile Kaydet düğmesi çizilmez.
//   · Maliyet freni: 10 dk bellek-içi memo (branş|bölümler anahtarı, en fazla 64 giriş) — başlık
//     çevirisi (localizeTitles) DB önbelleği tutmazsa AI'ya gider; memo anonim trafiğin AI çağrısını
//     kombinasyon başına 6/saat ile sınırlar. API katmanında ayrıca IP rate-limit var.
//   · Hata/boş → FIXTURE (sourceName "Örnek içerik"); çağıran `source:"fixture"` ile işaretler.
import {
  personalFeedPage, localizeTitles, trDayStart, moduleFeed, articleById, parseClinicalSummary,
  upcomingCongresses, type ClinicalSummary, type FeedItem, type FeedModuleKey,
} from "@/lib/doctorium";
import { keywordByKey } from "@/lib/hukuk-keywords";
import type { CongressRow } from "@/app/doktor/doctorium/CongressList";
import { db } from "@/lib/db";
import { FIXTURE_FEED, FIXTURE_LEGAL, FIXTURE_SUMMARY } from "./fixtures";
import { branchFirst } from "./pick";
import { isLandingBranch, isLandingModule, LANDING_MODULES, type LandingModuleKey } from "./taxonomy";

export interface LandingSample {
  branch: string;
  modules: LandingModuleKey[];
  items: FeedItem[];
  /** Bugün (TR günü) akışa düşen içerik — seçili bölümler + branş süzgeciyle. 0 olabilir. */
  todayTotal: number;
  todayByModule: Record<string, number>;
  source: "live" | "fixture";
}

const MEMO_TTL_MS = 10 * 60_000;
const MEMO_MAX = 64;
const memo = new Map<string, { at: number; value: LandingSample }>();

/** Sorgu parametrelerini doğrula; geçersizse null (çağıran 400 döner, tahmin yapılmaz). */
export function parseLandingQuery(b: string | null, m: string | null): { branch: string; modules: LandingModuleKey[] } | null {
  if (!b || !isLandingBranch(b)) return null;
  const raw = (m ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (raw.length === 0) return { branch: b, modules: LANDING_MODULES.map((x) => x.key) };
  const modules: LandingModuleKey[] = [];
  for (const k of raw) {
    if (!isLandingModule(k)) return null;
    if (!modules.includes(k)) modules.push(k);
  }
  return { branch: b, modules };
}

/** FeedItem.module → tercih anahtarı ("mevzuat" kind'a göre üçe ayrılır). */
function moduleKeyOf(item: FeedItem): string {
  if (item.module !== "mevzuat") return item.module;
  return item.kind === "ictihat" ? "hukuk-ictihat" : item.kind === "doktrin" ? "hukuk-doktrin" : "hukuk-mevzuat";
}

async function todayCounts(branch: string, modules: LandingModuleKey[]): Promise<Record<string, number>> {
  // personalFeedRaw ile AYNI kural: yalnız akademik branşla süzülür, diğer bölümler bölüm tercihiyle girer.
  const rows = await db.newsArticle.findMany({
    where: {
      createdAt: { gte: trDayStart() },
      OR: [{ module: { not: "akademik" } }, { branchSlugs: { contains: `"${branch}"` } }],
    },
    select: { module: true, kind: true },
  });
  const out: Record<string, number> = {};
  for (const r of rows) {
    const key = r.module === "mevzuat"
      ? r.kind === "ictihat" ? "hukuk-ictihat" : r.kind === "doktrin" ? "hukuk-doktrin" : "hukuk-mevzuat"
      : r.module;
    if (!modules.includes(key as LandingModuleKey)) continue;
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

export async function landingFeedSample(branch: string, modules: LandingModuleKey[], limit = 12): Promise<LandingSample> {
  const key = `${branch}|${[...modules].sort().join(",")}|${limit}`;
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < MEMO_TTL_MS) return hit.value;

  let value: LandingSample;
  try {
    const page = await personalFeedPage([branch], modules as FeedModuleKey[], {}, limit);
    const localized = page.items.length ? await localizeTitles(page.items) : page.items;
    if (!localized.length) throw new Error("boş akış");
    const items = branchFirst(localized, branch);
    const todayByModule = await todayCounts(branch, modules);
    value = {
      branch, modules, items, todayByModule,
      todayTotal: Object.values(todayByModule).reduce((a, b) => a + b, 0),
      source: "live",
    };
  } catch (e) {
    console.warn("[doctorium-landing] canlı akış yerine fixture:", e instanceof Error ? e.message : e);
    value = {
      branch, modules,
      items: FIXTURE_FEED.filter((i) => modules.includes(moduleKeyOf(i) as LandingModuleKey)),
      todayByModule: {}, todayTotal: 0, source: "fixture",
    };
    if (!value.items.length) value.items = [...FIXTURE_FEED];
  }

  if (memo.size >= MEMO_MAX) {
    const oldest = [...memo.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) memo.delete(oldest[0]);
  }
  memo.set(key, { at: Date.now(), value });
  return value;
}

// ── S2 kanıt bölümleri verisi ────────────────────────────────────────────────

export interface LandingProof {
  /** Akademik: gerçek AI özetli bir yayın (özet DB'den; anonim istek AI ÇAĞIRMAZ — yalnız hazır özet). */
  academic: { item: FeedItem; summary: ClinicalSummary; source: "live" | "fixture" };
  /** Hukuk: "Aydınlatılmış onam" sözlük çipiyle gerçek içtihat sonuçları. */
  legal: { query: string; keyword: string; items: FeedItem[]; source: "live" | "fixture" };
  /** Kongre: branşa göre yaklaşan etkinlikler (yoksa tüm branşlar; o da yoksa boş — fixture YOK). */
  congress: { rows: CongressRow[]; source: "live" | "empty" };
}

const proofMemo = new Map<string, { at: number; value: LandingProof }>();
const LEGAL_KEYWORD = "aydinlatilmis-onam";
const LEGAL_QUERY = "Aydınlatılmış onam";

async function academicProof(branch: string): Promise<LandingProof["academic"]> {
  // Hazır (DB'de) özeti olan en yeni yayın — önce branş, yoksa tüm branşlar. ensureClinicalSummary
  // BİLİNÇLİ çağrılmaz: anonim landing isteği AI maliyeti üretmemeli; özet portalda doktor açınca oluşur.
  for (const slugs of [[branch], []]) {
    const items = await moduleFeed("akademik", slugs, { limit: 40 });
    const withSummary = items.find((i) => i.hasAiSummary);
    if (!withSummary) continue;
    const full = await articleById(withSummary.id);
    const summary = parseClinicalSummary(full?.aiSummary ?? null);
    if (summary) {
      const [item] = await localizeTitles([withSummary]);
      return { item, summary, source: "live" };
    }
  }
  const item = FIXTURE_FEED.find((i) => i.module === "akademik") ?? FIXTURE_FEED[0];
  return { item, summary: FIXTURE_SUMMARY, source: "fixture" };
}

async function legalProof(): Promise<LandingProof["legal"]> {
  const kw = keywordByKey(LEGAL_KEYWORD);
  const items = kw
    ? await moduleFeed("mevzuat", [], { category: "ictihat", textContainsAny: kw.patterns, limit: 3 })
    : [];
  if (items.length) return { query: LEGAL_QUERY, keyword: LEGAL_KEYWORD, items, source: "live" };
  return { query: LEGAL_QUERY, keyword: LEGAL_KEYWORD, items: [...FIXTURE_LEGAL], source: "fixture" };
}

async function congressProof(branch: string): Promise<LandingProof["congress"]> {
  let rows = await upcomingCongresses([branch], { limit: 3 });
  if (rows.length < 2) rows = await upcomingCongresses([], { limit: 3 });
  return { rows, source: rows.length ? "live" : "empty" };
}

export async function landingProofSample(branch: string): Promise<LandingProof> {
  const hit = proofMemo.get(branch);
  if (hit && Date.now() - hit.at < MEMO_TTL_MS) return hit.value;
  let value: LandingProof;
  try {
    const [academic, legal, congress] = await Promise.all([academicProof(branch), legalProof(), congressProof(branch)]);
    value = { academic, legal, congress };
  } catch (e) {
    console.warn("[doctorium-landing] kanıt verisi yerine fixture:", e instanceof Error ? e.message : e);
    value = {
      academic: { item: FIXTURE_FEED[0], summary: FIXTURE_SUMMARY, source: "fixture" },
      legal: { query: LEGAL_QUERY, keyword: LEGAL_KEYWORD, items: [...FIXTURE_LEGAL], source: "fixture" },
      congress: { rows: [], source: "empty" },
    };
  }
  proofMemo.set(branch, { at: Date.now(), value });
  return value;
}

// Kart seçim yardımcıları → ./pick.ts (saf; istemci demo da kullanır). Sunucu çağıranlar için re-export.
export { branchFirst, pickOnePerModule } from "./pick";
