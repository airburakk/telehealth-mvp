// Doctorium — sektörel/mevzuat/ilaç kaynak toplayıcıları (v6.50).
//
// KAYNAK MATRİSİ (2026-08-01'de tek tek ÖLÇÜLDÜ — varsayım yok):
//   ✅ Resmî Gazete   — /eskiler/YYYY/MM/YYYYMMDD.htm günlük fihrist. 🪤 ARŞİV windows-1254,
//                       ANA SAYFA utf-8 (ikisi FARKLI kodlama; UTF-8 varsayımı arşivde 93 bozuk
//                       karakter üretip sağlık filtresini tamamen sessizleştiriyordu).
//   ✅ OHSAD          — özel hastaneler derneği; SUT/geri ödeme/mevzuat haberlerini derliyor
//                       ("Sağlık Uygulama Tebliğinde Değişiklik – 29 Haziran 2026" gibi tarihli).
//                       SGK'nın kendi sitesi duyuruları JS ile yüklüyor (statik HTML'de 0 tarih) →
//                       SGK yerine OHSAD aktarımı kullanılır, KAYNAK OHSAD olarak yazılır.
//   ✅ TTB            — doktor özlük hakları/ücret tarifeleri; tarihli liste.
//   ✅ openFDA        — drug/enforcement + device/enforcement (geri çekme) · drug/label (prospektüs).
//                       ⚠️ ABD verisi: Türkiye ruhsatı (KÜB/KT) farklı olabilir → UI'da uyarı ZORUNLU.
//   ✅ ClinicalTrials — /api/v2/studies; faz + durum (lansman/geliştirme takibi).
//   ✅ WHO            — rss-feeds/news-english.xml.
//   ❌ EMA · TİTCK · SGK · AA/İHA — makine-okunur besleme YOK (EMA/TİTCK uçları 404, SGK JS,
//      ajanslar ticari abonelik). Bu kaynaklardan "varmış gibi" içerik ÜRETİLMEZ.
//
// Kazıma kırılgandır: bir kaynak bozulursa 0 kayıtla döner ve cron yanıtında görünür — uydurma
// içerik hiçbir koşulda yazılmaz.
import { db } from "./db";

// v6.57 TEŞHİS (2026-08-03): TR kaynakları (RG/OHSAD/TTB) Vercel fra1'den erişilemiyordu —
// OHSAD 403 = Cloudflare bot koruması (veri-merkezi IP + "AuraHealth/1.0" ekli bot-ish UA +
// tarayıcı başlıkları yok). UA'dan eki çıkarıp gerçekçi Chrome başlıkları eklendi; 15 sn zaman
// aşımı "asıldı mı, reddedildi mi" sorusunu ayrıştırır (redde hızlı döner, kara delik asılır).
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 15_000;

/** Gerçekçi tarayıcı isteği başlıkları. `referer` verilirse alt-sayfa ziyareti gibi görünür. */
function browserHeaders(referer?: string): Record<string, string> {
  return {
    "User-Agent": UA,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
    "sec-ch-ua": '"Chromium";v="126", "Not.A/Brand";v="24", "Google Chrome";v="126"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": referer ? "same-origin" : "none",
    "Upgrade-Insecure-Requests": "1",
    ...(referer ? { Referer: referer } : {}),
  };
}

/**
 * fetch hatasının GERÇEK sebebini metne döker (v6.57). Node fetch ağ hatasında yalnız
 * "fetch failed" der; asıl teşhis (`ECONNREFUSED`/`ETIMEDOUT`/`EPROTO`/sertifika…) `error.cause`
 * zincirindedir — DNS çoklu IP döndürdüyse cause bir AggregateError olur, kodlar bir kat derindedir.
 */
export function describeFetchError(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const bits: string[] = [];
  if (e.name && e.name !== "Error") bits.push(e.name);
  if (e.message) bits.push(e.message);
  const dig = (c: unknown): string[] => {
    if (!c || typeof c !== "object") return [];
    if (c instanceof AggregateError) return c.errors.flatMap(dig);
    const o = c as { name?: string; code?: string | number; syscall?: string; message?: string; cause?: unknown };
    const s = [o.name, o.code, o.syscall, o.message].filter(Boolean).join(" ");
    return [...(s ? [s] : []), ...dig(o.cause)];
  };
  const causes = [...new Set(dig((e as { cause?: unknown }).cause))];
  if (causes.length) bits.push(`← ${causes.join(" ← ")}`);
  return bits.join(" ") || "hata";
}

export type SectorCategory = "mevzuat" | "sut" | "turizm" | "yonetim" | "teknoloji" | "ilac-cihaz";

// Kategori ataması: başlık anahtar kelimeleri. Sıra ÖNEMLİ — ilk eşleşen kazanır (SUT, genel
// "mevzuat"tan önce gelmeli ki "SUT Tebliğinde Değişiklik" mevzuata değil SUT'a düşsün).
const CATEGORY_RULES: { cat: SectorCategory; kw: string[] }[] = [
  { cat: "sut", kw: ["sut", "sağlık uygulama tebliği", "geri ödeme", "fiyatlandırma komisyonu", "katılım payı", "faturalandırma", "sgk", "sosyal güvenlik"] },
  { cat: "turizm", kw: ["sağlık turizmi", "uluslararası hasta", "turizm teşvik", "hizmet ihracat", "akreditas"] },
  // ⚠️ "ruhsat" TEK BAŞINA YAZILMAZ: "Petrol Arama Ruhsatnamesi" de eşleşiyordu (2026-08-01'de
  //    ölçüldü) → yalnız ruhsatLANDIRMA (beşeri tıbbi ürün bağlamı).
  { cat: "ilac-cihaz", kw: ["ilaç", "tıbbi cihaz", "titck", "prospektüs", "ruhsatlandır", "eczane", "eczacı", "aşı", "biyosidal", "beşeri tıbbi"] },
  { cat: "teknoloji", kw: ["yapay zekâ", "yapay zeka", "dijital sağlık", "e-nabız", "teletıp", "tele-tıp", "giyilebilir", "veri güvenliği", "kişisel sağlık verileri", "kvkk"] },
  { cat: "yonetim", kw: ["hekim hak", "özlük", "ücret tarife", "hakediş", "asistan hekim", "özel hastane", "tıp merkezi", "tıpta uzmanlık", "sağlık kuruluş"] },
  { cat: "mevzuat", kw: ["yönetmelik", "tebliğ", "kanun", "karar", "genelge", "malpraktis", "mahkeme"] },
];

// Türkçe SONDAN eklemeli: kök başta, ekler sonda. Bu yüzden anahtar kelime KELİME BAŞINDA
// aranır — aksi halde "aşı" (vaccine) "t·aşı·ma" ve "t·aşı·nmazların" içinde eşleşiyordu
// (2026-08-01: BOTAŞ petrol taşıma ve enerji iletim hattı ilanları ilaç kategorisine düşmüştü).
const TR_LETTER = "a-zçğıöşü";
const boundaryCache = new Map<string, RegExp>();
function matchesKeyword(text: string, kw: string): boolean {
  let re = boundaryCache.get(kw);
  if (!re) {
    // Anahtar kelimeler kod-sabiti (harf/boşluk/tire) ama ileride regex metakarakteri
    // eklenirse sessizce bozulmasın diye kaçırılır.
    const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    re = new RegExp(`(^|[^${TR_LETTER}])${esc}`, "u");
    boundaryCache.set(kw, re);
  }
  return re.test(text);
}

// İnsan sağlığını ilgilendirmeyen alanlar — sağlık kelimesi geçse bile DIŞLANIR
// (veteriner/gıda/bitki sağlığı ve enerji-maden ilanları).
const EXCLUDE = ["veteriner", "hayvan", "gıda", "bitki", "petrol", "enerji iletim", "maden"];

export function categorize(title: string): SectorCategory | null {
  const t = title.toLocaleLowerCase("tr-TR");
  for (const r of CATEGORY_RULES) if (r.kw.some((k) => matchesKeyword(t, k))) return r.cat;
  return null;
}

// Sağlıkla ilgililik süzgeci (Resmî Gazete gibi karışık kaynaklar için). Geniş tutuldu:
// yanlış-pozitif (alakasız tebliğ) kabul edilebilir, yanlış-negatif (kaçan SUT değişikliği) değil.
const HEALTH_KEYWORDS = [
  "sağlık", "sağlik", "tıbbi", "tibbi", "tıp", "hekim", "doktor", "hasta", "hastane", "eczane",
  "eczacı", "ilaç", "ilac", "sgk", "sosyal güvenlik", "sut ", "sağlık uygulama", "tedavi",
  "ambulans", "tabip", "diş hekim", "hemşire", "medikal", "titck", "biyosidal", "aşı",
  "sağlık uygulama tebliği", "tıpta uzmanlık",
  "klinik", "poliklinik", "muayene", "reçete", "recete", "tıbbi cihaz", "tibbi cihaz",
];

export function isHealthRelated(title: string): boolean {
  const t = title.toLocaleLowerCase("tr-TR");
  if (EXCLUDE.some((k) => matchesKeyword(t, k))) return false;
  return HEALTH_KEYWORDS.some((k) => matchesKeyword(t, k));
}

/** HTML metnini düz metne indir (etiket + varlık temizliği). */
function plain(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/\s+/g, " ")
    .trim();
}

/** Tek kayıt yaz (varsa atla). Dönen: yeni mi. */
async function upsertArticle(a: {
  source: string; externalId: string; module: string; category: string | null;
  kind: string; title: string; summary?: string; sourceName: string; url: string | null;
  publishedAt: Date; branchSlugs?: string;
}): Promise<boolean> {
  const exists = await db.newsArticle.findUnique({
    where: { source_externalId: { source: a.source, externalId: a.externalId } },
    select: { id: true },
  });
  if (exists) return false;
  await db.newsArticle.create({
    data: {
      source: a.source, externalId: a.externalId, module: a.module, category: a.category,
      kind: a.kind, title: a.title, summary: a.summary ?? "", sourceName: a.sourceName,
      url: a.url, publishedAt: a.publishedAt, branchSlugs: a.branchSlugs ?? "[]",
    },
  });
  return true;
}

// ── T.C. Resmî Gazete ───────────────────────────────────────────────────────

/** Arşiv (geçmiş gün) fihristi — windows-1254. Dönen: [{title, url, id}]. */
export async function fetchGazetteArchive(date: Date): Promise<{ title: string; url: string; id: string }[]> {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const base = `https://www.resmigazete.gov.tr/eskiler/${y}/${m}/`;
  const res = await fetch(`${base}${y}${m}${d}.htm`, {
    headers: browserHeaders("https://www.resmigazete.gov.tr/"), cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) return [];
  // 🪤 ARŞİV windows-1254: TextDecoder ile açıkça çöz (res.text() UTF-8 varsayar → Türkçe bozulur).
  const buf = await res.arrayBuffer();
  const html = new TextDecoder("windows-1254").decode(buf);

  const out: { title: string; url: string; id: string }[] = [];
  const seen = new Set<string>();
  for (const m2 of html.matchAll(/<a[^>]+href="([^"]+\.(?:htm|pdf))"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = m2[1];
    const title = plain(m2[2]).replace(/^[–—\-]+\s*/, "").trim();
    if (title.length < 15) continue;
    // Aynı güne ait dosya adı (20260716-3.htm) — mutlak/göreli iki biçim de gelir.
    const file = href.split("/").pop() as string;
    if (!/^\d{8}(-\d+)?\.(htm|pdf)$/i.test(file)) continue;
    if (seen.has(file)) continue;
    seen.add(file);
    out.push({ title, url: href.startsWith("http") ? href : `${base}${file}`, id: file });
  }
  return out;
}

/** Bugünün gazetesi (ana sayfa; utf-8 + fihrist-item düzeni). */
export async function fetchGazetteToday(): Promise<{ title: string; url: string; id: string }[]> {
  const res = await fetch("https://www.resmigazete.gov.tr/", {
    headers: browserHeaders(), cache: "no-store", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  // Teşhis görünürlüğü (v6.57): sessizce [] dönmek "0 kayıt tarandı" ile "site reddetti"yi
  // ayırt edilemez kılıyordu — HTTP hatası artık cron raporuna düşer.
  if (!res.ok) throw new Error(`RG HTTP ${res.status}`);
  const html = await res.text();
  const out: { title: string; url: string; id: string }[] = [];
  const seen = new Set<string>();
  for (const block of html.split(/<div class="fihrist-item[^"]*"[^>]*>/).slice(1)) {
    const href = /href="(https:\/\/www\.resmigazete\.gov\.tr\/eskiler\/[^"]+)"/.exec(block)?.[1];
    if (!href) continue;
    const title = plain(block).replace(/^[–—\-]+\s*/, "").slice(0, 400);
    if (title.length < 15) continue;
    const id = href.split("/").pop() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ title, url: href, id });
  }
  return out;
}

function gazetteDate(fileId: string): Date {
  const m = /(\d{4})(\d{2})(\d{2})/.exec(fileId);
  return m ? new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`) : new Date();
}

/** Fihrist kalemlerini süz + yaz. Dönen: [taranan, yeni]. */
export async function ingestGazetteItems(items: { title: string; url: string; id: string }[]): Promise<[number, number]> {
  let created = 0;
  for (const it of items) {
    if (!isHealthRelated(it.title)) continue;
    const cat = categorize(it.title) ?? "mevzuat";
    // Mevzuat kalemleri KENDİ modülünde (v6.50: sektörel haberden ayrıldı).
    const isNew = await upsertArticle({
      source: "resmi-gazete", externalId: it.id, module: "mevzuat", category: cat,
      kind: "mevzuat", title: it.title, sourceName: "T.C. Resmî Gazete",
      url: it.url, publishedAt: gazetteDate(it.id),
    });
    if (isNew) created++;
  }
  return [items.length, created];
}

// ── OHSAD (SUT / geri ödeme / mevzuat aktarımı) ─────────────────────────────

/**
 * OHSAD ana sayfası: "Başlık – 29 Haziran 2026" biçiminde tarihli haber listesi.
 * SGK duyurularının fiilen tek makine-okunur yolu (SGK sitesi JS ile yüklüyor).
 */
export async function ingestOhsad(): Promise<[number, number]> {
  const res = await fetch("https://www.ohsad.org/", {
    headers: browserHeaders(), cache: "no-store", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`OHSAD HTTP ${res.status}`);
  const html = await res.text();

  let scanned = 0;
  let created = 0;
  const seen = new Set<string>();
  for (const m of html.matchAll(/<a[^>]+href="(https?:\/\/(?:www\.)?ohsad\.org\/[^"]+)"[^>]*>([\s\S]{10,400}?)<\/a>/gi)) {
    const url = m[1];
    const title = plain(m[2]);
    if (title.length < 25 || title.length > 300) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    scanned++;
    if (!isHealthRelated(title)) continue;
    // Başlık sonundaki "– 29 Haziran 2026" tarihini yakala; yoksa bugün.
    const published = parseTurkishDate(title) ?? new Date();
    // URL yolu benzersiz kimlik (slug).
    const id = url.replace(/\/$/, "").split("/").pop() as string;
    // Modül ataması: YALNIZ düzenleme niteliğindeki kalemler (mevzuat/SUT) Mevzuat modülüne girer.
    // Kategorisiz OHSAD haberi (ör. "Sağlık Bakanlığı ile Buluşma") sektörel/yönetim sayılır —
    // varsayılanı "mevzuat" yapmak dernek etkinliklerini mevzuat listesine dolduruyordu (2026-08-01).
    const cat = categorize(title);
    const isLegal = cat === "mevzuat" || cat === "sut";
    const isNew = await upsertArticle({
      source: "ohsad", externalId: id, module: isLegal ? "mevzuat" : "sektorel",
      category: cat ?? "yonetim", kind: isLegal ? "mevzuat" : "haber",
      title: title.replace(/\s*[–-]\s*\d{1,2}\s+\p{L}+\s+\d{4}\s*$/u, "").trim(),
      sourceName: "OHSAD", url, publishedAt: published,
    });
    if (isNew) created++;
  }
  return [scanned, created];
}

// ── TTB (doktor özlük hakları) ───────────────────────────────────────────────

export async function ingestTtb(): Promise<[number, number]> {
  const res = await fetch("https://www.ttb.org.tr/", {
    headers: browserHeaders(), cache: "no-store", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`TTB HTTP ${res.status}`);
  const html = await res.text();

  let scanned = 0;
  let created = 0;
  const seen = new Set<string>();
  for (const m of html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]{20,400}?)<\/a>/gi)) {
    let url = m[1];
    const title = plain(m[2]);
    if (title.length < 25 || title.length > 300) continue;
    if (!url.startsWith("http")) url = `https://www.ttb.org.tr/${url.replace(/^\//, "")}`;
    if (!url.includes("ttb.org.tr")) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    scanned++;
    if (!isHealthRelated(title)) continue;
    const id = url.replace(/\/$/, "").split("/").pop() as string;
    const isNew = await upsertArticle({
      source: "ttb", externalId: id.slice(0, 180), module: "sektorel",
      category: categorize(title) ?? "yonetim", kind: "haber",
      title, sourceName: "Türk Tabipleri Birliği", url, publishedAt: new Date(),
    });
    if (isNew) created++;
  }
  return [scanned, created];
}

const TR_MONTHS: Record<string, string> = {
  ocak: "01", şubat: "02", subat: "02", mart: "03", nisan: "04", mayıs: "05", mayis: "05",
  haziran: "06", temmuz: "07", ağustos: "08", agustos: "08", eylül: "09", eylul: "09",
  ekim: "10", kasım: "11", kasim: "11", aralık: "12", aralik: "12",
};

/** "… – 29 Haziran 2026" veya "01.07.2026" → Date. Bulunamazsa null. */
export function parseTurkishDate(text: string): Date | null {
  const num = /(\d{2})[./](\d{2})[./](\d{4})/.exec(text);
  if (num) return new Date(`${num[3]}-${num[2]}-${num[1]}T00:00:00Z`);
  const tr = /(\d{1,2})\s+(\p{L}+)\s+(\d{4})/u.exec(text);
  if (tr) {
    const mo = TR_MONTHS[tr[2].toLocaleLowerCase("tr-TR")];
    if (mo) return new Date(`${tr[3]}-${mo}-${tr[1].padStart(2, "0")}T00:00:00Z`);
  }
  return null;
}

// ── openFDA: geri çekme uyarıları (ilaç + cihaz) ────────────────────────────

interface FdaRecall {
  recall_number?: string;
  report_date?: string;
  classification?: string;
  product_description?: string;
  reason_for_recall?: string;
  recalling_firm?: string;
}

async function ingestFdaEndpoint(kind: "drug" | "device", limit: number): Promise<[number, number]> {
  const url = `https://api.fda.gov/${kind}/enforcement.json?limit=${limit}&sort=report_date:desc`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`openFDA ${kind} HTTP ${res.status}`);
  const j = (await res.json()) as { results?: FdaRecall[] };
  const rows = j.results ?? [];
  let created = 0;
  for (const r of rows) {
    const id = r.recall_number;
    if (!id || !r.product_description) continue;
    const dm = /^(\d{4})(\d{2})(\d{2})$/.exec(r.report_date ?? "");
    const when = dm ? new Date(`${dm[1]}-${dm[2]}-${dm[3]}T00:00:00Z`) : new Date();
    const label = kind === "drug" ? "İlaç" : "Tıbbi cihaz";
    const isNew = await upsertArticle({
      source: `openfda-${kind}`, externalId: id, module: "ilac", category: "ilac-cihaz",
      kind: "uyari",
      title: `${label} geri çekme (${r.classification ?? "sınıf belirtilmemiş"}): ${r.product_description.slice(0, 200)}`,
      summary: [r.reason_for_recall, r.recalling_firm ? `Firma: ${r.recalling_firm}` : null].filter(Boolean).join(" · "),
      sourceName: "openFDA (ABD)",
      url: `https://api.fda.gov/${kind}/enforcement.json?search=recall_number:"${encodeURIComponent(id)}"`,
      publishedAt: when,
    });
    if (isNew) created++;
  }
  return [rows.length, created];
}

export async function ingestFdaRecalls(limit = 10): Promise<[number, number]> {
  const [ds, dn] = await ingestFdaEndpoint("drug", limit);
  const [vs, vn] = await ingestFdaEndpoint("device", limit);
  return [ds + vs, dn + vn];
}

// ── ClinicalTrials.gov: lansman / faz gelişmeleri ───────────────────────────

/** Faz 3/4 ve yeni güncellenen çalışmalar = "lansman" sinyali (ruhsat öncesi son evre). */
export async function ingestTrials(limit = 10): Promise<[number, number]> {
  const params = new URLSearchParams({
    pageSize: String(limit),
    sort: "LastUpdatePostDate:desc",
    "filter.advanced": "AREA[Phase](PHASE3 OR PHASE4)",
  });
  const res = await fetch(`https://clinicaltrials.gov/api/v2/studies?${params}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`ClinicalTrials HTTP ${res.status}`);
  const j = (await res.json()) as {
    studies?: {
      protocolSection?: {
        identificationModule?: { nctId?: string; briefTitle?: string };
        statusModule?: { overallStatus?: string; lastUpdatePostDateStruct?: { date?: string } };
        designModule?: { phases?: string[] };
        descriptionModule?: { briefSummary?: string };
        sponsorCollaboratorsModule?: { leadSponsor?: { name?: string } };
      };
    }[];
  };
  const rows = j.studies ?? [];
  let created = 0;
  for (const s of rows) {
    const p = s.protocolSection;
    const id = p?.identificationModule?.nctId;
    const title = p?.identificationModule?.briefTitle;
    if (!id || !title) continue;
    const dateStr = p?.statusModule?.lastUpdatePostDateStruct?.date;
    const phases = (p?.designModule?.phases ?? []).join("/");
    const sponsor = p?.sponsorCollaboratorsModule?.leadSponsor?.name;
    const isNew = await upsertArticle({
      source: "clinicaltrials", externalId: id, module: "ilac", category: "ilac-cihaz",
      kind: "lansman",
      title: `${phases ? `${phases} · ` : ""}${title.slice(0, 220)}`,
      summary: [(p?.descriptionModule?.briefSummary ?? "").slice(0, 400), sponsor ? `Sponsor: ${sponsor}` : null]
        .filter(Boolean).join(" · "),
      sourceName: "ClinicalTrials.gov",
      url: `https://clinicaltrials.gov/study/${id}`,
      publishedAt: dateStr ? new Date(`${dateStr}T00:00:00Z`) : new Date(),
    });
    if (isNew) created++;
  }
  return [rows.length, created];
}

// ── WHO: küresel sağlık gündemi ─────────────────────────────────────────────

export async function ingestWho(limit = 8): Promise<[number, number]> {
  const res = await fetch("https://www.who.int/rss-feeds/news-english.xml", {
    headers: { "User-Agent": UA }, cache: "no-store",
  });
  if (!res.ok) throw new Error(`WHO HTTP ${res.status}`);
  const xml = await res.text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, limit);
  let created = 0;
  for (const it of items) {
    const b = it[1];
    const pick = (tag: string) => {
      const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(b);
      return m ? plain(m[1].replace(/<!\[CDATA\[|\]\]>/g, "")) : "";
    };
    const title = pick("title");
    const link = pick("link");
    if (!title || !link) continue;
    const pub = pick("pubDate");
    const when = pub ? new Date(pub) : new Date();
    const isNew = await upsertArticle({
      source: "who", externalId: link.slice(-180), module: "sektorel", category: "teknoloji",
      kind: "haber", title: title.slice(0, 300), summary: pick("description").slice(0, 400),
      sourceName: "WHO", url: link,
      publishedAt: Number.isNaN(when.getTime()) ? new Date() : when,
    });
    if (isNew) created++;
  }
  return [items.length, created];
}

// ── Resmî metin çekme (mevzuat özeti için) ──────────────────────────────────

/**
 * Bir mevzuat/haber kaleminin KAYNAK METNİNİ çeker (v6.51).
 * Fihrist yalnız başlık verir; özet için asıl belgeye gitmek gerekir.
 *
 * 🪤 Kodlama: Resmî Gazete /eskiler/ belgeleri windows-1254 (arşiv fihristiyle aynı tuzak;
 *    UTF-8 varsayımı Türkçeyi bozar). Diğer kaynaklar (OHSAD/TTB) utf-8.
 * ⚠️ PDF DESTEKLENMEZ: null döner — çağıran "özet çıkarılamadı" der, UYDURMAZ.
 */
export async function fetchDocumentText(url: string): Promise<string | null> {
  if (/\.pdf($|\?)/i.test(url)) return null; // PDF metin çıkarımı yok (bilinçli)
  try {
    const res = await fetch(url, {
      // Alt-sayfa ziyareti: Referer = kaynağın kendi ana sayfası (bot korumasına doğal görünüm).
      headers: browserHeaders(new URL(url).origin + "/"), cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const isGazetteArchive = /resmigazete\.gov\.tr\/eskiler\//i.test(url);
    const html = new TextDecoder(isGazetteArchive ? "windows-1254" : "utf-8").decode(buf);
    const body = html
      .replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ");
    const text = plain(body)
      // Word/FrontPage artıkları (RG belgeleri Word'den üretiliyor): anlamsız belirteçleri at.
      .replace(/\b(Print|Clean|false|true|MicrosoftInternetExplorer\d*|X-NONE|TR)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.length >= 120 ? text.slice(0, 8000) : null;
  } catch {
    return null;
  }
}
