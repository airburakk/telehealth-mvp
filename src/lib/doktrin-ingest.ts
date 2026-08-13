// Hukuk modülü — Doktrin toplama: TR-Dizin (v6.91, 2026-08-12).
//
// Kaynak: search.trdizin.gov.tr — TÜBİTAK ULAKBİM hakemli dergi dizininin arama API'si.
// Kullanıcı kararı (2026-08-06): Doktrin = akademik LİNK-modeli + davet-edilen-yazar BİRLİKTE;
// TELİF gereği yalnız başlık+yazar+özet+LİNK saklanır — tam metin/PDF ASLA barındırılmaz
// (yargı kararlarının FSEK m.31 serbestisi makalelerde YOKTUR). Fizibilite 2026-08-12 canlı
// ölçümü: vault output/doctorium-hukuk-plani-2026-08-06.md §Fazlar.
//
// Ölçülmüş sözleşme (koda gömülü varsayımlar):
//   • GET /api/defaultSearch/publication/?q=<sorgu>&order=publicationYear-DESC&page=N&limit=M
//     → Elasticsearch zarfı {hits:{total:{value},hits:[{_source}]}}. Oturumsuz.
//   • ⚠️ `order` parametresi ZORUNLU: yokluğunda sunucu bozuk sorgu kurup json_parse_exception
//     döner (fizibilitede yarım gün yedirten tuzak — hata mesajı sorunu hiç anlatmıyor).
//   • _source.abstracts[] = {title, abstract, keywords, language:"TUR"|"ENG"} — TR öncelikli seçim.
//   • authors[].inPublicationName · journal.name · publicationYear · doi (sıkça null) · accessType.
//   • DOI yoksa kalıcı link: https://search.trdizin.gov.tr/tr/yayin/detay/<id> (200 doğrulandı).
//   • Hız freni gözlemlenmedi; yine de kamu ucu nezaketi: istekler arası GAP_MS + ardışık-hata
//     eşiği (Yargıtay dersinin genellenmesi — fizibilite ≠ işletim).
//
// İçtihat'tan yapısal fark: metadata TEK istekte tam gelir (getDokuman benzeri ikinci aşama YOK)
// → koşu ucuz; ilk dolum bile cron bütçesine sığar. Sorgu başına yalnız İLK sayfalar taranır
// (publicationYear-DESC — akış "yeni yayınlar" mantığıyla yaşar, tam arşiv hedeflenmez).
import { db } from "./db";
import { extractBranches } from "./hukuk-keywords";

const BASE = "https://search.trdizin.gov.tr";
export const GAP_MS = 800;
const PAGE_LIMIT = 24; // sayfa başına kayıt (test edilen aralık 1-24)
const MAX_PAGES_PER_QUERY = 5; // sorgu başına en yeni ~120 kayıt — arşiv değil akış
const MAX_CONSECUTIVE_FAILS = 3;
const FETCH_TIMEOUT_MS = 20_000;
const SUMMARY_MAX = 4_000; // özetler tipik 1-2K; taşkın kırpılır

// Sorgu seti — hukukçu düzenler (hukuk-keywords sözlüğüyle aynı disiplin: geniş tek kelime yok).
// "sağlık hukuku" bilinçli DAHİL (1.481 kayıt — alanın omurga terimi); publicationYear-DESC +
// MAX_PAGES sınırı sayesinde yalnız en yeni dilim alınır.
export const DOKTRIN_QUERIES: string[] = [
  "sağlık hukuku",
  "tıbbi malpraktis",
  "malpraktis",
  "hekimin hukuki sorumluluğu",
  "aydınlatılmış onam",
];

export interface DoktrinIngestResult {
  found: number; // sorguların döndürdüğü benzersiz yayın (DB'de olanlar dahil)
  created: number;
  errors: string[];
}

interface TrdizinAbstract {
  title?: string;
  abstract?: string;
  keywords?: string[] | string;
  language?: string;
}
interface TrdizinSource {
  id?: number | string;
  abstracts?: TrdizinAbstract[];
  authors?: { inPublicationName?: string }[];
  journal?: { name?: string };
  publicationYear?: number | string;
  doi?: string | null;
  accessType?: string;
}

function short(e: unknown): string {
  return (e instanceof Error ? e.message : String(e)).slice(0, 140);
}

export function searchUrl(query: string, page: number, limit = PAGE_LIMIT): string {
  // ⚠️ order paramı ZORUNLU (yukarıdaki sözleşme notu) — silme.
  return `${BASE}/api/defaultSearch/publication/?q=${encodeURIComponent(query)}&order=publicationYear-DESC&page=${page}&limit=${limit}`;
}

async function searchPage(query: string, page: number): Promise<{ total: number; sources: TrdizinSource[] }> {
  const res = await fetch(searchUrl(query, page), {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0", Accept: "application/json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = (await res.json()) as {
    error?: { reason?: string };
    hits?: { total?: { value?: number }; hits?: { _source?: TrdizinSource }[] };
  };
  // Sunucu hataları 200 gövdesinde `error` olarak da gelebiliyor (order eksikliği sınıfı) —
  // sessiz boş liste sanılmasın.
  if (j?.error) throw new Error(`api: ${String(j.error.reason ?? "error").slice(0, 100)}`);
  return {
    total: j?.hits?.total?.value ?? 0,
    sources: (j?.hits?.hits ?? []).map((h) => h._source).filter((s): s is TrdizinSource => !!s),
  };
}

/**
 * İstemci-taraflı TAM-İBARE doğrulaması (2026-08-12 dry-run dersi): Elasticsearch `q`'yu gevşek
 * skorlar — "sağlık hukuku" sorgusu "Belediyelerin Sahipsiz Hayvanlarla İlgili Sorumluluğu" gibi
 * alakasız kayıtlar döndürüyordu; tırnaklı sorgu ise sunucunun ES şablonunu KIRIYOR
 * (`failed to parse field [must]`). Çare hukuk-keywords ilkesinin aynısı: kayıt ancak
 * başlık/özet/anahtar-kelimelerinde ibare BİREBİR geçiyorsa alınır (tr-TR katlamayla).
 */
export function matchesQuery(src: TrdizinSource, query: string): boolean {
  const needle = query.toLocaleLowerCase("tr-TR");
  return combinedText(src).toLocaleLowerCase("tr-TR").includes(needle);
}

/** Tüm dil varyantlarının başlık+özet+keywords birleşimi (ibare doğrulaması + branş çıkarımı). */
export function combinedText(src: TrdizinSource): string {
  return (src.abstracts ?? [])
    .map((a) => {
      const kw = Array.isArray(a.keywords) ? a.keywords.join(" ") : (a.keywords ?? "");
      return `${a.title ?? ""} ${a.abstract ?? ""} ${kw}`;
    })
    .join(" ");
}

/** TR öncelikli başlık/özet çifti; ikisi de yoksa null (başlıksız kayıt yazılmaz — uydurma yok). */
export function pickTitleAbstract(abstracts: TrdizinAbstract[] | undefined): { title: string; abstract: string } | null {
  const list = abstracts ?? [];
  const tr = list.find((a) => (a.language ?? "").toUpperCase() === "TUR");
  const chosen = tr?.title?.trim() ? tr : list.find((a) => a.title?.trim());
  if (!chosen?.title?.trim()) return null;
  return { title: chosen.title.trim(), abstract: (chosen.abstract ?? "").trim() };
}

/** "Ad Soyad, Ad Soyad, Ad Soyad ve ark." — İçtihat'ın aksine yazar Doktrin'in kimliğidir. */
export function authorLine(authors: { inPublicationName?: string }[] | undefined): string | null {
  const names = (authors ?? []).map((a) => a.inPublicationName?.trim()).filter((n): n is string => !!n);
  if (!names.length) return null;
  return names.length > 3 ? `${names.slice(0, 3).join(", ")} ve ark.` : names.join(", ");
}

/** DOI varsa kalıcı DOI linki; yoksa TR-Dizin yayın detay sayfası (şablon 200 doğrulandı). */
export function publicationUrl(id: string, doi: string | null | undefined): string {
  return doi?.trim() ? `https://doi.org/${doi.trim()}` : `${BASE}/tr/yayin/detay/${id}`;
}

/**
 * TR-Dizin doktrin toplama — idempotent, tek aşamalı. Sorgular gezilir (en yeni MAX_PAGES sayfa),
 * benzersiz yayınlar DB farkıyla yazılır. Hata/fren ardışık eşikte koşuyu keser; kısmi ilerleme
 * kalıcıdır (source=trdizin, externalId=id benzersizliği).
 */
export async function ingestDoktrin(opts: { queries?: string[]; maxPages?: number } = {}): Promise<DoktrinIngestResult> {
  const queries = opts.queries ?? DOKTRIN_QUERIES;
  const maxPages = opts.maxPages ?? MAX_PAGES_PER_QUERY;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const out: DoktrinIngestResult = { found: 0, created: 0, errors: [] };

  // 1) Arama havuzu (Map dedupe — aynı makale birden çok sorguda çıkar). Kayıt havuza YALNIZ
  // ibare doğrulamasından geçerse girer (matchesQuery — gevşek ES skoru güvenilmez).
  const pool = new Map<string, TrdizinSource>();
  for (const q of queries) {
    try {
      const first = await searchPage(q, 1);
      for (const s of first.sources) if (s.id != null && matchesQuery(s, q)) pool.set(String(s.id), s);
      const pages = Math.min(Math.ceil(first.total / PAGE_LIMIT), maxPages);
      for (let p = 2; p <= pages; p++) {
        await sleep(GAP_MS);
        for (const s of (await searchPage(q, p)).sources) {
          if (s.id != null && matchesQuery(s, q)) pool.set(String(s.id), s);
        }
      }
    } catch (e) {
      out.errors.push(`arama "${q}": ${short(e)}`);
      break; // nazik geri çekilme — kalan sorgular ertesi koşuya (idempotent devam)
    }
    await sleep(GAP_MS);
  }
  out.found = pool.size;
  if (!pool.size) return out;

  // 2) DB farkı — bilinenlere yazma denenmez.
  const ids = [...pool.keys()];
  const existing = await db.newsArticle.findMany({
    where: { source: "trdizin", externalId: { in: ids } },
    select: { externalId: true },
  });
  const known = new Set(existing.map((r) => r.externalId));

  // 3) Yenilerin kaydı (ağ isteği yok — metadata elde; yalnız DB yazımı).
  let consecutiveFails = 0;
  for (const id of ids) {
    if (known.has(id)) continue;
    const s = pool.get(id)!;
    const ta = pickTitleAbstract(s.abstracts);
    const year = Number(s.publicationYear);
    if (!ta || !Number.isInteger(year) || year < 1900 || year > 2100) {
      out.errors.push(`yayın ${id}: başlık/yıl eksik`);
      continue; // içerik sorunu — ardışık-hata sayacına girmez
    }
    try {
      await db.newsArticle.create({
        data: {
          source: "trdizin",
          externalId: id,
          module: "mevzuat", // iç anahtar — kullanıcı yüzü "Hukuk" (lib/doctorium.ts)
          category: "doktrin",
          // v6.93: deterministik ÇOK-BRANŞ etiketi — başlık+özet+keywords'te geçen branşlar
          // (bir makale birden çok branşı etkileyebilir; kullanıcı isteği 2026-08-14).
          branchSlugs: JSON.stringify(extractBranches(combinedText(s))),
          kind: "doktrin",
          title: ta.title,
          // TELİF sınırı: yalnız ÖZET (dizinde herkese açık metadata) — tam metin asla.
          summary: ta.abstract.slice(0, SUMMARY_MAX),
          sourceName: s.journal?.name?.trim() || "TR-Dizin",
          authors: authorLine(s.authors),
          url: publicationUrl(id, s.doi),
          doi: s.doi?.trim() || null,
          // Dizin yalnız YIL verir → yıl başı (kart "1 Oca <yıl>" basar; ay bilgisi uydurulmaz).
          publishedAt: new Date(`${year}-01-01T00:00:00Z`),
        },
      });
      out.created++;
      consecutiveFails = 0;
    } catch (e) {
      if ((e as { code?: string })?.code === "P2002") continue; // eşzamanlı yazar yarışı — kayıt zaten var
      out.errors.push(`yayın ${id}: ${short(e)}`);
      if (++consecutiveFails >= MAX_CONSECUTIVE_FAILS) break;
    }
  }
  return out;
}
