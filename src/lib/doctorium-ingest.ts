// Doctorium — içerik toplama (ingestion) katmanı, v6.48.
//
// MİMARİ: Günlük bakım cron'u (purge-deleted rotası — Vercel Hobby cron limiti 2/2 DOLU, yeni
// zamanlanmış iş açılamaz) burayı çağırır; kaynaklar taranıp `NewsArticle` tablosuna YAZILIR.
// Doktor sayfayı açtığında dış API'ye GİDİLMEZ, DB'den okunur (hız + NCBI'ya nezaket + filtre/arama).
//
// KAYNAKLAR:
//   (C) Akademik  — PubMed E-utilities (NCBI). Branş→MeSH sorgusu `NEWS_QUERIES` (lib/medical-news).
//   (B) Sektörel  — T.C. Resmî Gazete günlük fihristi, SAĞLIK anahtar kelimeleriyle süzülür.
//                   ⚠️ Resmî Gazete/TİTCK/SGK makine-okunur besleme (RSS/API) YAYIMLAMIYOR
//                   (2026-08-01'de ölçüldü: /rss uçları HTML döndürüyor) → HTML fihrist kazınır.
//                   Kırılgan: site yeniden tasarlanırsa seçici bozulur, ingest 0 kayıtla döner ve
//                   cron yanıtında görünür. UYDURMA İÇERİK ÜRETİLMEZ — kazınamazsa hiçbir şey yazılmaz.
//
// İÇERİK PHI DEĞİLDİR (herkese açık literatür/mevzuat) → şifrelenmez, düz saklanır. Bilinçli.
import { db } from "./db";
import { NEWS_QUERIES } from "./medical-news";
import { BRANCHES } from "./triage";
import {
  fetchGazetteToday, ingestGazetteItems, ingestOhsad, ingestTtb,
  ingestFdaRecalls, ingestTrials, ingestWho, describeFetchError,
} from "./doctorium-sources";

const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const UA = "Mozilla/5.0 (compatible; AuraHealth/1.0; +https://telehealth-mvp-roan.vercel.app)";
const RELDATE_DAYS = 180; // son 6 ay — günlük koşuda taze havuz yeter
const PER_BRANCH = 3; // branş başına yayın (30 branş × 3 = ~90 kayıt/gün üst sınırı)
const NCBI_GAP_MS = 400; // anahtarsız NCBI sınırı 3 istek/sn — altında kal

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Branş ETİKETİ → SLUG (şemada slug saklanır: etiket değişse de bağ kopmaz).
const LABEL_TO_SLUG: Record<string, string> = Object.fromEntries(BRANCHES.map((b) => [b.label, b.key]));

export interface IngestResult {
  pubmedFetched: number;
  pubmedNew: number;
  gazetteFetched: number;
  gazetteNew: number;
  /** v6.50 — kaynak başına [taranan, yeni] (ohsad · ttb · fda · trials · who). */
  sources: Record<string, [number, number]>;
  errors: string[];
}

// ── PubMed ──────────────────────────────────────────────────────────────────

interface PubMedSummary {
  uid: string;
  title?: string;
  fulljournalname?: string;
  source?: string;
  pubdate?: string;
  sortpubdate?: string;
  authors?: { name: string }[];
  articleids?: { idtype: string; value: string }[];
  pubtype?: string[];
}

async function eutils(path: string, params: Record<string, string>): Promise<unknown | null> {
  const qs = new URLSearchParams({ ...params, retmode: "json", tool: "aura-health", email: "info@aura.health" });
  try {
    const res = await fetch(`${EUTILS}/${path}?${qs}`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};
function pubDate(pubdate?: string, sortpubdate?: string): Date | null {
  if (sortpubdate) {
    const m = /^(\d{4})\/(\d{2})\/(\d{2})/.exec(sortpubdate);
    if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
  }
  const p = (pubdate ?? "").trim().split(/\s+/);
  if (!/^\d{4}$/.test(p[0] ?? "")) return null;
  const mo = MONTHS[(p[1] ?? "").slice(0, 3).toLowerCase()] ?? "01";
  const d = /^\d{1,2}$/.test(p[2] ?? "") ? (p[2] as string).padStart(2, "0") : "01";
  return new Date(`${p[0]}-${mo}-${d}T00:00:00Z`);
}

// efetch XML'inden abstract (esummary abstract vermez). Parser yok — hedefli regex; başarısızlık
// özetsiz kayıt demektir, akış bozulmaz.
async function fetchAbstracts(ids: string[]): Promise<Record<string, string>> {
  if (!ids.length) return {};
  const qs = new URLSearchParams({ db: "pubmed", id: ids.join(","), rettype: "abstract", retmode: "xml", tool: "aura-health" });
  try {
    const res = await fetch(`${EUTILS}/efetch.fcgi?${qs}`, { cache: "no-store" });
    if (!res.ok) return {};
    const xml = await res.text();
    const out: Record<string, string> = {};
    for (const block of xml.split("</PubmedArticle>")) {
      const pmid = /<PMID[^>]*>(\d+)<\/PMID>/.exec(block)?.[1];
      if (!pmid) continue;
      const parts = [...block.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g)].map((m) => m[1]);
      if (!parts.length) continue;
      const text = parts.join(" ")
        .replace(/<[^>]+>/g, "")
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
        .replace(/\s+/g, " ").trim();
      if (text) out[pmid] = text.slice(0, 4000);
    }
    return out;
  } catch {
    return {};
  }
}

function kindFromPubtype(pubtype?: string[]): string {
  const t = (pubtype ?? []).join(" ").toLowerCase();
  return t.includes("clinical trial") || t.includes("randomized") ? "ilac" : "makale";
}

function authorLine(authors?: { name: string }[]): string | null {
  if (!authors?.length) return null;
  const names = authors.slice(0, 3).map((a) => a.name);
  return authors.length > 3 ? `${names.join(", ")}, ve ark.` : names.join(", ");
}

/** Tek sorgu → NewsArticle upsert. Dönen: [çekilen, yeni]. */
async function ingestQuery(term: string, limit: number, slugs: string[]): Promise<[number, number]> {
  const search = (await eutils("esearch.fcgi", {
    db: "pubmed", term: `(${term}) AND hasabstract`, retmax: String(limit),
    sort: "pub_date", datetype: "pdat", reldate: String(RELDATE_DAYS),
  })) as { esearchresult?: { idlist?: string[] } } | null;
  const ids = search?.esearchresult?.idlist ?? [];
  if (!ids.length) return [0, 0];

  await sleep(NCBI_GAP_MS);
  const sum = (await eutils("esummary.fcgi", { db: "pubmed", id: ids.join(",") })) as
    | { result?: Record<string, PubMedSummary> }
    | null;
  if (!sum?.result) return [0, 0];

  await sleep(NCBI_GAP_MS);
  const abstracts = await fetchAbstracts(ids);

  let created = 0;
  for (const id of ids) {
    const r = sum.result[id];
    if (!r?.title) continue;
    const when = pubDate(r.pubdate, r.sortpubdate);
    if (!when) continue;
    const doi = r.articleids?.find((a) => a.idtype === "doi")?.value ?? null;
    const data = {
      module: "akademik",
      branchSlugs: JSON.stringify(slugs),
      kind: kindFromPubtype(r.pubtype),
      title: r.title.replace(/\s*\.\s*$/, "").replace(/^\[|\]\.?$/g, ""),
      summary: abstracts[id] ?? "",
      sourceName: r.fulljournalname || r.source || "PubMed",
      authors: authorLine(r.authors),
      url: doi ? `https://doi.org/${doi}` : `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
      doi,
      publishedAt: when,
    };
    // Aynı yayın birden fazla branş sorgusundan gelebilir → mevcut kaydın branşlarını BİRLEŞTİR
    // (üzerine yazmak son sorgunun branşını tek doğru sayardı, yayın diğer branştan kaybolurdu).
    const existing = await db.newsArticle.findUnique({
      where: { source_externalId: { source: "pubmed", externalId: id } },
      select: { id: true, branchSlugs: true },
    });
    if (existing) {
      const merged = [...new Set([...(JSON.parse(existing.branchSlugs) as string[]), ...slugs])];
      if (merged.length !== JSON.parse(existing.branchSlugs).length) {
        await db.newsArticle.update({ where: { id: existing.id }, data: { branchSlugs: JSON.stringify(merged) } });
      }
    } else {
      await db.newsArticle.create({ data: { source: "pubmed", externalId: id, ...data } });
      created++;
    }
  }
  return [ids.length, created];
}

// ── Cron girişi ─────────────────────────────────────────────────────────────

/**
 * Tüm kaynakları tarar. Bir kaynağın hatası diğerini DÜŞÜRMEZ (hatalar toplanıp raporlanır) —
 * cron'un asıl işi (imha) zaten ayrı try/catch'te; Doctorium ingest'i kritik değildir.
 */
export async function ingestDoctorium(): Promise<IngestResult> {
  const out: IngestResult = { pubmedFetched: 0, pubmedNew: 0, gazetteFetched: 0, gazetteNew: 0, sources: {}, errors: [] };

  // Akademik: her branş için MeSH sorgusu (sıralı + throttle — NCBI 3 istek/sn sınırı).
  for (const [label, term] of Object.entries(NEWS_QUERIES)) {
    const slug = LABEL_TO_SLUG[label];
    if (!slug) {
      out.errors.push(`slug bulunamadı: ${label}`);
      continue;
    }
    try {
      const [fetched, created] = await ingestQuery(term, PER_BRANCH, [slug]);
      out.pubmedFetched += fetched;
      out.pubmedNew += created;
    } catch (e) {
      out.errors.push(`pubmed/${slug}: ${describeFetchError(e).slice(0, 120)}`);
    }
    await sleep(NCBI_GAP_MS);
  }

  // Mevzuat: Resmî Gazete günlük fihristi (bugün).
  try {
    const items = await fetchGazetteToday();
    const [scanned, created] = await ingestGazetteItems(items);
    out.gazetteFetched = scanned;
    out.gazetteNew = created;
  } catch (e) {
    // v6.57: describeFetchError `error.cause` zincirini kazır — yüzeysel "fetch failed" yerine
    // gerçek kod (ECONNREFUSED/ETIMEDOUT/TimeoutError/EPROTO…) cron raporuna düşer.
    out.errors.push(`resmi-gazete: ${describeFetchError(e).slice(0, 200)}`);
  }

  // Sektörel + ilaç kaynakları (v6.50). Her biri BAĞIMSIZ try: biri bozulursa diğerleri toplar.
  const collectors: [string, () => Promise<[number, number]>][] = [
    ["ohsad", ingestOhsad],
    ["ttb", ingestTtb],
    ["fda", () => ingestFdaRecalls(10)],
    ["trials", () => ingestTrials(10)],
    ["who", () => ingestWho(8)],
  ];
  for (const [name, fn] of collectors) {
    try {
      out.sources[name] = await fn();
    } catch (e) {
      out.sources[name] = [0, 0];
      out.errors.push(`${name}: ${describeFetchError(e).slice(0, 200)}`);
    }
  }

  return out;
}
