// Doctorium — HAKEMLİ AÇIK ERİŞİM akademik kaynaklar (2026-08-18, kullanıcı kararı:
// "hakemli açık kaynakları bağlayalım"). PubMed'in yanına iki açık kaynak:
//
//   · Europe PMC — REST search (anahtarsız). SRC:MED|PMC + OPEN_ACCESS:Y + HAS_ABSTRACT:Y;
//     preprint (SRC:PPR) KAPSAM DIŞI — sekme başlığı "hakemli yayınlar" olduğu için hakemsiz
//     içerik bilinçli dışarıda (iddia disiplini v6.8).
//   · DOAJ — Directory of Open Access Journals article API (anahtarsız). DOAJ'a dergi kabulü
//     hakemlilik şartına bağlıdır → kaynak düzeyinde hakemli sayılır; özetsiz kayıt alınmaz.
//
// ÇAPRAZ-KAYNAK TEKİLLEŞTİRME: aynı makale PubMed + Europe PMC + DOAJ'da olabilir. Yeni kayıt
// yazmadan önce DOI (ve Europe PMC MED kayıtlarında PMID) TÜM kaynaklarda aranır; bulunursa
// yeni kayıt AÇILMAZ, mevcut kaydın branşları BİRLEŞTİRİLİR (pubmed ingest'inin çok-branş
// birleştirme sözleşmesiyle aynı — yayın hiçbir branştan kaybolmaz, liste çift görmez).
//
// SORGULAR: PubMed MeSH sorguları (NEWS_QUERIES) bu API'lerde geçersiz — meshToKeywords()
// alan etiketlerini ([mh]/[sh]) söküp boolean yapıyı koruyarak tırnaklı anahtar-kelime
// sorgusuna çevirir (MeSH terimleri İngilizce tıbbi terimlerdir; serbest metin aramada çalışır).
//
// İÇERİK PHI DEĞİLDİR (açık literatür) → şifrelenmez. Kaynak logosu eklenmedi (CoverArt
// akademik kayıtlarda zaten jenerik/branş bandı çizer — pubmed ile aynı yol).
import { db } from "./db";
import { NEWS_QUERIES } from "./medical-news";
import { BRANCHES } from "./triage";

const UA = "Mozilla/5.0 (compatible; AuraHealth/1.0; +https://telehealth-mvp-roan.vercel.app)";
const LABEL_TO_SLUG: Record<string, string> = Object.fromEntries(BRANCHES.map((b) => [b.label, b.key]));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface AcademicIngestOpts {
  /** Kaç gün geriye bakılacak (günlük koşu ~21; backfill 365). */
  days: number;
  /** Branş başına en fazla kaç kayıt. */
  perBranch: number;
}

/** "neoplasms[mh] AND (therapy[sh] OR diagnosis[sh])" → "\"neoplasms\" AND (\"therapy\" OR \"diagnosis\")" */
export function meshToKeywords(mesh: string): string {
  return mesh.replace(/([A-Za-z][A-Za-z0-9 ,'-]*?)\s*\[[a-z ]+\]/gi, (_, term: string) => `"${term.trim()}"`);
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Çapraz-kaynak tekilleştirme: DOI/PMID başka kaynakta varsa oraya branş BİRLEŞTİR, true dön
 * (çağıran yeni kayıt açmaz). ⚠️ doi kolonu index'siz — MVP hacminde (bin-küsur satır) ucuz;
 * hacim büyürse @@index([doi]) migration'ı eklenir.
 */
async function mergeIfKnown(doi: string | null, pmid: string | null, slugs: string[]): Promise<boolean> {
  const existing =
    (doi ? await db.newsArticle.findFirst({ where: { doi }, select: { id: true, branchSlugs: true } }) : null) ??
    (pmid
      ? await db.newsArticle.findFirst({
          where: { source: "pubmed", externalId: pmid },
          select: { id: true, branchSlugs: true },
        })
      : null);
  if (!existing) return false;
  const prev = JSON.parse(existing.branchSlugs) as string[];
  const merged = [...new Set([...prev, ...slugs])];
  if (merged.length !== prev.length) {
    await db.newsArticle.update({ where: { id: existing.id }, data: { branchSlugs: JSON.stringify(merged) } });
  }
  return true;
}

/** Aynı kaynaktan gelen kaydın kendi (source, externalId) birleştirmesi — pubmed sözleşmesi. */
async function upsertArticle(
  source: string,
  externalId: string,
  slugs: string[],
  data: {
    kind: string;
    title: string;
    summary: string;
    sourceName: string;
    authors: string | null;
    url: string;
    doi: string | null;
    publishedAt: Date;
  },
): Promise<boolean> {
  const existing = await db.newsArticle.findUnique({
    where: { source_externalId: { source, externalId } },
    select: { id: true, branchSlugs: true },
  });
  if (existing) {
    const prev = JSON.parse(existing.branchSlugs) as string[];
    const merged = [...new Set([...prev, ...slugs])];
    if (merged.length !== prev.length) {
      await db.newsArticle.update({ where: { id: existing.id }, data: { branchSlugs: JSON.stringify(merged) } });
    }
    return false;
  }
  await db.newsArticle.create({
    data: { source, externalId, module: "akademik", branchSlugs: JSON.stringify(slugs), ...data },
  });
  return true;
}

function kindFromTypes(types: string[]): string {
  const t = types.join(" ").toLowerCase();
  return t.includes("clinical trial") || t.includes("randomized") ? "ilac" : "makale";
}

// ── Europe PMC ──────────────────────────────────────────────────────────────

interface EpmcResult {
  id: string;
  source: string; // MED | PMC | ...
  pmid?: string;
  doi?: string;
  title?: string;
  authorString?: string;
  journalTitle?: string;
  firstPublicationDate?: string; // YYYY-MM-DD
  abstractText?: string;
  pubTypeList?: { pubType?: string[] };
}

async function epmcBranch(mesh: string, slug: string, opts: AcademicIngestOpts): Promise<[number, number]> {
  const to = new Date();
  const from = new Date(to.getTime() - opts.days * 86400_000);
  // SRC:MED|PMC = hakemli indeks kayıtları (PPR/preprint bu kümede YOK). resultType=core → abstract.
  const query = `(${meshToKeywords(mesh)}) AND OPEN_ACCESS:Y AND HAS_ABSTRACT:Y AND (SRC:MED OR SRC:PMC) AND FIRST_PDATE:[${iso(from)} TO ${iso(to)}]`;
  const qs = new URLSearchParams({
    query,
    format: "json",
    resultType: "core",
    pageSize: String(opts.perBranch),
    sort: "P_PDATE_D desc",
  });
  const res = await fetch(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?${qs}`, {
    headers: { "user-agent": UA },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`europepmc HTTP ${res.status}`);
  const json = (await res.json()) as { resultList?: { result?: EpmcResult[] } };
  const results = json.resultList?.result ?? [];

  let created = 0;
  for (const r of results) {
    if (!r.title || !r.abstractText || !r.firstPublicationDate) continue;
    const when = new Date(`${r.firstPublicationDate}T00:00:00Z`);
    if (Number.isNaN(when.getTime())) continue;
    const doi = r.doi ?? null;
    const pmid = r.pmid ?? (r.source === "MED" ? r.id : null);
    if (await mergeIfKnown(doi, pmid, [slug])) continue;
    const isNew = await upsertArticle("europepmc", `${r.source}:${r.id}`, [slug], {
      kind: kindFromTypes(r.pubTypeList?.pubType ?? []),
      title: r.title.replace(/\s*\.\s*$/, ""),
      summary: r.abstractText.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 4000),
      sourceName: r.journalTitle || "Europe PMC",
      authors: r.authorString?.slice(0, 300) ?? null,
      url: doi ? `https://doi.org/${doi}` : `https://europepmc.org/article/${r.source}/${r.id}`,
      doi,
      publishedAt: when,
    });
    if (isNew) created++;
  }
  return [results.length, created];
}

// ── DOAJ ────────────────────────────────────────────────────────────────────

interface DoajResult {
  id: string;
  created_date?: string;
  bibjson?: {
    title?: string;
    abstract?: string;
    year?: string;
    month?: string;
    journal?: { title?: string };
    author?: { name?: string }[];
    identifier?: { type?: string; id?: string }[];
    link?: { type?: string; url?: string }[];
  };
}

async function doajBranch(mesh: string, slug: string, opts: AcademicIngestOpts): Promise<[number, number]> {
  const cutoff = new Date(Date.now() - opts.days * 86400_000);
  const query = encodeURIComponent(meshToKeywords(mesh));
  const res = await fetch(
    `https://doaj.org/api/search/articles/${query}?pageSize=${opts.perBranch}&sort=${encodeURIComponent("created_date:desc")}`,
    { headers: { "user-agent": UA }, cache: "no-store" },
  );
  if (!res.ok) throw new Error(`doaj HTTP ${res.status}`);
  const json = (await res.json()) as { results?: DoajResult[] };
  const results = json.results ?? [];

  let created = 0;
  for (const r of results) {
    const b = r.bibjson;
    if (!b?.title || !b.abstract) continue; // özetsiz kayıt alınmaz (hakemli özetli sözleşme)
    const when = b.year
      ? new Date(`${b.year}-${(b.month ?? "1").padStart(2, "0")}-01T00:00:00Z`)
      : r.created_date
        ? new Date(r.created_date)
        : null;
    if (!when || Number.isNaN(when.getTime()) || when < cutoff) continue;
    const doi = b.identifier?.find((i) => i.type?.toLowerCase() === "doi")?.id ?? null;
    if (await mergeIfKnown(doi, null, [slug])) continue;
    const fulltext = b.link?.find((l) => l.type === "fulltext")?.url;
    const names = (b.author ?? []).map((a) => a.name).filter(Boolean) as string[];
    const isNew = await upsertArticle("doaj", r.id, [slug], {
      kind: "makale",
      title: b.title.replace(/\s*\.\s*$/, ""),
      summary: b.abstract.replace(/\s+/g, " ").trim().slice(0, 4000),
      sourceName: b.journal?.title || "DOAJ",
      authors: names.length ? (names.length > 3 ? `${names.slice(0, 3).join(", ")}, ve ark.` : names.join(", ")) : null,
      url: doi ? `https://doi.org/${doi}` : (fulltext ?? `https://doaj.org/article/${r.id}`),
      doi,
      publishedAt: when > new Date() ? new Date() : when,
    });
    if (isNew) created++;
  }
  return [results.length, created];
}

// ── Branş döngüleri (cron + backfill ortak) ─────────────────────────────────

async function runAllBranches(
  fn: (mesh: string, slug: string, opts: AcademicIngestOpts) => Promise<[number, number]>,
  opts: AcademicIngestOpts,
  gapMs: number,
): Promise<[number, number]> {
  let scanned = 0;
  let created = 0;
  const errors: string[] = [];
  for (const [label, mesh] of Object.entries(NEWS_QUERIES)) {
    const slug = LABEL_TO_SLUG[label];
    if (!slug) continue;
    try {
      const [s, c] = await fn(mesh, slug, opts);
      scanned += s;
      created += c;
    } catch (e) {
      errors.push(`${slug}: ${e instanceof Error ? e.message : String(e)}`);
    }
    await sleep(gapMs);
  }
  // Kısmi hata tolere edilir; TÜM branşlar düştüyse kaynak gerçekten bozuktur → cron raporuna düş.
  if (errors.length && scanned === 0) throw new Error(errors[0]);
  return [scanned, created];
}

/** Günlük cron varsayılanları küçük tutar (Hobby maxDuration bütçesi); backfill opts geçer. */
export const ingestEuropePmcAll = (opts: AcademicIngestOpts = { days: 21, perBranch: 2 }) =>
  runAllBranches(epmcBranch, opts, 250);

export const ingestDoajAll = (opts: AcademicIngestOpts = { days: 21, perBranch: 2 }) =>
  runAllBranches(doajBranch, opts, 400);
