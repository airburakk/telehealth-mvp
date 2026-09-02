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
// SECTOR_CATEGORIES aşağıda hem RE-EXPORT edilir (dış çağıranlar için) hem burada parseViewPrefs
// (v6.142) İÇİNDE kullanılır — `export {X} from "Y"` yalnız re-export'tur, bu dosyada X'i yerel
// bir bağlayıcı YAPMAZ (SECTOR_CATEGORIES.some(...) sessizce ReferenceError verip try/catch'e
// düşüyordu — 2026-08-23 birim testinde yakalandı). Ayrı yerel import şart; aşağıdaki
// `export {...} from` satırıyla ÇAKIŞMAZ (o yalnız re-export kaydı, yerel binding yaratmaz).
import { SECTOR_CATEGORIES } from "./doctorium-labels";

export const DOCTORIUM_NAME = "Doctorium";

export type ModuleKey = "akis" | "akademik" | "mevzuat" | "sektorel" | "ilac" | "etkinlik" | "kariyer";

/**
 * v6.120 — "kongre" anahtarı "etkinlik" oldu (kullanıcı kararı 2026-08-19). Eski anahtar
 * yer imlerinde, paylaşılmış bağlantılarda ve bildirim href'lerinde yaşıyor → ?m=kongre
 * SESSİZCE etkinliğe düşer. Kaldırma tarihi yok: maliyeti bir satır, kırık bağlantının
 * maliyeti doktorun boş sayfa görmesi.
 */
export const MODULE_ALIASES: Record<string, ModuleKey> = { kongre: "etkinlik" };

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
// v6.120 (kullanıcı kararı 2026-08-19): "Kongre Takvimi" → "Etkinlik Takvimi" ve Hukuk'un
// aksine İÇ ANAHTAR DA değişti (kongre → etkinlik). Bedeli ödendi: rota taşındı + 308,
// ?m=kongre alias'landı, Doctor.feedModules migration'la göç etti. Gerekçe: modül artık
// gerçekten kongre-dışı türler taşıyor (sempozyum, kurs, kurs-dışı eğitim), anahtarın
// "kongre" kalması kalıcı bir yanlış-adlandırma olurdu.
export const DOCTORIUM_MODULES: ModuleDef[] = [
  { key: "akis", label: "Akışım", desc: "Branşınız + mevzuat + sektör: tek akış" },
  { key: "akademik", label: "Akademik", desc: "Hakemli yayınlar — PubMed · Europe PMC · DOAJ" },
  { key: "sektorel", label: "Sektörel", desc: "Doktor hakları · yönetim · teknoloji · küresel" },
  // 🔒 NİHAİ taksonomi (2026-08-24, kullanıcı — üçüncü ve SON dönüş; v6.146 "Regülasyon" süpersede):
  // kategori adı ÜRÜN-GENELİ "İlaç & Cihaz"; "regülasyon/düzenleyici" yalnız açıklama/içerik türü
  // seviyesinde. Anahtar `ilac` DEĞİŞMEZ. Yeniden adlandırma isteği gelirse bu notu hatırlat.
  { key: "ilac", label: "İlaç & Cihaz", desc: "Geri çekmeler · klinik faz · prospektüs" },
  { key: "etkinlik", label: "Etkinlik Takvimi", desc: "Kongre · sempozyum · kurs — TTB akredite" },
  { key: "kariyer", label: "Kariyer", desc: "Yurt dışı denklik · akademik yükselme" },
  { key: "mevzuat", label: "Hukuk", desc: "Mevzuat · İçtihat — sağlık hukuku" },
];

// ── Etkinlik türleri (v6.120) ───────────────────────────────────────────────
// TTB STE/SMG Akreditasyon-Kredilendirme kaydının taksonomisi. Kaynak ve sayımlar:
// vault `output/ste-kredilendirme-arastirmasi-2026-08-19.md` §5.1 (2024-2026: 461 etkinlik).
//
// Saklanan değer TÜRKÇE SLUG, TTB'nin 3-harfli kodu DEĞİL: bu depoda her enum Türkçe slug
// (ulusal · mevzuat · yuz-yuze) ve `eventType === "SMP"` okunmaz bir yabancı cisim olurdu.
// Kaynak sadakati kaybolmuyor — TTB kodu MedicalCongress.ttbCode'da BİREBİR duruyor.
//
// ⚠️ Tür ADDAN ÇIKARILMAZ. TTB'de "8. Pulmoner Vasküler Hastalıklar Kongresi" SEMPOZYUM
// kayıtlıdır; ad-tabanlı sınıflandırma sessizce yanlış etiketler.
export const EVENT_TYPES = [
  { key: "kongre", label: "Kongre", ttb: "KNG" },
  { key: "sempozyum", label: "Sempozyum", ttb: "SMP" },
  { key: "kurs", label: "Kurs", ttb: "KRS" },
  { key: "egitim", label: "Eğitim", ttb: "EGT" },
  { key: "konferans", label: "Konferans", ttb: "KNF" },
  { key: "calistay", label: "Çalıştay", ttb: "CAL" },
  { key: "seminer", label: "Seminer", ttb: "SMN" },
  { key: "atolye", label: "Atölye Çalışması", ttb: "GRP" },
  { key: "diger", label: "Diğer", ttb: "DGR" },
] as const;
export type EventTypeKey = (typeof EVENT_TYPES)[number]["key"];

const EVENT_TYPE_SET = new Set<string>(EVENT_TYPES.map((t) => t.key));
export const EVENT_TYPE_LABEL: Record<string, string> =
  Object.fromEntries(EVENT_TYPES.map((t) => [t.key, t.label]));
/** TTB kod öneki → slug ("SMP" → "sempozyum"). Ingest bunu kullanır. */
export const EVENT_TYPE_BY_TTB: Record<string, EventTypeKey> =
  Object.fromEntries(EVENT_TYPES.map((t) => [t.ttb, t.key])) as Record<string, EventTypeKey>;

/**
 * Sekme açılışında SEÇİLİ gelen türler (kullanıcı kararı 2026-08-19: "tüm türler + varsayılan
 * süzgeç"). Kurs/eğitim veri setinin en büyük iki kovası (171 + 49) ve çoğu yerel/dar kapsamlı —
 * hepsi açık gelseydi doktorun kongre listesi gürültüde kaybolurdu. Doktor tür çipinden açar.
 */
export const DEFAULT_EVENT_TYPES: EventTypeKey[] = ["kongre", "sempozyum"];

/**
 * ?t= paramından tür seçimi. "hepsi" → null (süzgeç yok). Geçerli tür yoksa VARSAYILANA döner —
 * boş listeye düşürmek doktoru boş sekmeyle baş başa bırakırdı (fail-safe, fail-open değil:
 * burada "açık" olan taraf varsayılan görünüm).
 * ⚠️ ?t= Kariyer modülünde alt-sekme anlamına gelir (parseCareerTab); ikisi farklı modülde
 * yaşadığı için çakışmaz — yeni bir modüle ?t= eklerken bunu hatırla.
 */
export function parseEventTypes(raw?: string | null): EventTypeKey[] | null {
  if (raw === "hepsi") return null;
  if (!raw) return DEFAULT_EVENT_TYPES;
  const picked = raw.split(",").map((s) => s.trim()).filter((s) => EVENT_TYPE_SET.has(s)) as EventTypeKey[];
  return picked.length ? picked : DEFAULT_EVENT_TYPES;
}

/**
 * Kayıtlı etkinlik TÜRÜ tercihi (v6.132 — Doctor.congressEventTypes JSON dizi).
 * null/bozuk = tercih yok → DEFAULT_EVENT_TYPES. "hepsi" = süzgeç kapalı → null.
 * URL parametresi (?t=) tercihi EZER: paylaşılan bağlantı beklendiği gibi açılmalı,
 * ama kalıcı ayarı da değiştirmemeli (yalnız o görünüm için geçerli).
 */
export function parseEventTypePref(raw: string | null | undefined): EventTypeKey[] | null {
  if (!raw) return DEFAULT_EVENT_TYPES;
  if (raw === "hepsi") return null;
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return DEFAULT_EVENT_TYPES;
    const picked = v.filter((s): s is EventTypeKey => typeof s === "string" && EVENT_TYPE_SET.has(s));
    return picked.length ? picked : DEFAULT_EVENT_TYPES;
  } catch {
    return DEFAULT_EVENT_TYPES;
  }
}

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
// v6.99 (2026-08-15): "meslek" ve "kuresel" eklendi — sektörel akış doktorun kendi mesleki
// gündemiyle genişledi (İTO/TTB/Medscape) ve WHO/Medical Xpress içeriği "teknoloji"den ayrıldı.
// Sıra = doktorun ilgi sıklığı varsayımı: kendi mesleği önce, küresel gündem sonda.
// SECTOR_CATEGORIES/categoryLabel istemci-güvenli lib/doctorium-labels.ts'e taşındı (2026-08-21,
// sonsuz kaydırmanın client bileşeninin ArticleCard üzerinden ihtiyaç duyması — o bileşen
// v6.192'de kalktı ama kural sürüyor: buradan değer import etmek bu dosyanın `db` bağımlılığını
// istemci paketine sokar). Tek
// kaynak orada; burası aynı adlarla re-export eder, davranış ve mevcut import'lar değişmez.
export { SECTOR_CATEGORIES, categoryLabel } from "./doctorium-labels";

// ── Sektörel kaynak kapsamı (v6.99.3, kullanıcı isteği 2026-08-16) ──────────
// Özelleştir'de "Kaynak" filtresi: Ulusal (TR kurumları) / Uluslararası. URL paramı ?s=
// (kongre kapsamıyla AYNI değerler — parseScope paylaşılır; farklı sekmede çakışmaz).
// ⚠️ YENİ SEKTÖREL KAYNAK EKLERKEN buraya da ekle — birim test (doctorium-filtreler)
// ingest kaynak setiyle bu iki listenin birleşimini karşılaştırır; unutulan kaynak
// "Tümü"nde görünüp iki filtrede de kaybolurdu (sessiz kayıp).
// v6.129 (2026-08-19): uzmanlık dernekleri eklendi — hepsi ULUSAL (Türkiye dernekleri).
// Kaynak anahtarları lib/association-sources.ts ASSOCIATIONS slug'larıyla AYNI olmalı;
// sözleşme testi (doctorium-filtreler) iki listeyi de hizada tutar.
// 2026-08-24: "sgk" eklendi (GSS GM duyuruları doğrudan kaynaktan — ingestSgkGss).
export const SECTOR_SOURCE_SCOPES: Record<"ulusal" | "uluslararasi", string[]> = {
  ulusal: ["ttb", "ohsad", "sgk", "istabip", "klimik", "tjod", "tatd", "tgd-gastro", "tgcd"],
  uluslararasi: ["who", "medscape", "medicalxpress"],
};

/**
 * Sektörel "Kaynak" süzgeci (v6.99.3) ?s= parametresini Etkinlik kapsamıyla PAYLAŞIR ama
 * değer kümesi AYNI DEĞİL: haber kaynağı ya ulusal ya uluslararasıdır — "uluslararası
 * katılımlı" bir haber kaynağı yoktur (o, etkinliğin nerede/kimlerle yapıldığına dair bir
 * niteliktir). v6.120'de CongressScope üçüncü değeri kazanınca bu ayrım tip hatası olarak
 * yüzeye çıktı; ortak parseScope'u kullanmak SECTOR_SOURCE_SCOPES'ta tanımsız anahtar
 * araması demekti (undefined sources → sessizce süzgeçsiz liste).
 */
export type SourceScope = "ulusal" | "uluslararasi";
export function parseSourceScope(raw?: string | null): SourceScope | null {
  return raw === "ulusal" || raw === "uluslararasi" ? raw : null;
}

// KIND_LABEL de aynı gerekçeyle lib/doctorium-labels.ts'e taşındı (yukarıdaki not).
export { KIND_LABEL } from "./doctorium-labels";

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
  /** v6.99.5 — kaynak anahtarı ("medscape"/"istabip"/"pubmed"…); kaynak-bandı eşlemesi bununla. */
  source: string;
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
  id: string; module: string; kind: string; source: string; title: string; titleOriginal: string | null;
  summary: string; sourceName: string; authors: string | null; url: string | null;
  doi: string | null; publishedAt: Date; branchSlugs: string; aiSummary: string | null;
  category: string | null; imageUrl: string | null;
};

/** PubMed/XML kaynaklarından kalan named ve numeric HTML varlıklarını güvenli düz metne çevirir. */
export function decodeFeedText(value: string): string {
  const codePoint = (match: string, raw: string, radix: number) => {
    const n = Number.parseInt(raw, radix);
    return Number.isInteger(n) && n >= 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff)
      ? String.fromCodePoint(n)
      : match;
  };
  // ⚠️ SIRA YÜK TAŞIR: `&amp;` EN SONDA çözülür. Başta çözülürse tek kademe kodlanmış metin İKİ
  // KADEME çözülür — kaynağın bilinçli olarak kaçırdığı dizi kaybolur: "&amp;#x2009;" önce
  // "&#x2009;" olur, sonra alttaki sayısal kural onu ince boşluğa çevirirdi (doğrusu: düz metin
  // olarak "&#x2009;" kalmalı). Aynı tuzak "&amp;lt;script&amp;gt;" → "<script>" üretiyordu.
  // Sona alındığında ara sonuçta "&" hiç oluşmadığı için sonraki kurallar onu yakalayamaz.
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x([0-9a-f]+);/gi, (match, hex: string) => codePoint(match, hex, 16))
    .replace(/&#(\d+);/g, (match, decimal: string) => codePoint(match, decimal, 10))
    .replace(/&amp;/gi, "&");
}

function toFeedItem(r: Row): FeedItem {
  let slugs: string[] = [];
  try {
    const v = JSON.parse(r.branchSlugs);
    if (Array.isArray(v)) slugs = v.filter((s): s is string => typeof s === "string");
  } catch { /* bozuk JSON = branşsız göster */ }
  return {
    ...r,
    title: decodeFeedText(r.title),
    titleOriginal: r.titleOriginal ? decodeFeedText(r.titleOriginal) : null,
    summary: decodeFeedText(r.summary),
    branchSlugs: slugs,
    hasAiSummary: !!r.aiSummary,
  };
}

const ROW_SELECT = {
  id: true, module: true, kind: true, source: true, title: true, titleOriginal: true, summary: true,
  sourceName: true, authors: true, url: true, doi: true, publishedAt: true,
  branchSlugs: true, aiSummary: true, category: true, imageUrl: true,
} as const;

/**
 * Akış Tercihleri (Faz 2, 2026-08-14): Akışım'a hangi BÖLÜMLER girsin. Doctor.feedModules'ta
 * JSON string[] saklanır; null/boş = TÜMÜ (tercihe hiç girmemiş doktor her bölümü görür).
 * etkinlik/kariyer FeedItem değildir — seçiliyse page akışın üstünde mini blok olarak gösterir.
 *
 * 🪤 Burası FAIL-OPEN: tanınmayan anahtar sessizce ATILIR. Bir anahtarı yeniden adlandırırken
 * migration'la eski değeri GÖÇÜR, yoksa o bölümü seçmiş doktorlar onu hatasız kaybeder
 * (v6.120'de kongre → etkinlik böyle taşındı: 20260819140000_etkinlik_turu_ve_modul_anahtari).
 */
/**
 * Akışa hangi bölümlerin gireceği (Doctor.feedModules — JSON dizi, ŞEMA DEĞİŞMEZ).
 *
 * v6.132 (2026-08-20): Hukuk ÜÇE ayrıldı — tercihler sayfası mevzuat/içtihat/doktrini ayrı
 * alt sekme olarak sunuyor ve doktor üçünü bağımsız açıp kapatabiliyor. Yeni anahtarlar
 * `hukuk-*` önekli; ESKİ tek "mevzuat" anahtarı yalnız OKUNUR (yazılmaz) ve üçüne genişletilir
 * — yoksa mevcut tercihi ["mevzuat"] olan doktorlar içtihat ve doktrini sessizce kaybederdi.
 */
export const FEED_MODULE_OPTIONS = [
  { key: "akademik", label: "Akademik" },
  { key: "sektorel", label: "Sektörel" },
  { key: "ilac", label: "İlaç & Cihaz" },
  { key: "etkinlik", label: "Etkinlik" },
  { key: "kariyer", label: "Kariyer" },
  { key: "hukuk-mevzuat", label: "Mevzuat" },
  { key: "hukuk-ictihat", label: "İçtihat" },
  { key: "hukuk-doktrin", label: "Doktrin" },
] as const;
export type FeedModuleKey = (typeof FEED_MODULE_OPTIONS)[number]["key"];
const FEED_MODULE_KEYS = new Set(FEED_MODULE_OPTIONS.map((o) => o.key));
/** v6.132 ve öncesinde Hukuk tek anahtardı; okurken üç alt anahtara genişletilir. */
const LEGACY_LEGAL_KEY = "mevzuat";
const LEGAL_KEYS: FeedModuleKey[] = ["hukuk-mevzuat", "hukuk-ictihat", "hukuk-doktrin"];

/**
 * TERCİHLER TAKSONOMİSİ (v6.132, kullanıcı kararı 2026-08-20).
 *
 * Klinik/Mesleki ayrımı akış SÜZGECİ olmaktan çıkıp tercihler sayfasının omurgası oldu:
 * taksonomi içeriği bölmüyor, AYARLARI örgütlüyor. Sol tarafta ikili ayrım, sağında üçer
 * bölüm, Hukuk'un altında üç alt sekme.
 *
 * `feedKey` null ise bölümün kendisi tek anahtarla açılıp kapanmaz (Hukuk gibi — alt
 * sekmelerinin kendi anahtarları var).
 */
export const PREF_GROUPS = [
  {
    key: "klinik",
    label: "Klinik",
    desc: "Hasta başındaki işinizi besleyen bilgi.",
    sections: [
      { key: "akademik", label: "Akademik", feedKey: "akademik" as FeedModuleKey,
        desc: "PubMed, Europe PMC ve DOAJ'dan hakemli yayınlar.", subs: null },
      { key: "sektorel", label: "Sektörel", feedKey: "sektorel" as FeedModuleKey,
        desc: "Doktor hakları, yönetim, teknoloji ve küresel gündem.", subs: null },
      { key: "ilac", label: "İlaç & Cihaz", feedKey: "ilac" as FeedModuleKey,
        desc: "Ruhsat, geri çekme ve klinik faz duyuruları.", subs: null },
    ],
  },
  {
    key: "mesleki",
    label: "Mesleki",
    desc: "Mesleğinizi çevreleyen çerçeve.",
    sections: [
      { key: "hukuk", label: "Hukuk", feedKey: null,
        desc: "Mevzuat değişiklikleri, emsal kararlar ve hakemli doktrin.",
        subs: [
          { key: "hukuk-mevzuat" as FeedModuleKey, label: "Mevzuat", desc: "Resmî Gazete ve OHSAD kayıtları." },
          { key: "hukuk-ictihat" as FeedModuleKey, label: "İçtihat", desc: "Yargıtay kararları arşivi." },
          { key: "hukuk-doktrin" as FeedModuleKey, label: "Doktrin", desc: "TR-Dizin hakemli hukuk makaleleri." },
        ] },
      { key: "etkinlik", label: "Etkinlik", feedKey: "etkinlik" as FeedModuleKey,
        desc: "Kongre, sempozyum ve kurslar; bildiri ve kayıt tarihleri.", subs: null },
      { key: "kariyer", label: "Kariyer", feedKey: "kariyer" as FeedModuleKey,
        desc: "Yurt dışı denklik ve akademik yükselme süreçleri.", subs: null },
    ],
  },
] as const;

/** Ham JSON'dan geçerli bölüm anahtarları; [] = tümü (bozuk/boş değer daraltma YARATMAZ — fail-open). */
export function parseFeedModules(raw: string | null | undefined): FeedModuleKey[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    const out = v.filter(
      (s): s is FeedModuleKey => typeof s === "string" && FEED_MODULE_KEYS.has(s as FeedModuleKey)
    );
    // Geriye uyum: eski tek "mevzuat" seçimi üç alt bölümün hepsini kapsıyordu.
    if (v.includes(LEGACY_LEGAL_KEY)) {
      for (const k of LEGAL_KEYS) if (!out.includes(k)) out.push(k);
    }
    return out;
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
  url: true, createdAt: true, scope: true, eventType: true,
} as const;

function congressToFeedItem(c: {
  id: string; title: string; organizer: string | null; city: string | null;
  startDate: Date; endDate: Date | null; url: string | null; createdAt: Date; scope: string;
  eventType: string;
}): FeedItem {
  return {
    id: c.id, module: "etkinlik", kind: "etkinlik", source: "etkinlik",
    title: c.title, titleOriginal: null,
    // Tür özetin BAŞINDA: akış kartının rozeti "Etkinlik" der (tek kind), asıl ayrım burada
    // görünür. Bilinmeyen tür slug'ı ham hâliyle basılmaz — etiketi yoksa satır atlanır.
    summary: [
      EVENT_TYPE_LABEL[c.eventType] ?? null,
      `${trDate(c.startDate)}${c.endDate ? ` – ${trDate(c.endDate)}` : ""}`,
      c.city,
      scopeBadge(c.scope),
    ].filter(Boolean).join(" · "),
    sourceName: c.organizer ?? "Etkinlik takvimi", authors: null,
    url: c.url, doi: null, publishedAt: c.createdAt, category: null,
    branchSlugs: [], hasAiSummary: false, imageUrl: null,
  };
}

/** Sonsuz kaydırma cursor'ı — bir sonraki sayfanın "buradan öncesi" sınırı. Yalnız tarih ile
 *  tekilleştirme YETMEZ (gece toplu ingest aynı createdAt/publishedAt'i paylaşabilir); id de
 *  eklenir ki eşit tarihli kayıtlarda ne kayıt tekrarlansın ne de atlansın.
 *  `excludeIds` (2026-08-26 — sektörel resmi-kaynak boost): ilk sayfada normal sıralamanın
 *  DIŞINDAN eklenen kartların ID'leri. Boost edilen eski-tarihli kayıt cursor eşiğinin
 *  GERİSİNDE kalabilir (`at`'ten daha eski) — bu durumda 2. sayfanın normal `publishedAt < at`
 *  sorgusu onu YİNE yakalar (duplicate). `excludeIds` bunu bir sonraki sayfada da hariç tutar;
 *  ondan sonraki sayfalar zaten cursor'ın doğal ilerlemesiyle güvenlidir (aynı kayıt tekil id
 *  olduğundan bir daha karşılaşılmaz), o yüzden yalnız İLK sayfanın cursor'ında taşınır. */
interface FeedCursor { at: Date; id: string; excludeIds?: string[] }

async function congressFeedItems(branchSlugs: string[], take: number, before?: FeedCursor): Promise<FeedItem[]> {
  const rows = await db.medicalCongress.findMany({
    where: {
      // Akışım'daki 3 kartlık etkinlik kotası VARSAYILAN türlerle sınırlı (v6.120): TTB
      // kaydının en büyük kovası kurs (171/461) ve çoğu yerel — süzgeçsiz bırakılsaydı
      // Akışım'ın etkinlik köşesi kurslarla dolar, kongre hiç görünmezdi.
      // Doktor tüm türleri Etkinlik sekmesindeki tür çipinden görür.
      eventType: { in: DEFAULT_EVENT_TYPES },
      ...(branchSlugs.length
        ? { OR: [{ branchSlugs: "[]" }, ...branchSlugs.map((s) => ({ branchSlugs: { contains: `"${s}"` } }))] }
        : {}),
      ...(before ? { AND: [{ OR: [{ createdAt: { lt: before.at } }, { AND: [{ createdAt: before.at }, { id: { lt: before.id } }] }] }] } : {}),
    },
    // İkincil sıralama anahtarı (id) — bkz. personalFeedRaw'daki news() yorum bloğu: yalnız
    // createdAt'e göre sıralamak eşit tarihli satırlarda deterministik değildir, cursor'ın
    // id tie-break'i o zaman gerçek bir sınır olmaktan çıkar (React "duplicate key" hatası
    // canlı DOM'da yakalandı, 2026-08-21).
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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
    id: p.slug, module: "kariyer", kind: "kariyer", source: "kariyer",
    title: p.title, titleOriginal: null,
    summary: p.summary,
    sourceName: p.authority, authors: null,
    url: null, doi: null, publishedAt: p.createdAt, category: null,
    branchSlugs: [], hasAiSummary: false, imageUrl: null,
  };
}

/** Yeni eklenen kariyer süreç rehberleri akış kartı olarak (2026-08-14). id = slug (detay rotası
 *  slug'la çalışır; SavedArticle ilişkisiz düz-id deseninde slug da kimlik olabilir). */
async function careerFeedItems(take: number, before?: FeedCursor): Promise<FeedItem[]> {
  const rows = await db.careerPathway.findMany({
    // FeedItem.id kariyer kartlarında slug'tır (id kolonu değil — bkz. careerToFeedItem: `id:
    // p.slug`), o yüzden cursor tie-break'i de slug üzerinden: depolanan cursor.id ile tutarlı
    // kalmalı. İkincil sıralama anahtarı aynı gerekçeyle (bkz. news()/congressFeedItems yorumu):
    // yalnız createdAt'e göre sıralamak eşit tarihlilerde deterministik değildir.
    where: before
      ? { OR: [{ createdAt: { lt: before.at } }, { AND: [{ createdAt: before.at }, { slug: { lt: before.id } }] }] }
      : undefined,
    orderBy: [{ createdAt: "desc" }, { slug: "desc" }],
    take,
    select: CAREER_FEED_SELECT,
  });
  return rows.map(careerToFeedItem);
}

/**
 * AKIŞ ÇEŞİTLİLİK KURALI (2026-08-18, kullanıcı kararı; 2026-08-28 KAYNAK düzeyine genişledi):
 * aynı modülden art arda en fazla `maxRun`, AYNI ZAMANDA aynı kaynaktan (`item.source`) art
 * arda en fazla `maxSourceRun` kart. Kota sistemi bölümler ARASI dengeyi kurar ama tek tarih
 * sıralaması, aynı güne yığılan içeriği (örn. toplu akademik ingest ya da tek yayıncının o
 * gün attığı çok sayıda haber) yine blok hâlinde dizer — 20 akademik kart ya da modül-limiti
 * İÇİNDE kalan ama hep AYNI KAYNAKTAN 3 "sektörel" kart üst üste gelebilir (canlıda gözlendi,
 * 2026-08-20). Bu geçiş, sırayı MÜMKÜN OLDUĞUNCA koruyarak (kararlı/greedy) kümeyi kırar: iki
 * koşudan biri (modül ya da kaynak) dolunca listenin İLERİSİNDEN, mümkünse o modülü VE o
 * kaynağı BİRDEN kıran ilk kart öne çekilir; öyle bir kart yoksa yalnız modülü kıran karta
 * (modül kuralı önceliklidir, kaynak katmanı onu geçersiz kılmaz), o da yoksa yalnız kaynağı
 * kıran karta düşülür; hiçbiri kalmadıysa koşu serbest bırakılır (yapay boşluk üretilmez —
 * aynı ilke, artık iki eksende). `maxSourceRun` varsayılanı `maxRun`dır; iki
 * mevcut çağıran (personalFeedPage · sonsuz kaydırma) üçüncü parametre geçmediği için davranış
 * SESSİZCE değişmez, yalnız artık kaynak eksenini de kapsar.
 * O(n²) en kötü — akış 40 kart, maliyet önemsiz. Saf fonksiyon (birim test edilir).
 */
export function interleaveByModule(items: FeedItem[], maxRun = 3, maxSourceRun = maxRun): FeedItem[] {
  const out: FeedItem[] = [];
  const rest = [...items];
  while (rest.length) {
    const moduleTail = out.slice(-maxRun);
    const blockedModule = moduleTail.length === maxRun && moduleTail.every((i) => i.module === moduleTail[0].module)
      ? moduleTail[0].module
      : null;
    const sourceTail = out.slice(-maxSourceRun);
    const blockedSource = sourceTail.length === maxSourceRun && sourceTail.every((i) => i.source === sourceTail[0].source)
      ? sourceTail[0].source
      : null;
    let idx = 0;
    if (blockedModule !== null || blockedSource !== null) {
      // Aşamalı arama, TEK "ikisi birden" koşulu DEĞİL: kalan kartların tamamı aynı kaynaktan
      // olabilir (ör. tek yayıncının o günkü toplu ingest'i) — o durumda "modülü VE kaynağı
      // birden kıran kart" hiç yoktur; tek koşullu bir AND bunu -1 döndürüp modül kuralını da
      // SESSİZCE devre dışı bırakırdı (2026-08-28, birim testiyle yakalandı — tüm test
      // fixture'ları tek kaynak kullanıyordu). Modül kuralı 2026-08-18'den beri var ve
      // önceliklidir: kaynak katmanı onu asla geçersiz kılmaz, yalnız üstüne ekler.
      let alt = rest.findIndex((i) => i.module !== blockedModule && i.source !== blockedSource);
      if (alt === -1 && blockedModule !== null) alt = rest.findIndex((i) => i.module !== blockedModule);
      if (alt === -1 && blockedSource !== null) alt = rest.findIndex((i) => i.source !== blockedSource);
      if (alt !== -1) idx = alt;
    }
    out.push(rest.splice(idx, 1)[0]);
  }
  return out;
}

/**
 * Sonsuz kaydırma cursor'ları — modül anahtarı başına "buradan öncesi" işaretçisi. İstemciye
 * JSON olarak gider ve olduğu gibi geri gelir (opak) — bkz. personalFeedPage yorum bloğu.
 *
 * ÜÇ HÂL, İKİ ANLAM DEĞİL (2026-08-21 canlı testte yakalanan hata): bir modülün anahtarı
 * YOK/undefined ile null AYNI ŞEY DEĞİLDİR.
 *   · anahtar YOK  → bu modül henüz hiç sorgulanmadı (yalnız ilk sayfada, cursors={}'ta olur).
 *   · {at, id}     → buradan devam et.
 *   · null         → TÜKENDİ, bir daha ASLA sorgulama.
 * İlk sürüm tükenen modülü cursor listesinden SİLİYORDU (undefined'a geri düşürüyordu) —
 * personalFeedRaw'daki `on()` kapısı yalnız KULLANICI TERCİHİNE bakıyor, cursor'a bakmıyordu,
 * yani "anahtar yok" onun için de "henüz sorgulanmadı" demekti: tükenmiş modül birkaç turda bir
 * BAŞTAN sorgulanıp aynı kartları tekrar tekrar döndürüyordu (React "duplicate key" hatası +
 * DOM'da tekrarlanan href'ler olarak yakalandı). `null` sentinel'i bu iki hâli ayırır.
 */
export type FeedCursors = Partial<Record<FeedModuleKey, { at: string; id: string; excludeIds?: string[] } | null>>;

interface RawModuleResult {
  key: FeedModuleKey;
  items: FeedItem[];
  requested: number;
  /** Boost'lu sorgularda (bkz. sektorelWithOfficialBoost) cursor'ın gerçek "tükendi mi + nereden
   *  devam" bilgisini taşır. Boost edilen kayıtlar `items`'ın SONUNA düşebilir (eski tarihli) ama
   *  ayrı bir "kanaldan" geldikleri için normal akışın ilerlemesini etkilememeli — aksi hâlde
   *  cursor onlara göre kurulur ve 2. sayfa ARADAKİ kayıtları atlar (sessiz veri kaybı, bkz.
   *  personalFeedPage'deki global-cursor uyarısıyla aynı tuzak). Yoksa `items`'ın kendisinden
   *  hesaplanır (eski/varsayılan davranış). */
  cursorAnchor?: { exhausted: boolean; last?: { publishedAt: Date; id: string } };
  /** `FeedCursor.excludeIds` ile aynı kavram — bir sonraki cursor'a AYNEN taşınır (bkz. o
   *  yorum). Yalnız boost'un ilk ürettiği turda DEĞİL, o kayıtların tarihi cursor'ın "geçtiği"
   *  noktaya ulaşana kadar HER sayfada gerekir — `news()` de `before.excludeIds`'i buraya
   *  kopyalayarak zincirler (aksi hâlde yalnız 1 sayfa sonra korumasız kalır ve official kayıt
   *  cursor eşiğini geçtiğinde tekrar görünür — 2026-08-26 canlı testte sayfa 5/15'te yakalandı). */
  excludeIds?: string[];
}

/**
 * Kişisel akış — HAM sorgu katmanı. `personalFeed` (ilk sayfa) ve `personalFeedPage` (sonsuz
 * kaydırma sonraki sayfalar) bu fonksiyonu PAYLAŞIR — mantık tek yerde yaşar, iki çağıran
 * farklı `cursors` girdisiyle aynı sorguları çalıştırır. Modül başına ayrı dizi döner (henüz
 * birleştirilmemiş/interleave edilmemiş) çünkü her modülün "nereden devam" cursor'ı kendi
 * dizisinin SON öğesinden çıkar (bkz. cursorsFrom).
 */
/** Akışım sorgu seçenekleri (2026-08-24): sekme sorgusu (moduleFeed) tercihi uygularken Akışım
 *  uygulamıyordu — "ulusal'a çektim ama akışta uluslararası haber var" (kullanıcı bildirimi).
 *  · sektorelSources: sektörel kaynağı daralt (SECTOR_SOURCE_SCOPES listesi).
 *  · createdSince: "yalnız yeni" (?n=1) — bugün AKIŞA DÜŞEN kayıtlar (createdAt; sayaçla aynı
 *    eksen). Etkinlik/Kariyer bu modda SORGULANMAZ: küratörlü veridir, gece akışı yoktur ve
 *    sayaç (todayModuleCounts) onları hiç saymaz — sayının vaadiyle listenin içeriği örtüşmeli. */
export type PersonalFeedOpts = { sektorelSources?: string[]; createdSince?: Date };

/** Sayaç modül odağı (?fm= — v6.161, kullanıcı bildirimi ÜÇÜNCÜ kez: "rakama tıklayınca yalnız
 *  o içerikleri göreyim, sekmeyi değil"): PulseStrip rakamları artık SEKMEYE değil Akışım'ın
 *  modüle süzülmüş hâline gider. Anahtarlar PulseStrip'in saydığı FeedItem.module uzayı; hukuk
 *  ailesi personalFeed'de ÜÇ ayrı tercih anahtarı olduğundan eşlemeyle açılır. page.tsx + feed
 *  API aynı eşlemeyi kullanır (sonsuz kaydırma sayfa 2+ süzgeci kaybetmesin). */
export const FM_TO_MODULES: Record<string, FeedModuleKey[]> = {
  akademik: ["akademik"],
  sektorel: ["sektorel"],
  ilac: ["ilac"],
  mevzuat: ["hukuk-mevzuat", "hukuk-ictihat", "hukuk-doktrin"],
  etkinlik: ["etkinlik"],
  kariyer: ["kariyer"],
};

/** Sayaç satır etiketleri — PulseStrip (page.tsx) ve /doktor/doctorium/sayac sayfası aynı
 *  sözlükten okur (v6.162; iki kopya sürüklenmesin). Sıra = şeritteki görünüm sırası. */
export const PULSE_LABELS: Record<string, string> = {
  akademik: "makale",
  mevzuat: "hukuk",
  sektorel: "haber",
  ilac: "ilaç ve cihaz",
  etkinlik: "etkinlik",
  kariyer: "rehber",
};

// Resmi/düşük-hacimli ulusal kaynaklar (SGK/TTB/OHSAD) günlük onlarca haber üreten kaynaklarla
// (medicalxpress/medscape) aynı "en yeni N" havuzunda yarışamıyor — 2026-08-26 SGK backfill
// sonrası ölçüldü: 344 kayıtlık sektörel havuzda SGK'nın en yeni kaydı bile #114. sırada, Akışım'ı
// yeniden açan doktor 15 "daha fazla yükle" turu atmadan hiç görmüyordu. Bkz. sektorelWithOfficialBoost.
const OFFICIAL_SEKTOREL_SOURCES = ["sgk", "ttb", "ohsad"];

/**
 * Sektörel kotasının bir kısmını (ilk sayfada, resmi kaynak başına EN FAZLA 1 kart) resmi
 * kaynaklara garantiler — geri kalanı normal "en yeni" sorgusu doldurur. ⚠️ Kaynak-BAŞINA ayrı
 * sorgu şart: tek bir "en yeni N" sorgusuyla üç kaynağı birlikte seçmek, güncelleme sıklığı
 * yüksek olanın (ör. OHSAD) düşük sıklıklı olanı (SGK) her seferinde boost'tan dışlamasına yol
 * açar — 2026-08-26 canlı ölçümde ilk denemede boost hep OHSAD'a düştü, SGK hiç iyileşmedi.
 * Cursor'ı KASITLI OLARAK yalnızca "rest" sorgusundan hesaplar (bkz. RawModuleResult.cursorAnchor
 * yorumu): boost edilen eski-tarihli resmi kayıtlar cursor'ı geriye çekerse, 2. sayfa rest
 * havuzunun ARADAKİ (boost'tan daha yeni ama ilk sayfanın rest kısmından daha eski) kayıtlarını
 * atlardı — sessiz veri kaybı. Bu yüzden yalnızca cursor YOKKEN (ilk sayfa) çağrılır; sonraki
 * turlar normal `news()`'e döner.
 */
async function sektorelWithOfficialBoost(where: object, take: number): Promise<RawModuleResult> {
  const perSource = await Promise.all(
    OFFICIAL_SEKTOREL_SOURCES.map((source) =>
      db.newsArticle.findMany({
        where: { ...where, source },
        orderBy: [{ publishedAt: "desc" }, { id: "desc" }], take: 1, select: ROW_SELECT,
      }),
    ),
  );
  const official = perSource.flat().slice(0, take);
  const officialIds = official.map((r) => r.id);
  const restTake = take - official.length;
  const rest = restTake > 0
    ? await db.newsArticle.findMany({
        where: { ...where, id: { notIn: officialIds } },
        orderBy: [{ publishedAt: "desc" }, { id: "desc" }], take: restTake, select: ROW_SELECT,
      })
    : [];
  const exhausted = rest.length < restTake;
  return {
    key: "sektorel",
    items: [...official, ...rest].map(toFeedItem),
    requested: take,
    cursorAnchor: {
      exhausted,
      last: rest.length ? { publishedAt: rest[rest.length - 1].publishedAt, id: rest[rest.length - 1].id } : undefined,
    },
    // Tükenmediyse sonraki sayfalar gelecek — official'in ID'lerini taşı ki eski-tarihli boost
    // kaydı (cursor eşiğinin gerisinde kalırsa) cursor onu "geçtiğinde" TEKRAR gelmesin (bkz.
    // RawModuleResult.excludeIds). `news()` bunu her sayfada zincirler. Tükendiyse cursor zaten
    // null olacak, taşımaya gerek yok.
    excludeIds: exhausted ? undefined : officialIds,
  };
}

/**
 * Modül kotaları — TOPLAMI SAYFA BOYUDUR (kullanıcı kararı 2026-08-31: "40 mesaj ile sınırla").
 * Sıra = doktorun ilgi sıklığı varsayımı: akademik ağırlıklı, kariyer/kongre ince.
 *
 * ⚠️ Bir kotayı değiştirirsen TOPLAMI KORU — `FEED_QUOTA_TOTAL` sözleşme testiyle 40'a kilitli
 * (tests/unit/doctorium.test.ts). Kota eklemek/artırmak sayfayı sessizce şişirir; ekranda 40'ta
 * KIRPMAK ise çözüm DEĞİL: imleçler çekilen satırlardan türer, gösterilmeyen kalem sonraki
 * sayfada da gelmez — modül-başına imleç mimarisinin önlemek için kurulduğu sessiz veri kaybı.
 */
const FEED_QUOTAS = {
  akademik: 13, sektorel: 7, ilac: 6,
  "hukuk-mevzuat": 4, "hukuk-ictihat": 2, "hukuk-doktrin": 2,
  etkinlik: 3, kariyer: 3,
} as const;

export const FEED_QUOTA_TOTAL: number = Object.values(FEED_QUOTAS).reduce((a, b) => a + b, 0);

async function personalFeedRaw(
  branchSlugs: string[], modules: FeedModuleKey[], limit: number, cursors?: FeedCursors, opts?: PersonalFeedOpts,
): Promise<RawModuleResult[]> {
  const all = modules.length === 0;
  // `cursors[k] === null` = bu modül önceki bir turda tükendi, BİR DAHA SORGULANMAZ (bkz.
  // FeedCursors yorumu). Kullanıcı tercihi (all/modules) bunun ÜSTÜNE değil YANINA eklenir —
  // ikisi de "hayır" derse modül dışarıda kalır.
  const on = (k: FeedModuleKey) => (all || modules.includes(k)) && cursors?.[k] !== null;
  // Kotalar FEED_QUOTAS'tan gelir ve limit=40 tabanına göre ölçeklenir.
  const q = (n: number) => Math.max(1, Math.round((n * limit) / 40));
  const cur = (k: FeedModuleKey): FeedCursor | undefined => {
    const c = cursors?.[k];
    return c ? { at: new Date(c.at), id: c.id, excludeIds: c.excludeIds } : undefined;
  };
  const news = (key: FeedModuleKey, where: object, take: number): Promise<RawModuleResult> => {
    const before = cur(key);
    return db.newsArticle.findMany({
      where: {
        AND: [
          where,
          // "Yalnız yeni" (?n=1): akışa düşme anı — moduleFeed'deki createdSince ile aynı eksen
          // (createdAt, publishedAt DEĞİL; 2019 tarihli karar bu gece ingest edildiyse YENİdir).
          ...(opts?.createdSince ? [{ createdAt: { gte: opts.createdSince } }] : []),
          // İlk sayfada boost edilen kartlar (bkz. FeedCursor.excludeIds) — cursor eşiğinin
          // gerisinde kalsalar bile 2. sayfada TEKRAR gelmesinler.
          ...(before?.excludeIds?.length ? [{ id: { notIn: before.excludeIds } }] : []),
          ...(before
            ? [{ OR: [{ publishedAt: { lt: before.at } }, { AND: [{ publishedAt: before.at }, { id: { lt: before.id } }] }] }]
            : []),
        ],
      },
      // ⚠️ İKİNCİL SIRALAMA ANAHTARI (id) ŞART — canlı DOM'da yakalandı (2026-08-21, React
      // "duplicate key" konsol hatası): yalnız publishedAt'e göre sıralamak, aynı publishedAt'i
      // paylaşan satırlarda (gece toplu ingest'i aynı tarihi verir) VERİTABANI SIRASINI garanti
      // etmez — sayfa 1'in "son satırı" (cursor) her çağrıda farklı bir satır olabilir, cursor'ın
      // id tie-break'i bu belirsizlikle örtüşmeyince aynı satır iki sayfada birden çıkar. id'yi
      // ikincil anahtar yapmak sıralamayı DETERMİNİSTİK kılar; cursor'daki `id: { lt }` şartı
      // artık gerçekten "bu sayfada gösterilmemiş" anlamına gelir.
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }], take, select: ROW_SELECT,
    }).then((r) => ({ key, items: r.map(toFeedItem), requested: take, excludeIds: before?.excludeIds }));
  };

  const jobs: Promise<RawModuleResult>[] = [];
  if (on("akademik"))
    jobs.push(news("akademik",
      branchSlugs.length
        ? { module: "akademik", OR: branchSlugs.map((s) => ({ branchSlugs: { contains: `"${s}"` } })) }
        : { module: "akademik" },
      q(FEED_QUOTAS.akademik),
    ));
  // Kaynak kapsamı tercihi (2026-08-24): sekmedeki "Kaynak: Ulusal/Uluslararası" süzgeci akışa
  // da işler — moduleFeed'deki `source: { in }` ile aynı sözleşme (SECTOR_SOURCE_SCOPES).
  if (on("sektorel")) {
    const sektorelWhere = { module: "sektorel", ...(opts?.sektorelSources?.length ? { source: { in: opts.sektorelSources } } : {}) };
    const sektorelTake = q(FEED_QUOTAS.sektorel);
    // Resmi-kaynak payı (2026-08-26) yalnız İLK sayfada (cursor yok) + "yalnız yeni" modunda
    // DEĞİL (o mod zaten createdAt eksenli, boost anlamsız) + seçili kaynak kapsamı resmi
    // kaynakları dışlamıyorsa uygulanır.
    const officialInScope = !opts?.sektorelSources?.length
      || opts.sektorelSources.some((s) => OFFICIAL_SEKTOREL_SOURCES.includes(s));
    jobs.push(
      !cur("sektorel") && !opts?.createdSince && officialInScope
        ? sektorelWithOfficialBoost(sektorelWhere, sektorelTake)
        : news("sektorel", sektorelWhere, sektorelTake),
    );
  }
  if (on("ilac")) jobs.push(news("ilac", { module: "ilac" }, q(FEED_QUOTAS.ilac)));
  // Hukuk üç bağımsız alt bölüm (v6.132) — doktor tercihler sayfasından üçünü ayrı yönetir.
  if (on("hukuk-mevzuat")) jobs.push(news("hukuk-mevzuat", { module: "mevzuat", kind: "mevzuat" }, q(FEED_QUOTAS["hukuk-mevzuat"])));
  if (on("hukuk-ictihat")) jobs.push(news("hukuk-ictihat", { module: "mevzuat", kind: "ictihat" }, q(FEED_QUOTAS["hukuk-ictihat"])));
  if (on("hukuk-doktrin")) jobs.push(news("hukuk-doktrin", { module: "mevzuat", kind: "doktrin" }, q(FEED_QUOTAS["hukuk-doktrin"])));
  // Etkinlik/Kariyer "yalnız yeni" modunda sorgulanmaz — gerekçe PersonalFeedOpts yorumunda.
  if (on("etkinlik") && !opts?.createdSince)
    jobs.push(congressFeedItems(branchSlugs, q(FEED_QUOTAS.etkinlik), cur("etkinlik")).then((items) => ({ key: "etkinlik", items, requested: q(FEED_QUOTAS.etkinlik) })));
  if (on("kariyer") && !opts?.createdSince)
    jobs.push(careerFeedItems(q(FEED_QUOTAS.kariyer), cur("kariyer")).then((items) => ({ key: "kariyer", items, requested: q(FEED_QUOTAS.kariyer) })));

  return Promise.all(jobs);
}

/** Bu turda SORGULANAN modüllerin yeni cursor'ları. İstenenden AZ döndüren modül tükenmiştir —
 *  `null` yazılır (bkz. FeedCursors: anahtarı SİLMEK "henüz sorgulanmadı"ya geri düşürürdü, bir
 *  sonraki tur o modülü baştan sorgulardı). Bu turda hiç SORGULANMAYAN modüller (zaten önceden
 *  null'lanmış olanlar — `on()` onları jobs'a hiç eklemedi) burada YOKTUR; çağıran (personalFeedPage)
 *  bu sonucu ESKİ cursors'ın ÜSTÜNE yazar ki onların null'ı korunsun. */
function cursorsFrom(raw: RawModuleResult[]): FeedCursors {
  const out: FeedCursors = {};
  for (const r of raw) {
    const exhausted = r.cursorAnchor ? r.cursorAnchor.exhausted || !r.cursorAnchor.last : r.items.length < r.requested;
    if (exhausted) { out[r.key] = null; continue; }
    const last = r.cursorAnchor?.last
      ?? { publishedAt: r.items[r.items.length - 1].publishedAt, id: r.items[r.items.length - 1].id };
    out[r.key] = {
      at: last.publishedAt.toISOString(), id: last.id,
      // `excludeIds` zincirlenir (bkz. RawModuleResult.excludeIds yorumu): boost'un ürettiği
      // eski-tarihli kayıtlar cursor eşiğinin GERİSİNDE kalabildiği sürece HER sayfada taşınmalı,
      // yoksa 1 sayfa sonra korumasız kalıp o kayıt cursor'ı geçtiğinde tekrar görünür.
      ...(r.excludeIds?.length ? { excludeIds: r.excludeIds } : {}),
    };
  }
  return out;
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
  return (await personalFeedPage(branchSlugs, modules, {}, limit)).items;
}

/**
 * Sonsuz kaydırma — sayfa 2 ve sonrası (2026-08-21, kullanıcı bildirimi: "belli sayıda içerikte
 * duruyor, aşağı kaydırma devam etmiyor"). `personalFeed` ile AYNI ham sorgu katmanını
 * (personalFeedRaw) paylaşır, tek fark `cursors` girdisi.
 *
 * ⚠️ Cursor MODÜL BAŞINA — tek/global bir "ekrandaki son kartın tarihi" cursor'ı YANLIŞ olurdu:
 * interleaveByModule çeşitlilik için sırayı karıştırıyor (aynı modülden art arda en fazla 3),
 * yani ekranda görünen SON kart, aslında o sayfada çekilen en eski kayıt olmayabilir — bir modül
 * tükenmeden önce başka bir modülün daha eski kartı öne çekilmiş olabilir. Global cursor
 * kullansaydık bu durumda bir sonraki sayfa öne çekilen o kartın tarihinden devam eder ve
 * ARADA KALAN kayıtları (aynı modülün henüz gösterilmemiş ama cursor'dan daha yeni kartları)
 * asla göstermezdi — sessiz veri kaybı. Modül başına cursor, her modülün kendi "nereden devam"
 * işaretçisini taşıdığı için bu sızıntıyı yapısal olarak imkânsız kılar.
 */
/**
 * Akış sayfalama imleci URL'de taşınır (v6.192 — sonsuz kaydırma yerine sıralı sayfalama).
 * base64url: ham JSON querystring'de hem okunaksız hem kırılgandır (süslü parantez/tırnak
 * yüzdelenir); opak dize aynı zamanda "elle kurcalanacak alan değil" sinyalidir.
 *
 * ⚠️ Değer KULLANICI GİRDİSİDİR (paylaşılan/kırpılmış URL, elle düzenleme): bozuk imleç sayfayı
 * DÜŞÜRMEZ — decode `null` döner, çağıran ilk sayfaya düşer. Uzunluk freni, base64 çözümünü
 * devasa girdiyle meşgul etmeyi engeller.
 */
export function encodeFeedCursor(value: object): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function decodeFeedCursor(raw: string | string[] | undefined | null): Record<string, unknown> | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 4096) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    // Dizi/skaler REDDEDİLİR: hem personalFeedPage (modül→imleç) hem singleBranchFeedPage
    // ({at,id}) NESNE bekler; yanlış biçim sorguya sızarsa hata çalışma anında çıkar.
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export async function personalFeedPage(
  branchSlugs: string[], modules: FeedModuleKey[], cursors: FeedCursors, limit = 40, opts?: PersonalFeedOpts,
): Promise<{ items: FeedItem[]; cursors: FeedCursors; done: boolean }> {
  const raw = await personalFeedRaw(branchSlugs, modules, limit, cursors, opts);
  const merged = raw.flatMap((r) => r.items);
  merged.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
  // Çeşitlilik geçişi (2026-08-18): aynı modülden art arda en fazla 3 kart.
  const items = interleaveByModule(merged, 3);
  // ⚠️ ESKİ cursors'ın ÜSTÜNE yaz, YERİNE değil (2026-08-21 canlı hata — bkz. FeedCursors/
  // cursorsFrom yorumları): bu turda `on()` tarafından zaten dışlanan (önceden null'lanmış)
  // modüller `raw`'da hiç yok — cursorsFrom onlar için bir şey döndürmez. Spread sırası
  // önce eski (null'lar dahil), sonra yeni (bu turda sorgulananların taze durumu) olmalı ki
  // tükenmiş modül canlanıp baştan sorgulanmasın.
  const nextCursors: FeedCursors = { ...cursors, ...cursorsFrom(raw) };
  // "Yalnız yeni" modunda hiç sorgulanmayan Etkinlik/Kariyer AÇIKÇA null'lanır (TÜKENDİ) —
  // yoksa `done` asla true olmaz ve sonsuz kaydırma boş sayfaları sonsuza dek çekerdi
  // ("üç hâl" dersinin devamı: anahtar yok = "henüz sorgulanmadı" diye okunur).
  if (opts?.createdSince) { nextCursors.etkinlik = null; nextCursors.kariyer = null; }
  const allModules: FeedModuleKey[] = modules.length ? modules : FEED_MODULE_OPTIONS.map((o) => o.key);
  const done = allModules.every((k) => nextCursors[k] === null);
  return { items, cursors: nextCursors, done };
}

/**
 * TEK branşa daraltılmış akış (v6.49): doktorun akışındaki branş çipine tıklayınca. Yalnız o branşın
 * yayınları — mevzuat DAHİL EDİLMEZ (kullanıcı bir branşa odaklanmak istiyor; mevzuat gürültü olur).
 */
export async function singleBranchFeed(slug: string, limit = 30): Promise<FeedItem[]> {
  return (await singleBranchFeedPage(slug, limit)).items;
}

/** Sonsuz kaydırma — tek branş görünümü sayfa 2+. Tek sorgu olduğu için (personalFeedPage'in
 *  aksine) modül başına cursor GEREKMEZ: parti tek bir `publishedAt desc` sıralamasından geliyor,
 *  bu partinin gerçek en-eski satırı `rows`un HAM son elemanıdır — interleave sonrası dizide
 *  (ekranda görünen sırada) o satır başka bir yere kaymış olabilir, cursor'ı HAM diziden almak
 *  şart (bkz. personalFeedPage'deki global-cursor uyarısı, aynı tuzağın tek-sorgulu hâli). */
export async function singleBranchFeedPage(
  slug: string, limit = 30, before?: { at: string; id: string },
): Promise<{ items: FeedItem[]; cursor: { at: string; id: string } | null }> {
  const cur = before ? { at: new Date(before.at), id: before.id } : undefined;
  const rows = await db.newsArticle.findMany({
    where: {
      AND: [
        { branchSlugs: { contains: `"${slug}"` } },
        ...(cur
          ? [{ OR: [{ publishedAt: { lt: cur.at } }, { AND: [{ publishedAt: cur.at }, { id: { lt: cur.id } }] }] }]
          : []),
      ],
    },
    // İkincil sıralama anahtarı (id) — bkz. personalFeedRaw'daki news() yorum bloğu: aynı gerekçe.
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: limit,
    select: ROW_SELECT,
  });
  const cursor = rows.length === limit
    ? { at: rows[rows.length - 1].publishedAt.toISOString(), id: rows[rows.length - 1].id }
    : null;
  // Odaklı akış da Akışım yüzeyidir — aynı çeşitlilik kuralı (art arda ≤3 aynı modül).
  return { items: interleaveByModule(rows.map(toFeedItem), 3), cursor };
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

/**
 * Bant nabzı (v6.102 "Nabızlı Kule"): TR günü başından beri akışa DÜŞEN (createdAt — gece cron'un
 * yazdığı an; publishedAt değil, kaynak tarihi eski olabilir) içerik sayısı, modül başına.
 * Tek groupBy — Shell kuran her sayfada koşulur (force-dynamic; tablo küçük, sorgu ucuz).
 * TR = UTC+3 sabit (Türkiye'de DST yok); gece cron ~03:00 TR'de koşar → doktor sabah "bugün
 * N yeni" görür. Kongre/kariyer sayılmaz (küratörlü/statik veri — gece akışı yok).
 */
/**
 * Türkiye gününün başlangıcı (UTC olarak). Nabız sayacı ile "yeni" süzgeci AYNI sınırı
 * kullanmak zorundadır — biri TR gününe, diğeri sunucunun UTC gününe bakarsa sayaç "3 yeni"
 * derken süzgeç boş liste döndürür. Sunucu UTC'de koşar, doktor TR'de yaşar.
 */
export function trDayStart(): Date {
  const TR_OFFSET_MS = 3 * 3_600_000;
  return new Date(Math.floor((Date.now() + TR_OFFSET_MS) / 86_400_000) * 86_400_000 - TR_OFFSET_MS);
}

export async function todayModuleCounts(): Promise<Record<string, number>> {
  const trDayStartUtc = trDayStart();
  const rows = await db.newsArticle.groupBy({
    by: ["module"],
    where: { createdAt: { gte: trDayStartUtc } },
    _count: { _all: true },
  });
  const out: Record<string, number> = {};
  for (const r of rows) out[r.module] = r._count._all;
  return out;
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

// ── Doctorium görünüm süzgeçleri — kalıcı varsayılan (v6.142, kullanıcı kararı 2026-08-23) ──
// Sektörel/İlaç & Cihaz/Mevzuat'ın Kaynak/Geriye-dönük/Kategori süzgeçleri artık Doctor satırında
// kalıcı (Doctor.doctoriumViewPrefs, TEK JSON kolon). Etkinlik türü/kapsamının v6.132'de aldığı
// yolu izler: URL parametresi (?s=/?d=/?c=) tercihi yalnız o GÖRÜNÜM için ezer, kalıcı tercihi
// DEĞİŞTİRMEZ (bkz. page.tsx `sp.d !== undefined ? ... : viewPrefs...`, parseEventTypePref'le
// AYNI sözleşme). Sekme içi "Özelleştir" paneli (DoctoriumFilters.tsx) bu yüzden silindi —
// tek düzenleme yeri /doktor/doctorium/tercihler (PreferencesBoard.tsx).
export interface SectorViewPrefs { source: SourceScope | null; range: string; category: string | null }
export interface PharmaViewPrefs { range: string }
export interface LegalViewPrefs { range: string; category: string | null }
export interface DoctoriumViewPrefs {
  sektorel: SectorViewPrefs;
  ilac: PharmaViewPrefs;
  mevzuat: LegalViewPrefs;
}
const DEFAULT_VIEW_PREFS: DoctoriumViewPrefs = {
  sektorel: { source: null, range: DEFAULT_RANGE, category: null },
  ilac: { range: DEFAULT_RANGE },
  mevzuat: { range: DEFAULT_RANGE, category: null },
};
// <string> ZORUNLU: RANGE_OPTIONS `as const` olduğundan .map(r=>r.key) literal union'ı korur
// (Set<"1"|"7"|"30"|"180"|"365">) — sonra .has(v) çalışma-zamanı string'iyle çağrılınca tsc
// reddeder (route.ts'de build'de yakalandı; vitest tip kontrolü yapmadığından burada kaçmıştı).
const RANGE_KEY_SET = new Set<string>(RANGE_OPTIONS.map((r) => r.key));

/**
 * Saklanan JSON'u güvenle çöz (parseBranchPrefs/parseEventTypePref'le aynı savunma deseni):
 * bozuk/eski/kısmi veri akışı düşürmesin — her alan KENDİ varsayılanına tek tek düşer, tüm
 * nesne birden sıfırlanmaz (ör. sektörel.source bozuksa sektörel.range yine de okunur).
 */
export function parseViewPrefs(raw: string | null | undefined): DoctoriumViewPrefs {
  if (!raw) return DEFAULT_VIEW_PREFS;
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== "object") return DEFAULT_VIEW_PREFS;
    const sek = (v.sektorel ?? {}) as Record<string, unknown>;
    const il = (v.ilac ?? {}) as Record<string, unknown>;
    const mv = (v.mevzuat ?? {}) as Record<string, unknown>;
    return {
      sektorel: {
        source: parseSourceScope(typeof sek.s === "string" ? sek.s : null),
        range: typeof sek.d === "string" && RANGE_KEY_SET.has(sek.d) ? sek.d : DEFAULT_RANGE,
        category: typeof sek.c === "string" && SECTOR_CATEGORIES.some((c) => c.key === sek.c) ? sek.c : null,
      },
      ilac: {
        range: typeof il.d === "string" && RANGE_KEY_SET.has(il.d) ? il.d : DEFAULT_RANGE,
      },
      mevzuat: {
        range: typeof mv.d === "string" && RANGE_KEY_SET.has(mv.d) ? mv.d : DEFAULT_RANGE,
        category: typeof mv.c === "string" && SECTOR_CATEGORIES.some((c) => c.key === mv.c) ? mv.c : null,
      },
    };
  } catch {
    return DEFAULT_VIEW_PREFS;
  }
}

/** Modül akışı (akademik/sektörel). Branş verilirse akademikte süzülür; days verilirse tarih penceresi. */
/** Modül sekmesi listesinin tavanı (moduleFeed varsayılan `limit`). Sayfa bu sabite bakarak arama
 *  sayacında "N+" yazar (v6.203, QA A3) — tavana dayanan liste tam sayı gibi sunulmasın. */
export const MODULE_FEED_LIMIT = 40;

export async function moduleFeed(
  module: "akademik" | "mevzuat" | "sektorel" | "ilac",
  branchSlugs: string[],
  opts: {
    limit?: number; days?: number; category?: string | null; excludeCategories?: string[];
    textContainsAny?: string[]; sources?: string[]; createdSince?: Date; textQuery?: string;
  } = {},
): Promise<FeedItem[]> {
  const { limit = MODULE_FEED_LIMIT, days, category, excludeCategories, textContainsAny, sources, createdSince, textQuery } = opts;
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
  // Serbest metin araması (v6.132 — içtihat arama kutusu): sözlük çiplerinden AYRI ölçüt.
  // Çipler yalnız `summary`de arar (deterministik sözlük deseni); kullanıcının yazdığı sorgu
  // BAŞLIKTA da aranır — "Yargıtay 3. HD" gibi künye bilgisi başlıkta yaşıyor.
  if (textQuery && textQuery.trim().length >= 2) {
    const q = textQuery.trim();
    and.push({
      OR: [
        { title: { contains: q, mode: "insensitive" as const } },
        { summary: { contains: q, mode: "insensitive" as const } },
      ],
    });
  }
  const rows = await db.newsArticle.findMany({
    where: {
      module,
      ...(category ? { category } : {}),
      // v6.99.3 — sektörel "Kaynak" filtresi (ulusal/uluslararası kaynak listesi).
      ...(sources?.length ? { source: { in: sources } } : {}),
      ...(and.length ? { AND: and } : {}),
      ...(days ? { publishedAt: { gte: new Date(Date.now() - days * 86400000) } } : {}),
      // "Yeni" süzgeci (v6.132 — sayaç şeridinden gelinir): AKIŞA DÜŞME anı (createdAt),
      // kaynağın yayım tarihi DEĞİL. İkisi farklı eksendir: 2019 tarihli bir Yargıtay kararı
      // bu gece ingest edilmişse akış için YENİdir. `days` publishedAt'e bakar, bu createdAt'e.
      ...(createdSince ? { createdAt: { gte: createdSince } } : {}),
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

/**
 * Etkinlik listesinin kapsam filtresi (v6.62, kullanıcı isteği).
 * v6.120: TTB kaydı ÜÇ değer kullanıyor → "uluslararasi-katilimli" eklendi (yurt içinde yapılan
 * ama yabancı konuşmacı/katılımcı alan etkinlik; doktor için ikisinin arası bir kategori).
 *
 * 🪤 "Uluslararası" çipi seçiliyken katılımlı olanlar GELMEZ (ayrı değer, ayrı çip) — kullanıcı
 * "yurt dışına gideceğim" derken yurt içi bir toplantıyı listede görmemeli.
 */
export type CongressScope = "ulusal" | "uluslararasi" | "uluslararasi-katilimli";
const SCOPE_SET = new Set<string>(["ulusal", "uluslararasi", "uluslararasi-katilimli"]);

export function parseScope(raw?: string | null): CongressScope | null {
  return raw && SCOPE_SET.has(raw) ? (raw as CongressScope) : null;
}

/** Kapsam rozeti metni — kart, detay ve akış özetinde TEK kaynak (üçü ayrı yazılmasın). */
export function scopeBadge(scope: string): string {
  return scope === "uluslararasi" ? "🌍 Uluslararası"
    : scope === "uluslararasi-katilimli" ? "🌍 Uluslararası katılımlı"
    : "🇹🇷 Ulusal";
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
  opts?: { scope?: CongressScope | null; types?: EventTypeKey[] | null; limit?: number; onlyIds?: string[] },
) {
  const rows = await db.medicalCongress.findMany({
    where: {
      startDate: { gte: new Date(Date.now() - 86400000) }, // bugün başlayan dahil
      ...(opts?.scope ? { scope: opts.scope } : {}),
      // types === null → "hepsi" (süzgeç yok). undefined gelirse de süzmeyiz: çağıran
      // parseEventTypes'tan geçirmediyse daraltma YAPMA — sessiz eksik liste üretmesin.
      ...(opts?.types?.length ? { eventType: { in: opts.types } } : {}),
      // "Takip ettiklerim" yolu (kullanıcı isteği 2026-08-19): yalnız verilen id'ler.
      // ⚠️ Çağıran bu yolda branş/tür/kapsam süzgeci GEÇİRMEZ — doktor branş dışından da
      // takip etmiş olabilir; "takip ettim ama listede yok" sürprizi üretme. Boş dizi
      // bilinçli boş liste döndürür (id: {in: []}).
      ...(opts?.onlyIds ? { id: { in: opts.onlyIds } } : {}),
    },
    orderBy: { startDate: "asc" },
    // AÇIK select: coverImage data URI'ları (~5-20KB/kayıt) liste sorgusunu şişirmesin —
    // kapak yalnız detay sayfasında basılır. Karta yeni alan eklerken buraya da ekle.
    select: {
      id: true, title: true, organizer: true, city: true, country: true,
      startDate: true, endDate: true, abstractDeadline: true, earlyBirdDeadline: true,
      url: true, branchSlugs: true, scope: true, venue: true, warning: true, confidence: true,
      eventType: true, ttbCode: true,
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

/** Verilen id kümesinden YAKLAŞANLARIN sayısı — "Takip ettiklerim (N)" çip sayacı.
 *  Takip kaydı etkinlik geçtikten sonra da durur (CongressFollow silinmez); çip listeyle
 *  aynı sayıyı söylesin diye followed.size DEĞİL bu count kullanılır. */
export async function upcomingCountByIds(ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  return db.medicalCongress.count({
    where: { id: { in: ids }, startDate: { gte: new Date(Date.now() - 86400000) } },
  });
}

/** Tek kongrenin tam kaydı (detay kartı, v6.62). Bulunamazsa null. */
export async function congressById(id: string) {
  return db.medicalCongress.findUnique({ where: { id } });
}

/** Doktor bu kongreyi takip ediyor mu — detay sayfası için tek satırlık sorgu. */
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

/**
 * Liste görünümü için başlıkları TR'ye çevir (özet listede kısaltıldığı için yalnız başlık çevrilir).
 * `titleOriginal` doluysa ingest-time'da (lib/translate-news) ZATEN çevrilmiş demektir — tekrar
 * denemek hem gereksiz LLM çağrısı hem de zaten-Türkçe metni ikinci kez "çevirtme" riski taşır
 * (2026-09-02: canlıda gözlemlendi — backfill'i tamamlanmış bir NEJM başlığı yine de bu yoldan
 * geçip numaralandırma artığı kazanmıştı).
 */
export async function localizeTitles(items: FeedItem[]): Promise<FeedItem[]> {
  const needs = items.filter((i) => i.module === "akademik" && !i.titleOriginal).map((i) => i.title);
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
