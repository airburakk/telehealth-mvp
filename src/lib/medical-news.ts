// M5 — Haberler içerik motoru.
//
// İKİ KATMAN (2026-08-01, v6.47):
//   (A) CANLI besleme — PubMed E-utilities (NCBI): doktorun branşına göre son 1 yılın yayınları,
//       gerçek dergi künyesi + gerçek DOI/PubMed bağlantısı. `fetchBranchNews()`. Başlık/özet
//       İngilizce gelir → Translation önbelleğiyle TR'ye çevrilir (AI yoksa özgün dilde kalır).
//   (B) STUB fallback — aşağıdaki GENERAL/BY_BRANCH kartları. `newsForBranch()` (senkron).
//       ⚠️ Bu kartlar ÖRNEK içeriktir (uydurma) → UI'da "örnek içerik" olarak işaretlenmeli ve
//       ASLA gerçek makale bağlantısı verilmemeli. Partner sayfası bu senkron yolu kullanır.
//
// NEDEN PubMed: anahtar/kayıt gerektirmez, kaynak birincil (dergi + DOI), sağlık verisi GÖNDERMEZ
// (yalnız branş adına karşılık gelen MeSH sorgusu gider — hasta bilgisi çıkmaz).
import { db } from "./db";
import { translateText } from "./ai-clinical";
import { createHash } from "crypto";

export type NewsKind = "haber" | "makale" | "ilac";

export interface NewsItem {
  id: string;
  kind: NewsKind;
  title: string;
  source: string;
  summary: string;
  date: string; // ISO; demo göreli tarihler üretimde sabit tutulur
  /** Canlı katman: yayının kalıcı adresi (DOI varsa doi.org, yoksa PubMed). Stub'da DAİMA null. */
  url?: string | null;
  /** Canlı katman: DOI (gösterimde mono künye). */
  doi?: string | null;
  /** Bu kalem doktorun branşından mı geldi (sıralamada öne alınır) — null = genel gündem. */
  branch?: string | null;
  /** Çeviri uygulandıysa özgün (İngilizce) başlık — kartta ikincil satır olarak gösterilir. */
  titleOriginal?: string | null;
  /** Yazar künyesi ("Yılmaz A, Chen B, ve ark.") — canlı katmanda dolu. */
  authors?: string | null;
}

export const NEWS_KIND_LABEL: Record<NewsKind, string> = {
  haber: "Haber",
  makale: "Makale",
  ilac: "İlaç Geliştirme",
};

// Her doktora gösterilen genel tıp gündemi (branştan bağımsız).
const GENERAL: NewsItem[] = [
  { id: "gen-1", kind: "haber", title: "DSÖ dijital sağlık çerçevesini güncelledi", source: "WHO Bülten", summary: "Teletıp ve sınır-ötesi konsültasyon için yeni rehber ilkeler yayımlandı.", date: "2026-06-24" },
  { id: "gen-2", kind: "makale", title: "Yapay zekâ destekli triyajda doğruluk meta-analizi", source: "The Lancet Digital Health", summary: "Çok merkezli çalışma, AI ön-değerlendirmenin aciliyet sınıflamasında uzman uyumunu inceledi.", date: "2026-06-20" },
  { id: "gen-3", kind: "ilac", title: "Geniş spektrumlu antiviral faz-3 sonuçları", source: "NEJM", summary: "Yeni molekül için faz-3 verileri güvenlik profiliyle birlikte açıklandı.", date: "2026-06-18" },
];

// Branşa özel örnek kartlar (Faz 1 demo). Anahtar = Doctor.branch etiketi; eşleşme yoksa yalnız GENERAL döner.
const BY_BRANCH: Record<string, NewsItem[]> = {
  Kardiyoloji: [
    { id: "kar-1", kind: "makale", title: "Yeni nesil antikoagülanlarda kanama riski karşılaştırması", source: "JACC", summary: "Gerçek-dünya verisinde DOAC alt grupları arasında kanama olaylarının dağılımı.", date: "2026-06-23" },
    { id: "kar-2", kind: "ilac", title: "Kalp yetmezliğinde SGLT2 inhibitörü endikasyon genişlemesi", source: "ESC Haber", summary: "Düzenleyici kurum, korunmuş ejeksiyon fraksiyonu için onay sürecini ilerletti.", date: "2026-06-19" },
  ],
  Onkoloji: [
    { id: "onk-1", kind: "ilac", title: "Solid tümörlerde yeni hedefe yönelik ajan faz-2 verisi", source: "ASCO", summary: "Belirli mutasyon taşıyan hastalarda yanıt oranları umut verici bulundu.", date: "2026-06-22" },
    { id: "onk-2", kind: "makale", title: "Likit biyopsi ile erken nüks tespiti", source: "Nature Medicine", summary: "ctDNA temelli izlem, görüntülemeden önce nüksü öngörmede değerlendirildi.", date: "2026-06-17" },
  ],
  Ortopedi: [
    { id: "ort-1", kind: "makale", title: "Diz protezinde robotik asistans uzun dönem sonuçları", source: "JBJS", summary: "Robotik destekli artroplastide revizyon oranları geleneksel yöntemle kıyaslandı.", date: "2026-06-21" },
  ],
  Nöroloji: [
    { id: "nor-1", kind: "ilac", title: "Migren profilaksisinde anti-CGRP gerçek-dünya etkinliği", source: "Neurology", summary: "Aylık enjeksiyon tedavisinde atak sıklığında azalma raporlandı.", date: "2026-06-20" },
  ],
};

// Doktorun branşına göre haber akışı: genel gündem + (varsa) branşa özel kartlar.
// ⚠️ STUB (örnek içerik) — canlı yayın akışı için fetchBranchNews() kullan.
export function newsForBranch(branch: string | null | undefined): NewsItem[] {
  const branchItems = branch && BY_BRANCH[branch] ? BY_BRANCH[branch] : [];
  return [...branchItems, ...GENERAL];
}

// ─────────────────────────────────────────────────────────────────────────────
// (A) CANLI KATMAN — PubMed E-utilities
// ─────────────────────────────────────────────────────────────────────────────

const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const REVALIDATE = 3600; // 1 saat — Next fetch cache (NCBI'ya nazik + sayfa hızlı)
const RELDATE_DAYS = 365; // son 1 yıl
const PER_BRANCH = 4;
const PER_GENERAL = 3;
// Çeviri BÜTÇESİ: AI çevirisi sayfayı bloke etmesin. Süre aşılırsa özgün (İngilizce) metin gösterilir;
// arka planda süren çağrı Translation tablosunu doldurmaya devam eder → sonraki ziyaret Türkçe görür.
// (Ölçüm 2026-08-01: soğuk yolda 9 kalemin tam çevirisi ~25 sn sürüyordu — kabul edilemez.)
const TRANSLATE_BUDGET_MS = 6000;

// Branş etiketi → PubMed MeSH sorgusu. Etiketler lib/triage BRANCHES ile birebir.
// Eşleşmeyen branş = yalnız genel akış (uydurma sorgu YAZILMAZ — yanlış literatür göstermek
// hiç göstermemekten kötüdür). Yeni branş eklemek = buraya bir MeSH satırı eklemek.
// ⚠️ Anahtarlar lib/triage BRANCHES etiketleriyle BİREBİR olmalı — bir harf sapması sessizce
//    "bu branş kapsanmıyor" davranışına düşürür. tests/unit/medical-news.test.ts bunu kilitler.
export const NEWS_QUERIES: Record<string, string> = {
  Onkoloji: "neoplasms[mh] AND (therapy[sh] OR diagnosis[sh])",
  "Radyasyon Onkolojisi": "radiotherapy[mh] AND neoplasms[mh]",
  Kardiyoloji: "cardiovascular diseases[mh] AND (therapy[sh] OR diagnosis[sh])",
  "Kalp ve Damar Cerrahisi": "cardiac surgical procedures[mh] OR vascular surgical procedures[mh]",
  Ortopedi: "orthopedic procedures[mh] OR musculoskeletal diseases[mh]",
  Nöroloji: "nervous system diseases[mh] AND (therapy[sh] OR diagnosis[sh])",
  Nöroşirürji: "neurosurgical procedures[mh]",
  "Dahiliye (İç Hastalıkları)": "internal medicine[mh]",
  "Dermatoloji (Cilt Hastalıkları)": "skin diseases[mh]",
  "Göz Cerrahisi": "eye diseases[mh] AND (surgery[sh] OR therapy[sh])",
  "Kulak Burun Boğaz (KBB)": "otorhinolaryngologic diseases[mh]",
  Üroloji: "urologic diseases[mh]",
  "Kadın Hastalıkları ve Doğum": "genital diseases, female[mh] OR pregnancy complications[mh]",
  "Tüp Bebek (IVF)": "fertilization in vitro[mh] OR infertility[mh]",
  "Çocuk Sağlığı ve Hastalıkları": "pediatrics[mh]",
  "Genel Cerrahi": "general surgery[mh]",
  "Göğüs Cerrahisi": "thoracic surgical procedures[mh]",
  "Estetik Cerrahi": "surgery, plastic[mh]",
  "Saç Ekimi": "hair diseases[mh] OR alopecia[mh]",
  "Endokrinoloji ve Metabolizma": "endocrine system diseases[mh] OR metabolic diseases[mh]",
  Gastroenteroloji: "gastrointestinal diseases[mh]",
  Nefroloji: "kidney diseases[mh]",
  "Göğüs Hastalıkları": "respiratory tract diseases[mh]",
  Romatoloji: "rheumatic diseases[mh]",
  Hematoloji: "hematologic diseases[mh]",
  "Enfeksiyon Hastalıkları": "communicable diseases[mh]",
  Psikiyatri: "mental disorders[mh]",
  "Fiziksel Tıp ve Rehabilitasyon": "physical therapy modalities[mh] OR rehabilitation[mh]",
  "Diş Tedavisi": "stomatognathic diseases[mh] OR dentistry[mh]",
  "Organ Nakli": "organ transplantation[mh]",
};

// Genel tıp gündemi — branştan bağımsız, yüksek etkili dergiler.
const GENERAL_QUERY =
  '(telemedicine[mh] OR "digital health"[tiab] OR health policy[mh]) AND hasabstract';

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
    const res = await fetch(`${EUTILS}/${path}?${qs}`, { next: { revalidate: REVALIDATE } });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn("[news] PubMed erişilemedi:", e instanceof Error ? e.message : e);
    return null;
  }
}

// Yayın tipinden kart türü: klinik çalışma/ilaç denemesi → "ilac", diğer yayınlar → "makale".
function kindFromPubtype(pubtype?: string[]): NewsKind {
  const t = (pubtype ?? []).join(" ").toLowerCase();
  if (t.includes("clinical trial") || t.includes("randomized")) return "ilac";
  return "makale";
}

function authorLine(authors?: { name: string }[]): string | null {
  if (!authors?.length) return null;
  const names = authors.slice(0, 3).map((a) => a.name);
  return authors.length > 3 ? `${names.join(", ")}, ve ark.` : names.join(", ");
}

// PubMed pubdate biçimleri: "2026 Jul 15" · "2026 Jul" · "2026". ISO'ya indir (gün yoksa ayın 1'i).
const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};
function isoDate(pubdate?: string, sortpubdate?: string): string {
  if (sortpubdate) {
    const m = /^(\d{4})\/(\d{2})\/(\d{2})/.exec(sortpubdate);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  const p = (pubdate ?? "").trim().split(/\s+/);
  const y = /^\d{4}$/.test(p[0] ?? "") ? p[0] : null;
  if (!y) return "";
  const mo = MONTHS[(p[1] ?? "").slice(0, 3).toLowerCase()] ?? "01";
  const d = /^\d{1,2}$/.test(p[2] ?? "") ? (p[2] as string).padStart(2, "0") : "01";
  return `${y}-${mo}-${d}`;
}

// Özet: efetch XML'inden ilk AbstractText bloğu (esummary abstract vermez). Parser yok — hedefli
// regex + kaçış çözme; başarısızlık = özetsiz kart (akış bozulmaz).
async function fetchAbstracts(ids: string[]): Promise<Record<string, string>> {
  if (!ids.length) return {};
  const qs = new URLSearchParams({ db: "pubmed", id: ids.join(","), rettype: "abstract", retmode: "xml", tool: "aura-health" });
  try {
    const res = await fetch(`${EUTILS}/efetch.fcgi?${qs}`, { next: { revalidate: REVALIDATE } });
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
        .replace(/\s+/g, " ")
        .trim();
      if (text) out[pmid] = text.length > 260 ? `${text.slice(0, 257)}…` : text;
    }
    return out;
  } catch {
    return {};
  }
}

async function fetchQuery(term: string, limit: number, branch: string | null): Promise<NewsItem[]> {
  const search = (await eutils("esearch.fcgi", {
    db: "pubmed", term, retmax: String(limit), sort: "pub_date", datetype: "pdat", reldate: String(RELDATE_DAYS),
  })) as { esearchresult?: { idlist?: string[] } } | null;
  const ids = search?.esearchresult?.idlist ?? [];
  if (!ids.length) return [];

  const [sum, abstracts] = await Promise.all([
    eutils("esummary.fcgi", { db: "pubmed", id: ids.join(",") }) as Promise<{ result?: Record<string, PubMedSummary> } | null>,
    fetchAbstracts(ids),
  ]);
  const result = sum?.result;
  if (!result) return [];

  const items: NewsItem[] = [];
  for (const id of ids) {
    const r = result[id];
    if (!r?.title) continue;
    const doi = r.articleids?.find((a) => a.idtype === "doi")?.value ?? null;
    items.push({
      id: `pm-${id}`,
      kind: kindFromPubtype(r.pubtype),
      title: r.title.replace(/\s*\.\s*$/, "").replace(/^\[|\]\.?$/g, ""),
      source: r.fulljournalname || r.source || "PubMed",
      summary: abstracts[id] ?? "",
      date: isoDate(r.pubdate, r.sortpubdate),
      url: doi ? `https://doi.org/${doi}` : `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
      doi,
      branch,
      authors: authorLine(r.authors),
    });
  }
  return items;
}

// ── EN→TR çeviri (önbellekli) ──
// Translation tablosu (lang, sourceHash) ile anahtarlanır. `lang: "Türkçe"` + İngilizce kaynak
// çakışmaz: getTranslations Türkçe hedefte erkenden kimlik döndürür, bu satırları hiç sorgulamaz.
// ⚠️ Buraya YALNIZ herkese açık literatür metni girer — klinik/PHI metin ASLA (bkz. translateClinical).
const TR = "Türkçe";
function tHash(s: string): string {
  return createHash("sha1").update(s).digest("hex");
}

// Eksik metinleri çevirip önbelleğe yazar. Çağıran bunu BEKLEMEK ZORUNDA DEĞİL: yarıda bırakılsa
// bile yazma tamamlanır (sonraki ziyaret cache'ten okur).
async function translateMissing(missing: string[]): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  // Tek çağrı, numaralı liste: satır sayısı uyuşmazsa çeviriyi TAMAMEN yok say (yanlış eşleşme
  // başlıkları birbirine karıştırırdı — özgün İngilizce göstermek daha dürüst).
  try {
    const numbered = missing.map((s, i) => `${i + 1}. ${s}`).join("\n");
    const out = await translateText(numbered, TR);
    const lines = out.split("\n").map((l) => l.replace(/^\s*\d+\.\s*/, "").trim()).filter(Boolean);
    if (lines.length !== missing.length) throw new Error(`satır uyuşmazlığı: ${lines.length}≠${missing.length}`);
    const data = missing.map((s, i) => ({ lang: TR, sourceHash: tHash(s), source: s, translated: lines[i] }));
    await db.translation.createMany({ data, skipDuplicates: true });
    for (const d of data) map[d.source] = d.translated;
  } catch (e) {
    console.warn("[news] başlık çevirisi atlandı — özgün dilde gösterilecek:", e instanceof Error ? e.message : e);
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

  // Bütçeli bekleme: zamanında dönerse çeviriler bu render'a girer; dönmezse özgün metinle
  // devam edilir (promise arka planda cache'i doldurur — bilinçli "floating promise").
  const work = translateMissing(missing);
  const timed = await Promise.race([
    work,
    new Promise<null>((r) => setTimeout(() => r(null), TRANSLATE_BUDGET_MS)),
  ]);
  if (timed) Object.assign(map, timed);
  else {
    console.warn(`[news] çeviri bütçesi (${TRANSLATE_BUDGET_MS}ms) aşıldı — bu render özgün dilde, önbellek arkada doluyor`);
    void work.catch(() => {});
  }
  return map;
}

export interface BranchNews {
  items: NewsItem[];
  /** true = PubMed'den canlı geldi · false = besleme erişilemedi, örnek içerik gösteriliyor. */
  live: boolean;
  /** Branşa özel sorgu tanımlı mı (yoksa yalnız genel akış gelir). */
  branchCovered: boolean;
}

// Doktorun branşı ÖNDE, ardından genel gündem. Besleme çökerse stub'a düşer (live=false) —
// böylece sayfa asla boş kalmaz ama kullanıcı örnek içeriği gerçek sanmaz.
export async function fetchBranchNews(branch: string | null | undefined): Promise<BranchNews> {
  const term = branch ? NEWS_QUERIES[branch] : undefined;
  const [branchItems, generalItems] = await Promise.all([
    term ? fetchQuery(`(${term}) AND hasabstract`, PER_BRANCH, branch as string) : Promise.resolve([]),
    fetchQuery(GENERAL_QUERY, PER_GENERAL, null),
  ]);
  const items = [...branchItems, ...generalItems];
  if (!items.length) return { items: newsForBranch(branch), live: false, branchCovered: !!term };

  const tx = await translateToTurkish(items.flatMap((i) => [i.title, i.summary].filter(Boolean) as string[]));
  return {
    items: items.map((i) => ({
      ...i,
      title: tx[i.title] ?? i.title,
      titleOriginal: tx[i.title] && tx[i.title] !== i.title ? i.title : null,
      summary: i.summary ? tx[i.summary] ?? i.summary : "",
    })),
    live: true,
    branchCovered: !!term,
  };
}
