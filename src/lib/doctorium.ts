// Doctorium — doktor bilgi portalı, OKUMA katmanı (v6.48).
// Yazma/toplama tarafı: lib/doctorium-ingest.ts (günlük bakım cron'u çağırır).
//
// Modüller (kullanıcı kararı 2026-08-01): A akış+tercih · B sektörel/mevzuat · C akademik+AI özet ·
// E kongre takvimi. Modül D (ilaç tanıtımı / e-mümessil) PARK — TİTCK tanıtım yönetmeliği + ruhsat
// sahibi sıfatı hukuki görüş ister (wiki/todo.md Doctorium bloğu).
import { createHash } from "crypto";
import { db } from "./db";
import { translateText, summarizeArticleForClinician, summarizeRegulationForClinician } from "./ai-clinical";
import { fetchDocumentText } from "./doctorium-sources";
import { BRANCHES } from "./triage";

export const DOCTORIUM_NAME = "Doctorium";

export type ModuleKey = "akis" | "akademik" | "mevzuat" | "sektorel" | "ilac" | "kongre" | "kariyer";

export interface ModuleDef {
  key: ModuleKey;
  label: string;
  desc: string;
}

// Sekme sırası = doktorun günlük kullanım sıklığı varsayımı (kişisel akış önce).
// v6.50: "Sektörel & Mevzuat" İKİYE ayrıldı (kullanıcı isteği) + İlaç modülü eklendi.
// Sıra kullanıcı kararı (2026-08-01): Akışım · Akademik · Sektörel · İlaç · Kongre · Mevzuat.
// Mevzuat EN SONDA — günlük okuma sıklığı en düşük, ihtiyaç anında bakılan referans niteliğinde.
// v6.86 (kullanıcı kararı 2026-08-06): modülün kullanıcı-yüzü adı "Hukuk" — altında Mevzuat ·
// İçtihat (· Doktrin, Faz 2) alt-sekmeleri (LEGAL_TABS). İç anahtar "mevzuat" BİLİNÇLİ değişmedi:
// DB'deki module değeri, akış sorguları, ingest'ler ve URL'ler kırılmasın (migration'sız dönüşüm).
export const DOCTORIUM_MODULES: ModuleDef[] = [
  { key: "akis", label: "Akışım", desc: "Branşınız + mevzuat + sektör: tek akış" },
  { key: "akademik", label: "Akademik", desc: "Hakemli yayınlar — PubMed" },
  { key: "sektorel", label: "Sektörel", desc: "Doktor hakları · yönetim · teknoloji · küresel" },
  { key: "ilac", label: "İlaç & Cihaz", desc: "Geri çekmeler · klinik faz · prospektüs" },
  { key: "kongre", label: "Kongre Takvimi", desc: "Ulusal ve uluslararası kongreler" },
  { key: "kariyer", label: "Kariyer", desc: "Yurt dışı denklik · akademik yükselme" },
  { key: "mevzuat", label: "Hukuk", desc: "Mevzuat · İçtihat — sağlık hukuku" },
];

// Hukuk modülü alt-sekmeleri (v6.86). "doktrin" Faz 2'de eklenecek (kullanıcı kararı: DergiPark
// link-modeli + davet-edilen-yazar birlikte) — boş sekme YAYINLANMAZ ("gerçek kaynak yoksa
// içerik yok" ilkesi), o yüzden listede henüz yok.
export const LEGAL_TABS = [
  { key: "mevzuat", label: "Mevzuat" },
  { key: "ictihat", label: "İçtihat" },
  // v6.91 (2026-08-12): Doktrin AÇILDI — fizibilite + gerçek içerik geldi (TR-Dizin,
  // lib/doktrin-ingest.ts). "Boş sekme yayınlanmaz" şartı sağlandı.
  { key: "doktrin", label: "Doktrin" },
] as const;
export type LegalTabKey = (typeof LEGAL_TABS)[number]["key"];

/** ?h= paramı → alt-sekme; bilinmeyen/eksik değer Mevzuat'a düşer (URL kurcalanması akışı bozmaz). */
export function parseLegalTab(raw: string | undefined): LegalTabKey {
  return LEGAL_TABS.some((t) => t.key === raw) ? (raw as LegalTabKey) : "mevzuat";
}

/** Mevzuat alt-sekmesinde İçtihat (ve ileride Doktrin) kayıtları listelenmez. */
export const LEGAL_ONLY_CATEGORIES = ["ictihat", "doktrin"];

// ── Kariyer modülü (v6.89) ──────────────────────────────────────────────────
// Alt-sekmeler LEGAL_TABS desenini izler. "İK Fırsatları" sekmesi BİLİNÇLİ YOK:
// iş ilanı/aracılık İŞKUR özel istihdam bürosu izni ister (üyelik arkasında ilan sunmak
// "iş ve işçi bulmaya aracılık" sayılır) — izin alınınca bu listeye eklenir ve paralel
// oturumun v6.87'de topladığı Doctor.hrContactOptInAt rızası ORADA kullanılır.
// Boş sekme YAYINLANMAZ ilkesi gereği izin gelmeden sekme görünmez (envanter §3).
export const CAREER_TABS = [
  { key: "yurtdisi", label: "Yurt Dışı" },
  { key: "turkiye", label: "Türkiye" },
] as const;
export type CareerTabKey = (typeof CAREER_TABS)[number]["key"];

/**
 * ?t= paramı → alt-sekme; bilinmeyen/eksik değer Yurt Dışı'na düşer (URL kurcalanması akışı bozmaz).
 * ⚠️ `?c=` DEĞİL: o param sektörel kategori filtresine ait (page.tsx `cat`) — çakışırdı.
 */
export function parseCareerTab(raw: string | undefined): CareerTabKey {
  return CAREER_TABS.some((t) => t.key === raw) ? (raw as CareerTabKey) : "yurtdisi";
}

// Sektörel/mevzuat alt kategorileri (v6.50). Kaynak matrisi: mevzuat+sut+ilac-cihaz Resmî Gazete
// ve OHSAD'dan, yonetim TTB/OHSAD'dan, teknoloji WHO/RG'den, turizm RG'den gelir.
// v6.99 (2026-08-15): "meslek" ve "kuresel" eklendi — sektörel akış hekimin kendi mesleki
// gündemiyle genişledi (İTO/TTB/Medscape) ve WHO/Medical Xpress içeriği "teknoloji"den ayrıldı.
// Sıra = doktorun ilgi sıklığı varsayımı: kendi mesleği önce, küresel gündem sonda.
export const SECTOR_CATEGORIES: { key: string; label: string }[] = [
  { key: "meslek", label: "Hekimlik & Mesleki Gündem" },
  { key: "mevzuat", label: "Mevzuat & Sağlık Hukuku" },
  { key: "sut", label: "SGK · SUT & Geri Ödeme" },
  { key: "turizm", label: "Sağlık Turizmi & Teşvikler" },
  { key: "yonetim", label: "Hastane & Klinik Yönetimi" },
  { key: "teknoloji", label: "Sağlık Teknolojileri" },
  { key: "ilac-cihaz", label: "İlaç & Tıbbi Cihaz" },
  { key: "kuresel", label: "Küresel Sağlık Gündemi" },
];
const CAT_LABEL: Record<string, string> = Object.fromEntries(SECTOR_CATEGORIES.map((c) => [c.key, c.label]));
export function categoryLabel(k: string | null | undefined): string | null {
  return k ? CAT_LABEL[k] ?? null : null;
}

// ── Sektörel kaynak kapsamı (v6.99.3, kullanıcı isteği 2026-08-16) ──────────
// Özelleştir'de "Kaynak" filtresi: Ulusal (TR kurumları) / Uluslararası. URL paramı ?s=
// (kongre kapsamıyla AYNI değerler — parseScope paylaşılır; farklı sekmede çakışmaz).
// ⚠️ YENİ SEKTÖREL KAYNAK EKLERKEN buraya da ekle — birim test (doctorium-filtreler)
// ingest kaynak setiyle bu iki listenin birleşimini karşılaştırır; unutulan kaynak
// "Tümü"nde görünüp iki filtrede de kaybolurdu (sessiz kayıp).
export const SECTOR_SOURCE_SCOPES: Record<"ulusal" | "uluslararasi", string[]> = {
  ulusal: ["ttb", "ohsad", "istabip"],
  uluslararasi: ["who", "medscape", "medicalxpress"],
};

export const KIND_LABEL: Record<string, string> = {
  makale: "Makale",
  ilac: "Klinik Çalışma",
  mevzuat: "Mevzuat",
  haber: "Haber",
  uyari: "Geri Çekme",
  lansman: "Klinik Faz",
  ictihat: "İçtihat", // v6.86 — Yargıtay kararları (source: yargitay, lib/hukuk-ingest.ts)
  doktrin: "Doktrin", // v6.91 — TR-Dizin hakemli makaleler (source: trdizin, lib/doktrin-ingest.ts)
  kongre: "Kongre", // 2026-08-14 — akış kartı olarak yeni eklenen kongreler
  kariyer: "Süreç Rehberi", // 2026-08-14 — akış kartı olarak yeni eklenen kariyer kayıtları
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
 * Doktorun akışında kullanılacak branşlar: tercih ettikleri; hiç tercih girmemişse KENDİ branşı
 * (tercih ekranına girmemiş doktor boş akış görmesin). Personelde (doktor profili yok) boş = genel.
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
  category: string | null;
  hasAiSummary: boolean;
  /** v6.99.2 — kaynağın kendi görseli (allowlist'li hotlink); null = üretilmiş kapak. */
  imageUrl: string | null;
}

type Row = {
  id: string; module: string; kind: string; title: string; titleOriginal: string | null;
  summary: string; sourceName: string; authors: string | null; url: string | null;
  doi: string | null; publishedAt: Date; branchSlugs: string; aiSummary: string | null;
  category: string | null; imageUrl: string | null;
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
  branchSlugs: true, aiSummary: true, category: true, imageUrl: true,
} as const;

/**
 * Akış Tercihleri (Faz 2, 2026-08-14): Akışım'a hangi BÖLÜMLER girsin. Doctor.feedModules'ta
 * JSON string[] saklanır; null/boş = TÜMÜ (tercihe hiç girmemiş hekim her bölümü görür).
 * kongre/kariyer FeedItem değildir — seçiliyse page akışın üstünde mini blok olarak gösterir.
 */
export const FEED_MODULE_OPTIONS = [
  { key: "akademik", label: "Akademik" },
  { key: "sektorel", label: "Sektörel" },
  { key: "ilac", label: "İlaç & Cihaz" },
  { key: "kongre", label: "Kongre" },
  { key: "kariyer", label: "Kariyer" },
  { key: "mevzuat", label: "Hukuk" },
] as const;
export type FeedModuleKey = (typeof FEED_MODULE_OPTIONS)[number]["key"];
const FEED_MODULE_KEYS = new Set(FEED_MODULE_OPTIONS.map((o) => o.key));

/** Ham JSON'dan geçerli bölüm anahtarları; [] = tümü (bozuk/boş değer daraltma YARATMAZ — fail-open). */
export function parseFeedModules(raw: string | null | undefined): FeedModuleKey[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.filter((s): s is FeedModuleKey => typeof s === "string" && FEED_MODULE_KEYS.has(s as FeedModuleKey));
  } catch {
    return [];
  }
}

const trDate = (d: Date) =>
  d.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Yeni eklenen kongreler akış kartı olarak (2026-08-14): FeedItem'a dönüşür; akışa giriş
 *  tarihi = createdAt (eklenme — startDate gelecek tarihli olduğundan akışın tepesini işgal ederdi).
 *  Tarih/şehir/kapsam bilgisi summary satırında taşınır. Kaydedilemez (SavedArticle NewsArticle'a bağlı). */
const CONGRESS_FEED_SELECT = {
  id: true, title: true, organizer: true, city: true, startDate: true, endDate: true,
  url: true, createdAt: true, scope: true,
} as const;

function congressToFeedItem(c: {
  id: string; title: string; organizer: string | null; city: string | null;
  startDate: Date; endDate: Date | null; url: string | null; createdAt: Date; scope: string;
}): FeedItem {
  return {
    id: c.id, module: "kongre", kind: "kongre",
    title: c.title, titleOriginal: null,
    summary: [
      `${trDate(c.startDate)}${c.endDate ? ` – ${trDate(c.endDate)}` : ""}`,
      c.city,
      c.scope === "uluslararasi" ? "🌍 Uluslararası" : "🇹🇷 Ulusal",
    ].filter(Boolean).join(" · "),
    sourceName: c.organizer ?? "Kongre takvimi", authors: null,
    url: c.url, doi: null, publishedAt: c.createdAt, category: null,
    branchSlugs: [], hasAiSummary: false, imageUrl: null,
  };
}

async function congressFeedItems(branchSlugs: string[], take: number): Promise<FeedItem[]> {
  const rows = await db.medicalCongress.findMany({
    where: branchSlugs.length
      ? { OR: [{ branchSlugs: "[]" }, ...branchSlugs.map((s) => ({ branchSlugs: { contains: `"${s}"` } }))] }
      : undefined,
    orderBy: { createdAt: "desc" },
    take,
    select: CONGRESS_FEED_SELECT,
  });
  return rows.map(congressToFeedItem);
}

const CAREER_FEED_SELECT = { slug: true, title: true, authority: true, summary: true, createdAt: true } as const;

function careerToFeedItem(p: {
  slug: string; title: string; authority: string; summary: string; createdAt: Date;
}): FeedItem {
  return {
    id: p.slug, module: "kariyer", kind: "kariyer",
    title: p.title, titleOriginal: null,
    summary: p.summary,
    sourceName: p.authority, authors: null,
    url: null, doi: null, publishedAt: p.createdAt, category: null,
    branchSlugs: [], hasAiSummary: false, imageUrl: null,
  };
}

/** Yeni eklenen kariyer süreç rehberleri akış kartı olarak (2026-08-14). id = slug (detay rotası
 *  slug'la çalışır; SavedArticle ilişkisiz düz-id deseninde slug da kimlik olabilir). */
async function careerFeedItems(take: number): Promise<FeedItem[]> {
  const rows = await db.careerPathway.findMany({
    orderBy: { createdAt: "desc" },
    take,
    select: CAREER_FEED_SELECT,
  });
  return rows.map(careerToFeedItem);
}

/**
 * Kişisel akış (Modül A) — BÖLÜM-KOTALI KARIŞIM (2026-08-14, kullanıcı bildirimi): eski tek
 * "en yeni N" sorgusu, yoğun bölümlerin (sektörel haber) seyrek bölümleri tamamen dışarıda
 * bırakıyordu — hukuk (hele ARŞİV tarihli içtihat/doktrin) akışa HİÇ düşmüyordu. Şimdi her
 * seçili bölümden kendi kotası çekilir, tek listede tarihe göre birleşir; arşiv kalemleri
 * doğal olarak dibe yakın düşer ama akışta VAR olur. Kongre/Kariyer de eklenme tarihiyle
 * normal kart olarak girer. `modules` (Akış Tercihleri): boş = tümü.
 * Branş eşleşmesi JSON string içinde tırnaklı arama — yanlış eşleşme olmaz (v6.50 notu).
 */
export async function personalFeed(branchSlugs: string[], limit = 40, modules: FeedModuleKey[] = []): Promise<FeedItem[]> {
  const all = modules.length === 0;
  const on = (k: FeedModuleKey) => all || modules.includes(k);
  // Kotalar limit=40 tabanına göre ölçeklenir (akademik 14 · sektörel 8 · ilaç 6 ·
  // hukuk 4+2+2 [mevzuat/içtihat/doktrin alt-kotaları] · kongre 3 · kariyer 3).
  const q = (n: number) => Math.max(1, Math.round((n * limit) / 40));
  const news = (where: object, take: number) =>
    db.newsArticle.findMany({ where, orderBy: { publishedAt: "desc" }, take, select: ROW_SELECT })
      .then((r) => r.map(toFeedItem));

  const jobs: Promise<FeedItem[]>[] = [];
  if (on("akademik"))
    jobs.push(news(
      branchSlugs.length
        ? { module: "akademik", OR: branchSlugs.map((s) => ({ branchSlugs: { contains: `"${s}"` } })) }
        : { module: "akademik" },
      q(14),
    ));
  if (on("sektorel")) jobs.push(news({ module: "sektorel" }, q(8)));
  if (on("ilac")) jobs.push(news({ module: "ilac" }, q(6)));
  if (on("mevzuat")) {
    jobs.push(news({ module: "mevzuat", kind: "mevzuat" }, q(4)));
    jobs.push(news({ module: "mevzuat", kind: "ictihat" }, q(2)));
    jobs.push(news({ module: "mevzuat", kind: "doktrin" }, q(2)));
  }
  if (on("kongre")) jobs.push(congressFeedItems(branchSlugs, q(3)));
  if (on("kariyer")) jobs.push(careerFeedItems(q(3)));

  const merged = (await Promise.all(jobs)).flat();
  merged.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
  return merged;
}

/**
 * TEK branşa daraltılmış akış (v6.49): doktorun akışındaki branş çipine tıklayınca. Yalnız o branşın
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

/**
 * "Kaydettiklerim" akışı (Faz 2, 2026-08-14): doktorun işaretlediği içerikler, kaydediliş
 * sırasına göre (yeni→eski). ÜÇ KAYNAKLI (2026-08-14, 2. tur): makale/kongre/kariyer — id'ler
 * türsüz saklanır (ilişkisiz düz-id deseni), üç tabloda aranıp birleşir. Kaynak silinmişse
 * kayıt sessizce atlanır (kod-level join, bkz. schema).
 */
export async function savedFeed(doctorId: string, limit = 100): Promise<FeedItem[]> {
  const saved = await db.savedArticle.findMany({
    where: { doctorId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { articleId: true },
  });
  if (!saved.length) return [];
  const ids = saved.map((s) => s.articleId);
  const [articles, congresses, pathways] = await Promise.all([
    db.newsArticle.findMany({ where: { id: { in: ids } }, select: ROW_SELECT }),
    db.medicalCongress.findMany({ where: { id: { in: ids } }, select: CONGRESS_FEED_SELECT }),
    db.careerPathway.findMany({ where: { slug: { in: ids } }, select: CAREER_FEED_SELECT }),
  ]);
  const byId = new Map<string, FeedItem>([
    ...articles.map((r) => [r.id, toFeedItem(r)] as const),
    ...congresses.map((c) => [c.id, congressToFeedItem(c)] as const),
    ...pathways.map((p) => [p.slug, careerToFeedItem(p)] as const),
  ]);
  return saved.map((s) => byId.get(s.articleId)).filter((x): x is FeedItem => !!x);
}

/** Doktorun kayıtlı makale id'leri — kartlardaki kaydet düğmesinin başlangıç durumu. */
export async function savedArticleIds(doctorId: string): Promise<Set<string>> {
  const rows = await db.savedArticle.findMany({ where: { doctorId }, select: { articleId: true } });
  return new Set(rows.map((r) => r.articleId));
}

// Sektörel/mevzuat zaman aralığı (v6.49, kullanıcı isteği): doktor "kaç gün geriye" görmek
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
  module: "akademik" | "mevzuat" | "sektorel" | "ilac",
  branchSlugs: string[],
  opts: { limit?: number; days?: number; category?: string | null; excludeCategories?: string[]; textContainsAny?: string[]; sources?: string[] } = {},
): Promise<FeedItem[]> {
  const { limit = 40, days, category, excludeCategories, textContainsAny, sources } = opts;
  // v6.86/87: iki bağımsız OR ölçütü (kategori-dışlama · metin-arama) AND dizisinde toplanır —
  // spread ile aynı objeye ikinci bir OR anahtarı yazmak öncekini SESSİZCE ezerdi.
  const and: object[] = [];
  // Mevzuat alt-sekmesi içtihat/doktrin kayıtlarını dışlar. `notIn` tek başına NULL kategorili
  // satırları da ELERDİ (Prisma NOT semantiği) → null açıkça korunur.
  if (excludeCategories?.length) {
    and.push({ OR: [{ category: null }, { category: { notIn: excludeCategories } }] });
  }
  // İçtihat anahtar-kelime filtresi (v6.87): sözlük deseni metnin İÇİNDE aranır (deterministik;
  // desenlerden herhangi biri yeter). insensitive → Postgres ILIKE; Türkçe İ/ı katlaması
  // locale'e bağlı olduğundan desenler zaten küçük harfle tutulur (lib/hukuk-keywords.ts).
  if (textContainsAny?.length) {
    and.push({ OR: textContainsAny.map((p) => ({ summary: { contains: p, mode: "insensitive" as const } })) });
  }
  const rows = await db.newsArticle.findMany({
    where: {
      module,
      ...(category ? { category } : {}),
      // v6.99.3 — sektörel "Kaynak" filtresi (ulusal/uluslararası kaynak listesi).
      ...(sources?.length ? { source: { in: sources } } : {}),
      ...(and.length ? { AND: and } : {}),
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

/** "ulusal" | "uluslararasi" — kongre listesinin kapsam filtresi (v6.62, kullanıcı isteği). */
export type CongressScope = "ulusal" | "uluslararasi";

export function parseScope(raw?: string | null): CongressScope | null {
  return raw === "ulusal" || raw === "uluslararasi" ? raw : null;
}

/**
 * Yaklaşan kongreler. Branş süzgeci v6.48'den beri UYGULANIYOR ama v6.62'ye kadar arayüzde
 * GÖRÜNMÜYORDU (Özelleştir panelinde branş bölümü kongre sekmesinde çizilmiyordu) → doktor
 * göremediği bir filtreyle eksik liste görüyordu. Artık panelde de gösteriliyor.
 *
 * 🪤 Limit süzgeçten SONRA uygulanır: önce `take` deseydik, ilk 60 kayıt başka branşlardan
 * doluyken doktorun kendi kongresi listeden düşerdi (sessiz veri kaybı).
 */
export async function upcomingCongresses(
  branchSlugs: string[],
  opts?: { scope?: CongressScope | null; limit?: number },
) {
  const rows = await db.medicalCongress.findMany({
    where: {
      startDate: { gte: new Date(Date.now() - 86400000) }, // bugün başlayan dahil
      ...(opts?.scope ? { scope: opts.scope } : {}),
    },
    orderBy: { startDate: "asc" },
    // AÇIK select: coverImage data URI'ları (~5-20KB/kayıt) liste sorgusunu şişirmesin —
    // kapak yalnız detay sayfasında basılır. Karta yeni alan eklerken buraya da ekle.
    select: {
      id: true, title: true, organizer: true, city: true, country: true,
      startDate: true, endDate: true, abstractDeadline: true, earlyBirdDeadline: true,
      url: true, branchSlugs: true, scope: true, venue: true, warning: true, confidence: true,
    },
  });
  const filtered = !branchSlugs.length
    ? rows
    : // Branşsız (tüm branşlara açık) kongreler herkeste görünür.
      rows.filter((c) => {
        const s = c.branchSlugs || "[]";
        return s === "[]" || branchSlugs.some((b) => s.includes(`"${b}"`));
      });
  return filtered.slice(0, opts?.limit ?? 60);
}

/** Tek kongrenin tam kaydı (detay kartı, v6.62). Bulunamazsa null. */
export async function congressById(id: string) {
  return db.medicalCongress.findUnique({ where: { id } });
}

/** Hekim bu kongreyi takip ediyor mu — detay sayfası için tek satırlık sorgu. */
export async function isFollowingCongress(doctorId: string, congressId: string): Promise<boolean> {
  const row = await db.congressFollow.findUnique({
    where: { doctorId_congressId: { doctorId, congressId } },
    select: { id: true },
  });
  return !!row;
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
 * TEMBEL üretim: yalnız doktor yayını AÇTIĞINDA çalışır → okunmayan ~90 yayın için AI parası ödenmez.
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

// ── Mevzuat / sektörel haber özeti (v6.51) ──────────────────────────────────
//
// Fihrist yalnız BAŞLIK verir → detay sayfası boş görünüyordu (kullanıcı bildirimi 2026-08-01).
// Çözüm iki aşamalı ve TEMBEL (yalnız kalem açıldığında, bir kez; sonra DB'den):
//   1) Kaynak belgenin metni çekilir → NewsArticle.summary'ye yazılır (resmî metin alıntısı)
//   2) O metin AI ile doktor-odaklı özete çevrilir → aiSummary (özet + aksiyon + kimi etkiler)
// PDF kaynakta metin çıkarımı YOK → özet üretilmez, arayüz bunu açıkça söyler (uydurmaz).

export interface RegulationSummary {
  summary: string;
  actions: string[];
  affected: string;
  effective: string;
}

export function parseRegulationSummary(raw: string | null): RegulationSummary | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v.summary !== "string" || !v.summary.trim()) return null;
    return {
      summary: v.summary,
      actions: Array.isArray(v.actions) ? v.actions.filter((s: unknown): s is string => typeof s === "string").slice(0, 3) : [],
      affected: typeof v.affected === "string" ? v.affected : "",
      effective: typeof v.effective === "string" ? v.effective : "",
    };
  } catch {
    return null;
  }
}

export type RegulationResult =
  | { state: "ok"; data: RegulationSummary }
  | { state: "pdf" } // kaynak PDF → metin çıkarılamaz (bilinçli sınır)
  | { state: "unavailable" }; // kaynağa ulaşılamadı / AI kapalı

export async function ensureRegulationSummary(id: string): Promise<RegulationResult> {
  const row = await db.newsArticle.findUnique({
    where: { id },
    select: { aiSummary: true, summary: true, title: true, url: true, module: true },
  });
  if (!row) return { state: "unavailable" };

  const cached = parseRegulationSummary(row.aiSummary);
  if (cached) return { state: "ok", data: cached };
  if (row.url && /\.pdf($|\?)/i.test(row.url)) return { state: "pdf" };
  if (!process.env.ANTHROPIC_API_KEY) return { state: "unavailable" };

  // (1) Kaynak metni: DB'de varsa onu kullan, yoksa çek ve KAYDET (bir kez indirilir).
  let text = row.summary?.trim() ?? "";
  if (text.length < 120) {
    if (!row.url) return { state: "unavailable" };
    const fetched = await fetchDocumentText(row.url);
    if (!fetched) return { state: "unavailable" };
    text = fetched;
    await db.newsArticle.update({ where: { id }, data: { summary: text } });
  }

  // (2) AI özeti
  try {
    const s = await summarizeRegulationForClinician(row.title, text);
    await db.newsArticle.update({ where: { id }, data: { aiSummary: JSON.stringify(s) } });
    return { state: "ok", data: s };
  } catch (e) {
    console.warn("[doctorium] mevzuat özeti üretilemedi:", e instanceof Error ? e.message : e);
    return { state: "unavailable" };
  }
}

// ── Kariyer rehberi sorguları (v6.89) ───────────────────────────────────────
// Küratörlü tablo (CareerPathway); dış API YOK — resmî otorite siteleri makine erişimine kapalı.
// Veri: prisma/seed-data/career-pathways.json + scripts/seed-career-pathways.ts.

/** Süreç adımı — JSON kolonunda saklanır, UI'a çözülmüş gelir. */
export interface CareerStep {
  order: number;
  title: string;
  detail: string;
}

/** Bozuk/eski JSON akışı DÜŞÜRMESİN: çözülemeyen değer boş dizi döner (parseBranchPrefs deseni). */
export function parseSteps(raw: string | null | undefined): CareerStep[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v
      .filter((s): s is CareerStep => !!s && typeof s.title === "string" && typeof s.detail === "string")
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  } catch {
    return [];
  }
}

/** JSON string[] kolonlarını (documents · sourceUrls) güvenle çöz. */
export function parseStringList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Alt-sekme listesi. ⚠️ steps/documents/sourceUrls SELECT EDİLMEZ — kart onları göstermez ve
 * JSON kolonları uzundur (MedicalCongress.coverImage dersi: liste sorgusu ağır alan çekmez).
 */
export async function careerPathways(scope: CareerTabKey) {
  return db.careerPathway.findMany({
    where: { scope },
    orderBy: [{ order: "asc" }, { title: "asc" }],
    select: {
      id: true, slug: true, country: true, title: true, authority: true, summary: true,
      languageReq: true, examReq: true, typicalMonths: true,
      confidence: true, verifiedAt: true, warning: true,
    },
  });
}

/** Detay sayfası — tüm alanlar (steps/documents dahil). Bulunamazsa null → sayfa notFound(). */
export async function careerPathwayBySlug(slug: string) {
  return db.careerPathway.findUnique({ where: { slug } });
}
