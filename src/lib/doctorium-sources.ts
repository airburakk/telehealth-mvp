// Doctorium — sektörel/mevzuat/ilaç kaynak toplayıcıları (v6.50).
//
// KAYNAK MATRİSİ (2026-08-01'de tek tek ÖLÇÜLDÜ — varsayım yok):
//   ✅ Resmî Gazete   — /eskiler/YYYY/MM/YYYYMMDD.htm günlük fihrist. 🪤 ARŞİV windows-1254,
//                       ANA SAYFA utf-8 (ikisi FARKLI kodlama; UTF-8 varsayımı arşivde 93 bozuk
//                       karakter üretip sağlık filtresini tamamen sessizleştiriyordu).
//                       🪤 v6.94: sunucu leaf-only TLS zinciri sunar oldu (leaf CN=*.tccb.gov.tr) →
//                       tüm RG istekleri özel-CA'lı istemciden geçer (lib/rg-ca.ts; TTB deseni).
//   ✅ OHSAD          — özel hastaneler derneği; SUT/geri ödeme/mevzuat haberlerini derliyor
//                       ("Sağlık Uygulama Tebliğinde Değişiklik – 29 Haziran 2026" gibi tarihli).
//                       🔄 2026-08-24: SGK-aktarımı kalemleri artık SÜZÜLÜR (SGK_RELAY) — SGK
//                       doğrudan kaynağa bağlandı, aynı duyuru iki kaynaktan düşmesin.
//   ✅ SGK (GSS GM)   — 2026-08-24'te YENİDEN ölçüldü: v3 site /Duyuru/Index'i SUNUCUDA basıyor
//                       (2026-08-01 "JS ile yükleniyor" hükmü ESKİ siteye aitti). Kart: tarih
//                       rozeti + başlık + yayımcı birim; detay slug'ı damgalı (idempotent id).
//                       YALNIZ Genel Sağlık Sigortası GM duyuruları alınır (kullanıcı kararı).
//   ✅ TTB            — doktor özlük hakları/ücret tarifeleri; tarihli liste.
//   ✅ openFDA        — drug/enforcement + device/enforcement (geri çekme) · drug/label (prospektüs).
//                       ⚠️ ABD verisi: Türkiye ruhsatı (KÜB/KT) farklı olabilir → UI'da uyarı ZORUNLU.
//   ✅ ClinicalTrials — /api/v2/studies; faz + durum (lansman/geliştirme takibi).
//   ✅ WHO            — rss-feeds/news-english.xml.
//   ❌ EMA · TİTCK · AA/İHA — makine-okunur besleme YOK (EMA/TİTCK uçları 404, ajanslar
//      ticari abonelik). Bu kaynaklardan "varmış gibi" içerik ÜRETİLMEZ. (SGK 2026-08-24'te
//      bu listeden çıktı — yukarıdaki ✅ satırı.)
//
// Kazıma kırılgandır: bir kaynak bozulursa 0 kayıtla döner ve cron yanıtında görünür — uydurma
// içerik hiçbir koşulda yazılmaz.
import { request as httpsRequest } from "node:https";
import { rootCertificates } from "node:tls";
import { db } from "./db";
import { TTB_INTERMEDIATE_CA } from "./ttb-ca";
import { RG_INTERMEDIATE_CA } from "./rg-ca";

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
 * Eksik TLS zincirli kaynaklar için özel-CA'lı HTTPS GET (v6.58 TTB; v6.94 RG de bu yola alındı).
 * `ca:` verildiğinde Node varsayılan güven deposunu KAPATIR → daima [...rootCertificates, ekstra]
 * bileşimi verilir. fetch/undici yolu seçilmedi: global fetch'in undici'si modül olarak import
 * edilemez, ayrı undici bağımlılığı eklemek tek kaynaklık istisna için ağır kalırdı.
 * Dönüşteki `buf` ham bayttır (RG arşivi windows-1254 → decode'u çağıran seçer); `body` utf-8
 * kolaylığıdır. `referer` alt-sayfa ziyareti görünümü verir (browserHeaders ile aynı anlam).
 */
function httpsGetWithCa(url: string, extraCa: string, referer?: string): Promise<{ status: number; body: string; buf: Buffer }> {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      url,
      { headers: browserHeaders(referer), ca: [...rootCertificates, extraCa], timeout: FETCH_TIMEOUT_MS },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          resolve({ status: res.statusCode ?? 0, body: buf.toString("utf-8"), buf });
        });
        res.on("error", reject);
      },
    );
    // `timeout` boşta-kalma sayacıdır; olayında istek ELLE kapatılır (yoksa sonsuz asılır).
    req.on("timeout", () => req.destroy(new Error(`TimeoutError: ${FETCH_TIMEOUT_MS} ms doldu`)));
    req.on("error", reject);
    req.end();
  });
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

// v6.99 (kullanıcı isteği 2026-08-15): sektörel akış "doktorlarla ilgili" haberlerle genişledi →
// iki yeni kategori. "meslek" = hekimin kendi mesleki gündemi (özlük, atama, şiddet, uzmanlık
// eğitimi, oda/birlik açıklamaları); "kuresel" = uluslararası klinik/politika gündemi. Öncesinde
// WHO haberleri "teknoloji"ye yazılıyordu — ölçüldü ve yanlış olduğu görüldü (2026-08-15).
export type SectorCategory =
  | "mevzuat" | "sut" | "turizm" | "yonetim" | "teknoloji" | "ilac-cihaz" | "meslek" | "kuresel";

// Kategori ataması: başlık anahtar kelimeleri. Sıra ÖNEMLİ — ilk eşleşen kazanır (SUT, genel
// "mevzuat"tan önce gelmeli ki "SUT Tebliğinde Değişiklik" mevzuata değil SUT'a düşsün).
const CATEGORY_RULES: { cat: SectorCategory; kw: string[] }[] = [
  { cat: "sut", kw: ["sut", "sağlık uygulama tebliği", "geri ödeme", "fiyatlandırma komisyonu", "katılım payı", "faturalandırma", "sgk", "sosyal güvenlik"] },
  { cat: "turizm", kw: ["sağlık turizmi", "uluslararası hasta", "turizm teşvik", "hizmet ihracat", "akreditas"] },
  // ⚠️ "ruhsat" TEK BAŞINA YAZILMAZ: "Petrol Arama Ruhsatnamesi" de eşleşiyordu (2026-08-01'de
  //    ölçüldü) → yalnız ruhsatLANDIRMA (beşeri tıbbi ürün bağlamı).
  { cat: "ilac-cihaz", kw: ["ilaç", "tıbbi cihaz", "titck", "prospektüs", "ruhsatlandır", "eczane", "eczacı", "aşı", "biyosidal", "beşeri tıbbi"] },
  { cat: "teknoloji", kw: ["yapay zekâ", "yapay zeka", "dijital sağlık", "e-nabız", "teletıp", "tele-tıp", "giyilebilir", "veri güvenliği", "kişisel sağlık verileri", "kvkk"] },
  // v6.99: hekimin KENDİ mesleki gündemi — yönetim (kurum işletmesi) kategorisinden ayrıldı.
  // Sıra önemli: "yonetim"den ÖNCE gelir ki "asistan hekim nöbeti" yönetime değil mesleğe düşsün.
  { cat: "meslek", kw: [
    "hekim hak", "özlük", "ücret tarife", "hakediş", "asistan hekim", "tıpta uzmanlık", "tus ",
    "yan dal", "nöbet ücreti", "sağlıkta şiddet", "beyaz kod", "hekime şiddet", "tabip odası",
    "tabipleri birliği", "hekim ataması", "mecburi hizmet", "istifa eden hekim", "yurt dışına giden hekim",
    "emeklilik", "döner sermaye", "malpraktis", "mesleki sorumluluk", "denklik",
    // İngilizce mesleki gündem (Medscape vb.)
    "physician", "doctors", "residency", "burnout", "medical school", "workforce", "malpractice",
  ] },
  { cat: "yonetim", kw: ["özel hastane", "tıp merkezi", "sağlık kuruluş", "hastane yönetim", "akreditasyon", "hospital"] },
  { cat: "mevzuat", kw: ["yönetmelik", "tebliğ", "kanun", "karar", "genelge", "mahkeme"] },
  // En sonda: yukarıdakilere düşmeyen uluslararası klinik/politika gündemi.
  { cat: "kuresel", kw: ["who", "dsö", "outbreak", "salgın", "pandemi", "global health", "cdc", "epidemi"] },
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

/**
 * Yerelden-besleme script'i için opsiyonel ayarlar (v6.59 — scripts/ingest-tr-sources.ts).
 * Cron yolu bunları hiç vermez; davranışı birebir aynı kalır.
 */
export interface IngestOpts {
  /** true → DB'ye YAZMAZ; yalnız var-mı kontrolü yapar (prova). Dönen "yeni" sayısı = yazılırdı. */
  dryRun?: boolean;
  /** Yeni (yazılacak/yazılan) her kalem için çağrılır — script satır satır gösterir. */
  onItem?: (line: string) => void;
}

/**
 * Tek kayıt yaz (varsa atla). Dönen: yeni mi. dryRun'da yazmadan "yeni olurdu" bilgisi döner.
 * `getImage` (v6.99.2): görsel URL'i TEMBEL üretilir — yalnız kayıt GERÇEKTEN yeniyken çağrılır
 * (og:image çıkarımı sayfa isteği gerektirir; mevcut kayıtlar için her gece yeniden istenmesin).
 */
async function upsertArticle(a: {
  source: string; externalId: string; module: string; category: string | null;
  kind: string; title: string; summary?: string; sourceName: string; url: string | null;
  publishedAt: Date; branchSlugs?: string;
}, dryRun?: boolean, getImage?: () => Promise<string | null>): Promise<boolean> {
  const exists = await db.newsArticle.findUnique({
    where: { source_externalId: { source: a.source, externalId: a.externalId } },
    select: { id: true },
  });
  if (exists) return false;
  if (dryRun) return true;
  // Görsel çıkarımı en-iyi-çaba: hata haber kaydını DÜŞÜRMEZ (görselsiz yazılır — CoverArt devrede).
  let imageUrl: string | null = null;
  if (getImage) {
    try { imageUrl = await getImage(); } catch { /* görselsiz devam */ }
  }
  await db.newsArticle.create({
    data: {
      source: a.source, externalId: a.externalId, module: a.module, category: a.category,
      kind: a.kind, title: a.title, summary: a.summary ?? "", sourceName: a.sourceName,
      url: a.url, publishedAt: a.publishedAt, branchSlugs: a.branchSlugs ?? "[]", imageUrl,
    },
  });
  return true;
}

// ── Haber görseli (v6.99.2 — kullanıcı isteği 2026-08-16) ───────────────────
//
// Haber DETAYINDA kaynağın kendi görseli gösterilir (akış kartı CoverArt kalır). Görsel
// BARINDIRILMAZ — hotlink + kaynak atfı (telif: kopya almak lisans ister, atıflı hotlink
// aggregator pratiğidir; nihai hukuki değerlendirme 👤). İki kaynak tipi:
//   · RSS media etiketi (media:content/media:thumbnail/enclosure) — MedicalXpress verir.
//   · Makale sayfasının og:image meta'sı — İTO/OHSAD/WHO/TTB/Medscape verir (2026-08-16 ölçümü).
//
// ⚠️ ALLOWLIST ŞART: CSP img-src YALNIZ bu host'lara açılır (next.config.ts) — listede olmayan
// host'tan gelen URL YAZILMAZ (yazılsa da tarayıcı engeller = kırık görsel). Bu liste ile
// next.config.ts img-src'ı sözleşme testiyle kilitlidir (tests/unit/doctorium-filtreler).
// 🚩 img.medscapestatic.com görselleri sıklıkla AJANS (Getty — "gty-*.jpg") kaynaklı; hukuki
// rahatsızlıkta bu satırı silmek yeter (Medscape haberleri görselsiz kalır, CoverArt devralır).
export const NEWS_IMAGE_HOSTS: string[] = [
  "www.istabip.org.tr",
  "www.ohsad.org",
  "cdn.who.int",
  "www.who.int",
  "scx1.b-cdn.net", // Medical Xpress RSS thumbnail CDN'i
  "www.ttb.org.tr",
  "img.medscapestatic.com", // 🚩 Getty riski — yukarıdaki not
];

/** URL allowlist'li bir https görseli mi? Değilse null (CSP zaten engellerdi — hiç yazma). */
export function allowedImageUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:") return null;
    return NEWS_IMAGE_HOSTS.includes(u.hostname) ? u.toString() : null;
  } catch {
    return null;
  }
}

/** HTML'den og:image (og:image:url / name= varyantları dahil) — allowlist süzgeçli. */
export function extractOgImage(html: string): string | null {
  for (const m of html.matchAll(/<meta[^>]+(?:property|name)="og:image(?::url)?"[^>]+content="([^"]+)"/gi)) {
    const ok = allowedImageUrl(plain(m[1]));
    if (ok) return ok;
  }
  // content önce, property sonra yazılmış varyant (sıra garanti değil).
  for (const m of html.matchAll(/<meta[^>]+content="([^"]+)"[^>]+(?:property|name)="og:image(?::url)?"/gi)) {
    const ok = allowedImageUrl(plain(m[1]));
    if (ok) return ok;
  }
  return null;
}

/**
 * Makale sayfasından og:image çek (en-iyi-çaba; yalnız YENİ kayıtlar için çağrılır).
 * TTB leaf-only TLS zinciri burada da geçerli → host'a göre özel-CA istemcisi seçilir.
 * Medscape sınıfı için başlıksız yeniden deneme (ingestRss ile aynı ders — 2026-08-15).
 */
export async function fetchOgImage(articleUrl: string): Promise<string | null> {
  try {
    const host = new URL(articleUrl).hostname;
    if (/(^|\.)ttb\.org\.tr$/i.test(host)) {
      const res = await httpsGetWithCa(articleUrl, TTB_INTERMEDIATE_CA);
      return res.status === 200 ? extractOgImage(res.body) : null;
    }
    let res = await fetch(articleUrl, {
      headers: browserHeaders(new URL(articleUrl).origin + "/"),
      cache: "no-store", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (res.status === 403 || res.status === 429) {
      res = await fetch(articleUrl, { cache: "no-store", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    }
    if (!res.ok) return null;
    return extractOgImage(await res.text());
  } catch {
    return null;
  }
}

// ── T.C. Resmî Gazete ───────────────────────────────────────────────────────

/** Arşiv (geçmiş gün) fihristi — windows-1254. Dönen: [{title, url, id}]. */
export async function fetchGazetteArchive(date: Date): Promise<{ title: string; url: string; id: string }[]> {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const base = `https://www.resmigazete.gov.tr/eskiler/${y}/${m}/`;
  // v6.94: RG leaf-only TLS zinciri (rg-ca.ts) — normal fetch UNABLE_TO_VERIFY_LEAF_SIGNATURE ile düşer.
  const res = await httpsGetWithCa(`${base}${y}${m}${d}.htm`, RG_INTERMEDIATE_CA, "https://www.resmigazete.gov.tr/");
  if (res.status !== 200) return [];
  // 🪤 ARŞİV windows-1254: ham bayttan açıkça çöz (utf-8 varsayımı Türkçeyi bozar).
  const html = new TextDecoder("windows-1254").decode(res.buf);

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
  // v6.94: RG leaf-only TLS zinciri (rg-ca.ts) — normal fetch UNABLE_TO_VERIFY_LEAF_SIGNATURE ile düşer.
  const res = await httpsGetWithCa("https://www.resmigazete.gov.tr/", RG_INTERMEDIATE_CA);
  // Teşhis görünürlüğü (v6.57): sessizce [] dönmek "0 kayıt tarandı" ile "site reddetti"yi
  // ayırt edilemez kılıyordu — HTTP hatası artık cron raporuna düşer.
  if (res.status !== 200) throw new Error(`RG HTTP ${res.status}`);
  const html = res.body;
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
export async function ingestGazetteItems(
  items: { title: string; url: string; id: string }[],
  opts?: IngestOpts,
): Promise<[number, number]> {
  let created = 0;
  for (const it of items) {
    if (!isHealthRelated(it.title)) continue;
    const cat = categorize(it.title) ?? "mevzuat";
    // Mevzuat kalemleri KENDİ modülünde (v6.50: sektörel haberden ayrıldı).
    const isNew = await upsertArticle({
      source: "resmi-gazete", externalId: it.id, module: "mevzuat", category: cat,
      kind: "mevzuat", title: it.title, sourceName: "T.C. Resmî Gazete",
      url: it.url, publishedAt: gazetteDate(it.id),
    }, opts?.dryRun);
    if (isNew) {
      created++;
      opts?.onItem?.(`[RG · ${cat}] ${it.title.slice(0, 110)}`);
    }
  }
  return [items.length, created];
}

// ── OHSAD (SUT / geri ödeme / mevzuat aktarımı) ─────────────────────────────

/**
 * OHSAD — MANŞET kategorisinin RSS beslemesi (kullanıcı kararı 2026-08-26).
 *
 * Eski yol ana sayfa HTML taramaydı ve link-avcısı regex KATEGORİ SAYFASINI da haber sanıp
 * kaydetti (canlıda ölçüldü: "Manşet <ilk haberin başlığı>" birleşik başlıklı, özeti site nav
 * menüsü olan kayıt — kullanıcı "aynı haber iki kere" olarak gördü). WordPress kategori feed'i
 * (https://www.ohsad.org/category/manset/feed/ — 2026-08-26 ölçümü: HTTP 200, 10 item) yalnız
 * gerçek haber kalemlerini verir: başlık/link/pubDate/description temiz.
 *
 * Bilinçli korunanlar / değişenler:
 *  · externalId ESKİ formülle (URL slug'ı) — source_externalId idempotensi: eski yolun yazdığı
 *    gerçek haber feed'de tekrar görülünce YENİ kayıt AÇILMAZ. Formülü DEĞİŞTİRME.
 *  · SGK_RELAY süzgeci aynen (SGK/GSS duyuruları doğrudan kaynağından — ingestSgkGss; OHSAD
 *    aktarımını da yazmak aynı duyuruyu iki kaynaktan düşürürdü, kullanıcı kararı 2026-08-24).
 *  · isHealthRelated süzgeci KALDIRILDI: manşet derneğin kendi editoryal seçimidir
 *    (isAssociationRelevant sınıfı gerekçe — kaynak otoriteyken pozitif sinyal aranmaz).
 *  · categorize→modül ataması aynen (mevzuat/SUT → Mevzuat modülü; kategorisiz haber
 *    sektörel/yönetim — 2026-08-01 dersi).
 *  · summary artık feed description'ından (eskiden boş kalıp sonradan sayfadan dolduruluyordu
 *    ve nav-menüsü çöpü toplayabiliyordu).
 */
export async function ingestOhsad(opts?: IngestOpts): Promise<[number, number]> {
  const FEED = "https://www.ohsad.org/category/manset/feed/";
  // İki aşamalı başlık (ingestRss deseni): önce tarayıcı başlıkları (OHSAD Cloudflare sınıfı),
  // 403/429'da başlıksız yeniden dene — kaynak davranışı değişse de kendini onarır.
  const get = (headers: Record<string, string>) =>
    fetch(FEED, { headers, cache: "no-store", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  let res = await get({
    ...browserHeaders("https://www.ohsad.org/"),
    Accept: "application/rss+xml, application/xml, text/xml, */*;q=0.8",
  });
  if (res.status === 403 || res.status === 429) res = await get({});
  if (!res.ok) throw new Error(`OHSAD HTTP ${res.status}`);
  const xml = await res.text();

  let scanned = 0;
  let created = 0;
  const seen = new Set<string>();
  for (const it of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const b = it[1];
    const pick = (tag: string) => {
      const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(b);
      return m ? plain(m[1].replace(/<!\[CDATA\[|\]\]>/g, "")) : "";
    };
    const rawTitle = pick("title");
    const url = pick("link");
    if (!rawTitle || !url) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    scanned++;
    if (SGK_RELAY.test(rawTitle.toLocaleLowerCase("tr-TR"))) continue;
    // Başlık sonundaki tarih kuyruğu temizliği — iki biçim de görülür: "– 29 Haziran 2026"
    // (sözel, eski liste) ve "– 04.07.2026" (rakamsal — 2026-08-26 dry-run'ında feed'de ölçüldü).
    // İdempotensi başlığa değil URL slug'ına bağlı; temizlik güvenli.
    const title = rawTitle.replace(/\s*[–-]\s*(?:\d{1,2}\s+\p{L}+\s+\d{4}|\d{1,2}[./]\d{1,2}[./]\d{4})\s*$/u, "").trim();
    const description = pick("description");
    // OHSAD manşeti mesleki otorite olsa da bayram/kutlama gibi kurum içi bülten kalemleri
    // Doctorium akışına girmez. Pozitif mesleki sinyal aranmaz; yalnız ortak negatif elek uygulanır.
    if (isNoiseContent(title, description)) continue;
    const pub = pick("pubDate");
    const when = pub ? new Date(pub) : null;
    const published = when && !Number.isNaN(when.getTime()) ? when : (parseTurkishDate(rawTitle) ?? new Date());
    // URL yolu benzersiz kimlik (slug) — eski formülle birebir aynı.
    const id = url.replace(/\/$/, "").split("/").pop() as string;
    const cat = categorize(title);
    const isLegal = cat === "mevzuat" || cat === "sut";
    const isNew = await upsertArticle({
      source: "ohsad", externalId: id, module: isLegal ? "mevzuat" : "sektorel",
      category: cat ?? "yonetim", kind: isLegal ? "mevzuat" : "haber",
      title, summary: description.slice(0, 500),
      sourceName: "OHSAD", url, publishedAt: published,
      // Görsel yalnız HABER kalemine (v6.99.2) — mevzuat/SUT detayı resmî metin sayfasıdır.
    }, opts?.dryRun, isLegal ? undefined : () => fetchOgImage(url));
    if (isNew) {
      created++;
      opts?.onItem?.(`[OHSAD · ${cat ?? "yonetim"}] ${title.slice(0, 110)}`);
    }
  }
  return [scanned, created];
}

// ── SGK — Genel Sağlık Sigortası GM duyuruları (kullanıcı kararı 2026-08-24) ─

// OHSAD döngüsündeki aktarım süzgeci: bu desenler SGK'nın kendi yayın alanı (küçük-harf tr-TR
// ile test edilir). "Sağlık Uygulama Tebliğ" köküne dikkat: OHSAD başlıkları çekimli gelir.
// Export yalnız birim test için (doctorium-filtreler — süzgecin gevşemesi sessiz çift-kayıt üretir).
export const SGK_RELAY = /\bsgk\b|sosyal güvenlik kurumu|sağlık uygulama tebliğ|bedeli ödenecek ilaç/;

/**
 * SGK v3 duyuru sayfası SUNUCUDA render edilir (2026-08-24 ölçümü; 2026-08-01 "JS" hükmü eski
 * siteye aitti). YALNIZ Genel Sağlık Sigortası GM duyuruları alınır: önce ana sayfa menüsünden
 * birimin kendi liste sayfası bulunur (slug DAMGALI ve değişebilir → her koşuda taze çözülür,
 * kendini onarır), bulunamazsa ana listedeki kartlar birim etiketiyle süzülür. Kalemler
 * "haberler kısmı"na yazılır (module sektorel — kullanıcı kararı); kategori başlıktan, GSS'nin
 * doğal varsayılanı "sut" (geri ödeme ekseni). Görsel çekilmez (gov.tr og:image allowlist'te
 * yok) — CoverArt üretilmiş kapak devrede.
 */
export async function ingestSgkGss(opts?: IngestOpts & { page?: number }): Promise<[number, number]> {
  const base = "https://www.sgk.gov.tr";
  const main = await fetch(`${base}/Duyuru/Index`, {
    headers: browserHeaders(), cache: "no-store", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!main.ok) throw new Error(`SGK HTTP ${main.status}`);
  let html = await main.text();

  // Menüden GSS liste sayfası; düşerse ana liste + birim-etiketi süzgeciyle devam (fail-soft).
  let unitPage = false;
  const gssHref = /href="(\/duyuru\/index\/GENEL-SAGLIK-SIGORTASI-GENEL-MUDURLUGU-[^"]+)"/.exec(html)?.[1];
  if (gssHref) {
    try {
      // opts.page (backfill, 2026-08-25 — scripts/ingest-tr-sources.ts): GSS birim sayfası
      // ?page=N ile geriye sayfalanır (10 duyuru/sayfa, canlı ölçüm). Günlük cron page vermez
      // → ilk sayfa (en güncel 10 duyuru) — davranış değişmedi.
      const pageQs = opts?.page ? `?page=${opts.page}` : "";
      const res = await fetch(base + gssHref + pageQs, {
        headers: browserHeaders(`${base}/Duyuru/Index`), cache: "no-store", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (res.ok) { html = await res.text(); unitPage = true; }
    } catch { /* ana listeyle devam */ }
  }

  let scanned = 0;
  let created = 0;
  for (const m of html.matchAll(/<a\b[^>]*href="(\/duyuru\/detay\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const inner = m[2];
    const title = plain(/class="announcement-title[^"]*"[^>]*>([\s\S]*?)<\/div>/.exec(inner)?.[1] ?? "");
    if (title.length < 10) continue;
    scanned++;
    // Birim etiketi karttaki .announcement-link satırında; GSS sayfasındaysak süzgeç gerekmez.
    const unit = plain(/class="announcement-link[^"]*"[^>]*>([\s\S]*?)<\/div>/.exec(inner)?.[1] ?? "");
    if (!unitPage && !unit.toLocaleLowerCase("tr-TR").includes("genel sağlık sigortası")) continue;
    // Tarih rozeti üç ayrı düğümde (21 / Ağustos / 2026) — parseTurkishDate'in beklediği biçime dizilir.
    const day = /class="date-day[^"]*"[^>]*>\s*(\d{1,2})/.exec(inner)?.[1];
    const month = plain(/class="date-month[^"]*"[^>]*>([\s\S]*?)<\/div>/.exec(inner)?.[1] ?? "");
    const year = /class="date-year[^"]*"[^>]*>\s*(\d{4})/.exec(inner)?.[1];
    const published = (day && month && year ? parseTurkishDate(`${day} ${month} ${year}`) : null) ?? new Date();
    const id = m[1].replace(/\/$/, "").split("/").pop() as string; // damgalı slug — idempotent
    const isNew = await upsertArticle({
      source: "sgk", externalId: id, module: "sektorel",
      category: categorize(title) ?? "sut", kind: "haber",
      title, sourceName: "SGK", url: base + m[1], publishedAt: published,
    }, opts?.dryRun);
    if (isNew) {
      created++;
      opts?.onItem?.(`[SGK · ${categorize(title) ?? "sut"}] ${title.slice(0, 110)}`);
    }
  }
  return [scanned, created];
}

// ── TTB (doktor özlük hakları) ───────────────────────────────────────────────

export async function ingestTtb(): Promise<[number, number]> {
  // v6.58: TTB sunucusu ara sertifikayı sunmuyor (leaf-only zincir) → normal fetch Vercel'de
  // UNABLE_TO_VERIFY_LEAF_SIGNATURE ile düşer. Özel-CA'lı istemci zinciri tamamlar (lib/ttb-ca.ts).
  const res = await httpsGetWithCa("https://www.ttb.org.tr/", TTB_INTERMEDIATE_CA);
  if (res.status !== 200) throw new Error(`TTB HTTP ${res.status}`);
  const html = res.body;

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
    const ttbUrl = url;
    const isNew = await upsertArticle({
      source: "ttb", externalId: id.slice(0, 180), module: "sektorel",
      category: categorize(title) ?? "yonetim", kind: "haber",
      title, sourceName: "Türk Tabipleri Birliği", url, publishedAt: new Date(),
    }, undefined, () => fetchOgImage(ttbUrl)); // özel-CA yolu fetchOgImage içinde (v6.99.2)
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
      // v6.99: WHO haberleri "teknoloji" değil KÜRESEL gündemdir (kategori ayrımı 2026-08-15).
      source: "who", externalId: link.slice(-180), module: "sektorel", category: "kuresel",
      kind: "haber", title: title.slice(0, 300), summary: pick("description").slice(0, 400),
      sourceName: "WHO", url: link,
      publishedAt: Number.isNaN(when.getTime()) ? new Date() : when,
    });
    // v6.99.5: WHO og görseli toplanmaz — kurumsal jenerik görseller kalite standardının
    // altındaydı; detay CoverArt kaynak-bandını (band-who.webp) gösterir.
    if (isNew) created++;
  }
  return [items.length, created];
}

// ── Mesleki alaka süzgeci (v6.99) ───────────────────────────────────────────
//
// Kullanıcı isteği 2026-08-15: sektörel akışa "doktorlarla ilgili" haberler eklensin. Kaynak
// eklemek TEK BAŞINA yetmiyor — 2026-08-15 ölçümünde Türkçe sektör medyası akışlarında
// "Ekşi mayalı ekmek uyarısı", "Omega 3 nasıl kullanılır", "Türkiye'nin En İyi 10 Saç Ekimi
// Kliniği (2026)" gibi hasta-yüzü/SEO ve advertorial içerik vardı. Hekim akışına giren her kalem
// MESLEKİ olmalı: klinik pratiği, mevzuatı, hakları ya da sağlık sistemini ilgilendirmeli.
//
// isHealthRelated'dan farkı: o "sağlıkla ilgili mi" der (Resmî Gazete gibi karışık kaynaklar
// için, Türkçe); bu "HEKİMİ ilgilendirir mi" der ve İngilizce beslemeleri de kapsar.

/** Tüketici/yaşam tarzı içeriği — hekim akışında gürültüdür. */
const CONSUMER_PATTERNS = [
  "nasıl zayıfla", "kilo verme", "diyet listesi", "zayıflama", "cilt bakım", "güzellik sırr",
  "bitkisel çözüm", "doğal yöntem", "mucize", "şaşırtan", "işte o besin", "sağlıklı yaşam ipuç",
  "burçlar", "tarifi", "yaz aylarında dikkat", "uzmanından uyarı",
  "weight loss tip", "beauty", "horoscope", "recipe", "wellness trend", "best foods",
];
/**
 * Kurum içi etkinlik/duyuru gürültüsü — 2026-08-15 İTO ölçümünde akışa "Odamızı Ziyaret Etti",
 * "Kahvaltıda Buluştu", "Satış İlanı" gibi kalemler giriyordu. Mesleki gündem DEĞİL, iç bültendir.
 * ⚠️ "çalıştay"/"rapor"/"sempozyum" BİLİNÇLİ yok: "Genç Hekim İntiharları Çalıştayı Raporu" gibi
 * kalemler hekimi doğrudan ilgilendirir.
 */
const ORG_NOISE_PATTERNS = [
  "ziyaret etti", "odamızı ziyaret", "kahvaltıda buluş", "yemeğine katıldık", "satış ilanı",
  "tebrik ve dayanışma", "taziye", "nikah", "piknik", "gezisi", "turnuva", "kutlama mesajı",
  "kutlu olsun",
];

/** Reklam/advertorial imzaları — ticari beslemelerde başlığa işlenir. */
const PROMO_PATTERNS = [
  "sponsorlu", "işbirliği ile", "reklam", "advertorial", "tanıtım yazısı", "iş birliğiyle",
  "en iyi 10", "en iyi klinik", "fiyatları", "kampanya", "indirim",
  "sponsored", "paid content", "partner content", "promoted",
];
/** Hekimi ilgilendiren mesleki/klinik/sistem sinyalleri (TR + EN). */
const PROFESSIONAL_PATTERNS = [
  // mesleki gündem
  "hekim", "doktor", "dr.", "uzm.", "prof.", "doç.", "tabip", "asistan", "uzmanlık", "tus", "nöbet",
  "özlük", "malpraktis", "başhekim", "atama", "görev değişimi", "il sağlık müdür", "sağlık müdürlüğ",
  "sağlıkta şiddet", "beyaz kod", "mecburi hizmet", "döner sermaye", "denklik", "mesleki sorumluluk",
  "physician", "doctor", "clinician", "resident", "residency", "medical school", "nurse",
  // klinik/bilimsel
  "klinik", "tedavi", "tanı", "kılavuz", "rehber", "endikasyon", "ameliyat", "cerrah", "ilaç",
  "aşı", "hasta güvenliği", "yan etki", "faz 3", "klinik çalışma", "salgın", "vaka sayısı",
  "clinical", "trial", "guideline", "treatment", "diagnosis", "surgery", "drug", "vaccine",
  "fda", "ema", "approval", "patients", "therapy", "disease", "cancer", "outbreak", "screening",
  // 🪤 2026-08-15: "US CDC Records More Than 2,500 Measles Cases" hiçbir desene takılmıyordu —
  // salgın/halk sağlığı haberleri hastalık ADIYLA gelir, hastalık adı listelenemez → kurum ve
  // epidemiyoloji sözcükleri desen olur.
  "cdc", "who ", "epidemic", "infection", "cases", "immuniz", "vaccination", "mortality",
  // sistem / mevzuat / ödeme
  "sgk", "sut", "geri ödeme", "hastane", "sağlık bakanlığı", "titck", "mevzuat", "yönetmelik",
  "hospital", "medicare", "medicaid", "insurance", "health policy", "public health",
];

/**
 * Kalem hekim akışına girmeli mi? Reklam/tüketici içeriği kesin elenir; kalanlarda en az bir
 * mesleki sinyal aranır. Kaynak ne olursa olsun aynı ölçüt uygulanır (kaynağa güven, süzgeci
 * atlama gerekçesi değildir — 2026-08-15 dersi).
 */
export function isProfessionallyRelevant(title: string, summary = ""): boolean {
  if (isNoiseContent(title, summary)) return false;
  const t = `${title} ${summary}`.toLocaleLowerCase("tr-TR");
  return PROFESSIONAL_PATTERNS.some((p) => matchesKeyword(t, p));
}

/**
 * Negatif elekler (reklam · tüketici · iç-bülten) — kaynak ne olursa olsun İSTİSNASIZ uygulanır.
 * v6.129'da isProfessionallyRelevant'tan ayrıştı: uzmanlık derneği beslemeleri (aşağıda
 * ASSOCIATION_RSS_SOURCES) POZİTİF sinyal şartından muaftır ama bu eleklerden ASLA muaf değil.
 */
export function isNoiseContent(title: string, summary = ""): boolean {
  const t = `${title} ${summary}`.toLocaleLowerCase("tr-TR");
  const head = title.toLocaleLowerCase("tr-TR"); // etkinlik gürültüsü BAŞLIKTAN anlaşılır
  if (PROMO_PATTERNS.some((p) => t.includes(p))) return true;
  if (CONSUMER_PATTERNS.some((p) => t.includes(p))) return true;
  return ORG_NOISE_PATTERNS.some((p) => head.includes(p));
}

/**
 * Uzmanlık derneği beslemesine ÖZEL ek gürültü (v6.129, 2026-08-19 ölçümü). Dernek akışlarında
 * "Kutlama; Sn. Doç. Dr. X" (TATD) · "Başkanın Yeni Yıl Mesajı" (TGD) gibi kalemler POZİTİF
 * mesleki desen taşıdığı için ("doç.", "başkan") genel süzgeçten sızıyordu — tören/iç-bülten
 * sınıfıdır, doktorun akışında değeri yok.
 * ⚠️ ORG_NOISE_PATTERNS'e EKLENMEDİ (bilinçli): bu sözcükler genel sağlık medyasında meşru
 * haber başlığı olabilir ("… salgınında 12 vefat"), yalnız dernek duyurusunda tören anlamına gelir.
 */
const ASSOC_NOISE_PATTERNS = [
  "kutlama", "tebrik", "taziye", "vefat", "başsağlığı", "anma töreni", "yeni yıl mesaj",
  "bayram mesaj", "yönetim kurulu belirlendi", "seçim sonuç", "genel kurul duyuru",
];

/**
 * Dernek kalemi akışa girmeli mi? POZİTİF sinyal ARANMAZ — kaynağın kendisi mesleki otoritedir
 * (kurumun kendi uzmanlık alanında yayımladığı duyuru tanımı gereği o branşın gündemi). Yalnız
 * negatif elekler + tören sınıfı uygulanır.
 */
export function isAssociationRelevant(title: string, summary = ""): boolean {
  if (isNoiseContent(title, summary)) return false;
  const head = title.toLocaleLowerCase("tr-TR");
  return !ASSOC_NOISE_PATTERNS.some((p) => head.includes(p));
}

// ── Genel RSS toplayıcı (v6.99) ─────────────────────────────────────────────

export interface RssSourceDef {
  /** DB'ye yazılan kaynak anahtarı (source) — değiştirme, idempotenci ona bağlı. */
  source: string;
  /** Kartta görünen kurum adı. */
  sourceName: string;
  url: string;
  /** Sabit kategori; verilmezse başlıktan çıkarılır (categorize). */
  category?: SectorCategory;
  limit?: number;
  /** v6.99.5 — false: bu kaynaktan görsel TOPLANMAZ (düşük kaliteli thumbnail/Getty sınıfı;
   *  detay CoverArt kaynak-bandını gösterir). Varsayılan true. */
  collectImages?: boolean;
  /** v6.129 — bu beslemenin kalemleri hangi branşlara yazılacak (NewsArticle.branchSlugs).
   *  Uzmanlık derneği beslemeleri branşa BAĞLIDIR; genel medya kaynaklarında boş kalır. */
  branchSlugs?: string[];
  /**
   * v6.129 — kalem süzgeci. Varsayılan `isProfessionallyRelevant` (genel medya: pozitif mesleki
   * sinyal ŞART). Uzmanlık dernekleri `isAssociationRelevant` kullanır: kaynağın kendisi mesleki
   * otorite olduğu için pozitif sinyal aranmaz, yalnız gürültü elenir.
   */
  filter?: (title: string, summary: string) => boolean;
  /**
   * v6.129 — beslemenin KENDİ `<category>` etiketiyle dışlama (küçük/büyük harf duyarsız).
   * 🔑 Kaynağın kendi sınıflandırması başlık tahmininden GÜVENİLİRDİR: TGCD feed'i hem dernek
   * duyurusu hem HASTA bilgilendirme yazısı yayımlıyor ("Akalazya Nedir?") ve ikisini
   * `Haberler` / `Halk Sağlığı` diye kendisi ayırıyor. Desen uydurmak yerine o etiketi okuruz.
   */
  excludeCategories?: string[];
}

/**
 * RSS/Atom beslemesi → NewsArticle. Ayrıştırma hedefli regex'tir (proje geneli desen: parser
 * bağımlılığı yok, başarısızlık = 0 kayıt, uydurma yok). RSS 1.0/RDF de desteklenir: NEJM gibi
 * kaynaklar <item rdf:about> kullanır, düz `<item>` araması onları KAÇIRIR (2026-08-15 ölçümü).
 */
export async function ingestRss(def: RssSourceDef, opts?: IngestOpts): Promise<[number, number]> {
  // 🪤 2026-08-15 ölçümü — OHSAD dersinin TERSİ bir sınıf: Medscape, tarayıcı UA'lı Node
  // isteğine 403 verir, BAŞLIKSIZ isteğe 200. (curl her iki halde 200 → sorun UA değil, "tarayıcı
  // gibi görünen ama TLS parmak izi Node olan" istemcinin tutarsızlığı.) Bu yüzden başlık seti
  // sabit değil, İKİ AŞAMALI: önce tarayıcı başlıkları (OHSAD/Cloudflare sınıfı için gerekli),
  // 403/429'da başlıksız yeniden dene. Kaynak davranışı değişse de kendini onarır.
  const get = (headers: Record<string, string>) =>
    fetch(def.url, { headers, cache: "no-store", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  let res = await get({
    ...browserHeaders(new URL(def.url).origin + "/"),
    Accept: "application/rss+xml, application/xml, text/xml, */*;q=0.8",
  });
  if (res.status === 403 || res.status === 429) res = await get({});
  if (!res.ok) throw new Error(`${def.source} HTTP ${res.status}`);
  const xml = await res.text();

  const blocks = [...xml.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)]
    .map((m) => m[2])
    .slice(0, def.limit ?? 15);

  let scanned = 0;
  let created = 0;
  const seen = new Set<string>();
  for (const b of blocks) {
    const pick = (tag: string) => {
      const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(b);
      return m ? plain(m[1].replace(/<!\[CDATA\[|\]\]>/g, "")) : "";
    };
    const title = pick("title");
    // Atom link'i öznitelikte taşır (<link href="...">), RSS gövdede.
    const link = pick("link") || /<link[^>]+href="([^"]+)"/i.exec(b)?.[1] || "";
    if (!title || !link) continue;
    if (seen.has(link)) continue;
    seen.add(link);
    scanned++;
    const summary = pick("description") || pick("summary");
    if (!(def.filter ?? isProfessionallyRelevant)(title, summary)) continue;
    // Beslemenin kendi kategorisiyle dışlama (v6.129) — kaynağın beyanı, bizim tahminimiz değil.
    if (def.excludeCategories?.length) {
      const cats = [...b.matchAll(/<category[^>]*>([\s\S]*?)<\/category>/gi)]
        .map((m) => plain(m[1].replace(/<!\[CDATA\[|\]\]>/g, "")).toLocaleLowerCase("tr-TR"));
      if (def.excludeCategories.some((x) => cats.includes(x.toLocaleLowerCase("tr-TR")))) continue;
    }
    const pub = pick("pubDate") || pick("published") || pick("updated") || pick("dc:date");
    const when = pub ? new Date(pub) : new Date();
    // Görsel (v6.99.2): önce RSS'in kendi media etiketi (MedicalXpress); yoksa makale sayfasının
    // og:image'ı (Medscape). İkisi de tembel — yalnız YENİ kayıtta koşar (upsertArticle sözleşmesi).
    const mediaUrl = /<(?:media:content|media:thumbnail|enclosure)[^>]+url="([^"]+)"/i.exec(b)?.[1] ?? null;
    const isNew = await upsertArticle({
      source: def.source,
      externalId: link.slice(-180),
      module: "sektorel",
      category: def.category ?? categorize(title) ?? "kuresel",
      kind: "haber",
      title: title.slice(0, 300),
      summary: summary.slice(0, 500),
      sourceName: def.sourceName,
      url: link,
      publishedAt: Number.isNaN(when.getTime()) ? new Date() : when,
      branchSlugs: def.branchSlugs?.length ? JSON.stringify(def.branchSlugs) : undefined,
    }, opts?.dryRun, def.collectImages === false ? undefined : async () => allowedImageUrl(mediaUrl) ?? (await fetchOgImage(link)));
    if (isNew) {
      created++;
      opts?.onItem?.(`[${def.source}] ${title.slice(0, 110)}`);
    }
  }
  return [scanned, created];
}

/**
 * Sektörel besleme kaynakları (v6.99 — kullanıcı seçimi 2026-08-15: "mesleki + uluslararası").
 * ⚠️ Her ad canlı ölçüldü (2026-08-15): BMJ news 403, TİTCK/SGK/YÖK/Sağlık Bakanlığı makine-okunur
 * besleme vermiyor, TTB'nin rss.php'si 404 → listeye YALNIZ çalışanlar girdi. Ölmüş bir kaynağı
 * "ekleyelim de dursun" mantığıyla bırakmak, cron raporunu kalıcı hatayla kirletir.
 */
export const RSS_SOURCES: RssSourceDef[] = [
  // collectImages: false (v6.99.5) — Medscape og'ları Getty ajans fotoğrafı, MedicalXpress RSS
  // yalnız küçük thumbnail veriyor; ikisi de kalite standardının altında (kullanıcı kararı
  // 2026-08-16) → detay CoverArt kaynak-bandını gösterir (band-*.webp).
  { source: "medscape", sourceName: "Medscape", url: "https://www.medscape.com/cx/rssfeeds/2700.xml", limit: 12, collectImages: false },
  { source: "medicalxpress", sourceName: "Medical Xpress", url: "https://medicalxpress.com/rss-feed/", limit: 12, collectImages: false },
];

// ── Uzmanlık dernekleri (v6.129, kullanıcı isteği 2026-08-19) ───────────────
//
// Kullanıcının 30 branşlık dernek rehberi sisteme İKİ ayrı yolla girer:
//   1. BU LİSTE (ASSOCIATION_RSS_SOURCES) — RSS/Atom yayımlayan dernekler; günlük ingest'te
//      sektörel akışa "meslek" kategorisi + branş etiketiyle düşer.
//   2. lib/association-sources.ts — 30 derneğin TAMAMI (RSS'i olmayanlar dahil): haftalık
//      GitHub Actions nöbetçisi ve kongre tazeleme kuyruğu oradan beslenir.
//
// 🪤 2026-08-19 CANLI ÖLÇÜM — 33 dernek domaini tarandı (autodiscovery + 7 yaygın yol):
// yalnız 5'i geçerli besleme veriyor. Ölçülen gerçek, tahmin değil; ölmüş/eksik bir feed'i
// "ekleyelim de dursun" diye listeye koymak cron raporunu kalıcı hatayla kirletir (v6.99 dersi).
//   ❌ Feed YOK (28): tkd · toraks · solunum · noroloji · atuder · turkpediatri · millipediatri ·
//      turkcer · totbid · uroloji · todnet · kbb · tihud · kanser · turkdermatoloji · psikiyatri ·
//      turkrad · tard · turknorosirurji · plastikcerrahi · tftr · temd · romatoloji · thd ·
//      nefroloji · tkdcd · turkpath · tibbigenetik
//   ⚠️ uroloji.org.tr ve tibbigenetikturkiye.org TLS zinciri EKSİK sunuyor
//      (UNABLE_TO_VERIFY_LEAF_SIGNATURE) — nöbetçi bunu ayrı raporlar (TTB/RG emsali:
//      lib/ttb-ca.ts · lib/rg-ca.ts; gerekirse aynı özel-CA yolu kurulur).
//
// Kategori "meslek": dernek duyurusu doktorun kendi mesleki gündemidir (SECTOR_CATEGORIES).
// Görsel toplanmaz — dernek sayfalarının og'ları çoğunlukla logo/afiş (CoverArt daha iyi).
export const ASSOCIATION_RSS_SOURCES: RssSourceDef[] = [
  { source: "klimik", sourceName: "KLİMİK Derneği", url: "https://www.klimik.org.tr/feed/", branchSlugs: ["enfeksiyon"], limit: 10, category: "meslek", collectImages: false, filter: isAssociationRelevant },
  { source: "tjod", sourceName: "Türk Jinekoloji ve Obstetrik Derneği", url: "https://www.tjod.org/feed/", branchSlugs: ["kadin-dogum"], limit: 10, category: "meslek", collectImages: false, filter: isAssociationRelevant },
  { source: "tatd", sourceName: "Türkiye Acil Tıp Derneği", url: "https://tatd.org.tr/feed/", branchSlugs: ["acil-tip"], limit: 10, category: "meslek", collectImages: false, filter: isAssociationRelevant },
  { source: "tgd-gastro", sourceName: "Türk Gastroenteroloji Derneği", url: "https://tgd.org.tr/feed/", branchSlugs: ["gastroenteroloji"], limit: 10, category: "meslek", collectImages: false, filter: isAssociationRelevant },
  // 🪤 TGCD beslemesi dernek duyurusu ile HASTA bilgilendirme yazısını bir arada yayımlıyor
  //    ("Akalazya Nedir?", "Kapalı Akciğer Ameliyatları") — ikisini kendi kategorisiyle ayırıyor.
  //    Başlık deseni uydurmak yerine kaynağın BEYANI okunur (2026-08-19 ölçümü: 10 kalemin 5'i
  //    "Halk Sağlığı"). Doktorun akışında hasta-eğitim içeriğinin yeri yok.
  { source: "tgcd", sourceName: "Türk Göğüs Cerrahisi Derneği", url: "https://tgcd.org.tr/feed/", branchSlugs: ["gogus-cerrahisi"], limit: 12, category: "meslek", collectImages: false, filter: isAssociationRelevant, excludeCategories: ["Halk Sağlığı"] },
];

// ── İstanbul Tabip Odası (v6.99) ────────────────────────────────────────────

/**
 * İTO haber listesi. 🪤 /haberler sayfası haberleri JS ile yükler — statik HTML'de YOKTUR
 * (2026-08-15: sayfa 147 KB ama içinde üyelik SSS'i var). Liste, sayfanın kendi Ajax ucundan
 * gelir: POST views/haber/gethaber.view.php {Limit} → 50 haber bloğu (HTML parça).
 * Blok deseni: <h3 class="h5 …">başlık</h3> · özet <a href="#"> · gerçek link <a href="NNNN-slug.html">.
 * Tarih ayrı sütunda "14 / AUĞ. / 2026" biçiminde (kısaltmalar Türkçe ve NOKTALI).
 */
export async function ingestIstanbulTabip(opts?: IngestOpts): Promise<[number, number]> {
  const res = await fetch("https://www.istabip.org.tr/views/haber/gethaber.view.php", {
    method: "POST",
    headers: {
      ...browserHeaders("https://www.istabip.org.tr/haberler"),
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: "Limit=0",
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`İTO HTTP ${res.status}`);
  const html = await res.text();

  let scanned = 0;
  let created = 0;
  for (const block of html.split("</li>").slice(0, 30)) {
    const title = plain(/<h3[^>]*>([\s\S]*?)<\/h3>/i.exec(block)?.[1] ?? "");
    const slug = /href="(\d+-[^"]+\.html)"/i.exec(block)?.[1];
    if (!title || !slug || title.length < 15) continue;
    scanned++;
    if (!isProfessionallyRelevant(title, plain(block).slice(0, 400))) continue;
    const articleUrl = `https://www.istabip.org.tr/${slug}`;
    const isNew = await upsertArticle({
      source: "istabip",
      externalId: slug.slice(0, 180),
      module: "sektorel",
      category: categorize(title) ?? "meslek",
      kind: "haber",
      title: title.slice(0, 300),
      sourceName: "İstanbul Tabip Odası",
      url: articleUrl,
      publishedAt: parseItoDate(block) ?? new Date(),
    }, opts?.dryRun, () => fetchOgImage(articleUrl)); // görsel: haber sayfasının og:image'ı (v6.99.2)
    if (isNew) {
      created++;
      opts?.onItem?.(`[İTO] ${title.slice(0, 110)}`);
    }
  }
  return [scanned, created];
}

/** İTO tarih sütunu: gün + "AUĞ."/"OCA." gibi kısaltma + yıl. Çözülemezse null (bugüne düşer). */
export function parseItoDate(block: string): Date | null {
  const day = /g-font-size-50[^>]*>\s*(\d{1,2})\s*</.exec(block)?.[1];
  const rest = [...block.matchAll(/<span class="d-block">\s*([^<]+?)\s*<\/span>/g)].map((m) => m[1]);
  if (!day || rest.length < 2) return null;
  const mo = TR_MONTH_ABBR[rest[0].replace(/\./g, "").toLocaleLowerCase("tr-TR")];
  const year = /^\d{4}$/.test(rest[1]) ? rest[1] : null;
  if (!mo || !year) return null;
  return new Date(`${year}-${mo}-${day.padStart(2, "0")}T00:00:00Z`);
}

/** İTO'nun 3-4 harfli ay kısaltmaları (site "AUĞ." gibi yazıyor — TR_MONTHS ile eşleşmez). */
const TR_MONTH_ABBR: Record<string, string> = {
  oca: "01", şub: "02", sub: "02", mar: "03", nis: "04", may: "05", haz: "06",
  tem: "07", ağu: "08", agu: "08", auğ: "08", aug: "08", eyl: "09", eki: "10", kas: "11", ara: "12",
};

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
    let html: string;
    // v6.62: TTB'nin leaf-only TLS zinciri BELGE çekimini de düşürüyordu — v6.58 özel-CA onarımı
    // yalnız fihristteydi (ingestTtb); buradaki normal fetch Vercel'de UNABLE_TO_VERIFY_LEAF_SIGNATURE
    // ile null dönünce sektörel TTB haberlerinin özeti hiç üretilemiyordu. Aynı istemci kullanılır.
    const host = new URL(url).hostname;
    if (/(^|\.)ttb\.org\.tr$/i.test(host)) {
      const res = await httpsGetWithCa(url, TTB_INTERMEDIATE_CA);
      if (res.status !== 200) return null;
      html = res.body; // TTB utf-8 (windows-1254 tuzağı yalnız RG arşivi)
    } else if (/(^|\.)resmigazete\.gov\.tr$/i.test(host)) {
      // v6.94: RG de leaf-only zincire düştü (rg-ca.ts) — belge çekimi de özel-CA ister.
      const res = await httpsGetWithCa(url, RG_INTERMEDIATE_CA, "https://www.resmigazete.gov.tr/");
      if (res.status !== 200) return null;
      html = new TextDecoder(/\/eskiler\//i.test(url) ? "windows-1254" : "utf-8").decode(res.buf);
    } else {
      const res = await fetch(url, {
        // Alt-sayfa ziyareti: Referer = kaynağın kendi ana sayfası (bot korumasına doğal görünüm).
        headers: browserHeaders(new URL(url).origin + "/"), cache: "no-store",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) return null;
      html = await res.text(); // kalan kaynaklar (OHSAD vb.) utf-8 — RG artık bu daldan geçmez
    }
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
