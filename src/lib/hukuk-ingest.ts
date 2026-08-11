// Hukuk modülü — İçtihat toplama: Yargıtay Karar Arama (v6.86, 2026-08-06).
//
// Kaynak: karararama.yargitay.gov.tr — resmî arama arayüzünün arka JSON uçları. Resmî/belgeli bir
// API DEĞİLDİR; sözleşme 2026-08-06 canlı ölçümüyle çıkarıldı (fizibilite raporu:
// vault output/doctorium-hukuk-plani-2026-08-06.md). Yargı kararlarının çoğaltılıp yayılması
// FSEK m.31 gereği serbesttir; metinler kaynakta anonimleştirilmiş gelir (PHI/kimlik yok).
//
// Ölçülmüş davranışlar (koda gömülü varsayımlar — biri değişirse önce burayı güncelle):
//   • POST /aramalist gövdesi TAM alan şablonu ister (boş string'ler dahil); eksik alan hata
//     vermez ama bazı filtreler işlenmez. Tarih filtresi (baslangicTarihi/bitisTarihi) sunucuda
//     ZATEN İŞLENMİYOR (sitenin kendisinde de) → artımlı toplama tarihle DEĞİL, (source,
//     externalId) idempotenciyle yapılır; sorgu başına sonuç kümeleri küçük (≤~100).
//   • Tırnaklı sorgu = tam ibare ("tıbbi malpraktis" → 9); tırnaksız çok kelime GEVŞEK eşleşir
//     (54.852!) → sorgular tırnak disipliniyle yazılır.
//   • Sunucu yoğun istekte CAPTCHA isteyebilir (yanıtta "DisplayCaptcha") → istekler arası
//     GAP_MS bekleme + ilk hatada koşuyu kesme (kalan ertesi koşuya; idempotent devam).
//   • GET /getDokuman?id= karar TAM metnini JSON içinde HTML olarak döndürür.
//
// Cron bütçesi: purge-deleted (günlük bakım nöbeti) çağırır; koşu başına en fazla
// MAX_DOC_FETCH_DEFAULT yeni kararın metni çekilir (maxDuration'ı yeni işle zorlamamak için).
// İlk dolum (~yüzlerce metin) cron'a SIĞMAZ → scripts/ingest-yargitay.ts yerelden koşulur.
//
// ⚠️ Bu dosya doctorium-ingest.ts'ten BAĞIMSIZ tutuldu (2026-08-06: o dosyada paralel oturumun
// v6.85 çalışması sürüyordu; ayrıca kaynak/desen farkı ayrı dosyayı zaten hak ediyor).
import { db } from "./db";

const BASE = "https://karararama.yargitay.gov.tr";
// 2026-08-06 saha ölçümü: GAP 1 sn iken ~18-20 istek sonrası HTTP 429 geldi → 2,5 sn'ye çekildi
// ve 429'da BİR kez uzun bekleyip yeniden denenir (RATE_WAIT_MS); ikinci 429 koşuyu keser.
export const GAP_MS = 2500;
const RATE_WAIT_MS = 65_000; // 429 sonrası soğuma — ilk dolum script'i tek koşuda bitebilsin
const PAGE_SIZE = 10; // canlıda doğrulanan değer — büyütmeden önce sahada test et
const MAX_PAGES_PER_QUERY = 40; // emniyet tavanı (400 kayıt/sorgu) — runaway sayfalama olmasın
const MAX_DOC_FETCH_DEFAULT = 20; // cron koşusu başına yeni metin tavanı
const SUMMARY_MAX = 20_000; // karar metni tavanı (tipik 3-15K; aşırı uzun kararlar kırpılır)
// 2026-08-06 ilk dolum sahası: 15 sn'de tek belge isteği zaman aşımına düştü ve koşuyu kesti
// (493 karardan 17'de kaldı) → 30 sn + tekil hatayı atlayıp ARDIŞIK eşikte durma (aşağıda).
const FETCH_TIMEOUT_MS = 30_000;
const MAX_CONSECUTIVE_FAILS = 3; // tek kararın sorunu koşuyu öldürmesin; gerçek kesinti durdursun
const CRON_QUERIES_PER_DAY = 2; // cron rotasyonu: günde 2 sorgu → tam tur ~4 günde (aşağıya bak)

// Sorgu seti — hukukçu onaylı çekirdek (2026-08-06). Genişletirken: tam ibareler TIRNAKLI,
// tek başına geniş terim ("komplikasyon" gibi) EKLENMEZ; yeni sorgu önce sitede elle denenir
// (sonuç sayısı yüzler mertebesini aşıyorsa daraltılır).
export const YARGITAY_QUERIES: string[] = [
  "malpraktis",
  '"tıbbi malpraktis"',
  '"hekimin özen yükümlülüğü"',
  '"tıbbi uygulama hatası"',
  '"aydınlatılmış onam"',
  '"hekimin hukuki sorumluluğu"',
  '"komplikasyon yönetimi"',
];

interface KararMeta {
  id: string;
  daire: string;
  esasNo: string;
  kararNo: string;
  kararTarihi: string; // "02.04.2015" (dd.MM.yyyy)
}

export interface YargitayIngestResult {
  /** Sorguların döndürdüğü benzersiz karar sayısı (DB'de olanlar dahil). */
  found: number;
  /** Bu koşuda yeni yazılan kayıt. */
  created: number;
  /** Tavan nedeniyle metni SONRAKİ koşuya kalan yeni karar. */
  deferred: number;
  errors: string[];
}

function short(e: unknown): string {
  return (e instanceof Error ? e.message : String(e)).slice(0, 140);
}

/** Ölçülen sözleşme: sunucu TAM alan şablonu bekler — boş alanlar dahil gönderilir. */
function searchPayload(query: string, pageNumber: number): string {
  return JSON.stringify({
    data: {
      arananKelime: query,
      esasYil: "", esasIlkSiraNo: "", esasSonSiraNo: "",
      kararYil: "", kararIlkSiraNo: "", kararSonSiraNo: "",
      baslangicTarihi: "", bitisTarihi: "",
      siralama: "1", siralamaDirection: "desc",
      birimYrgKurulDaire: "", birimYrgHukukDaire: "", birimYrgCezaDaire: "",
      pageSize: PAGE_SIZE, pageNumber,
    },
  });
}

/**
 * HTTP çağrısı + 429 soğuması: hız sınırında BİR kez RATE_WAIT_MS bekleyip aynı istek yinelenir;
 * ikinci 429 fırlatılır (çağıran koşuyu keser — kalan ertesi koşuya, idempotent devam).
 */
async function request(url: string, init: RequestInit): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (res.status === 429 && attempt === 0) {
      await new Promise((r) => setTimeout(r, RATE_WAIT_MS));
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
}

async function post(path: string, body: string): Promise<unknown> {
  return request(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // Kanıt: UA'sız da 200 veriyor; yine de sıradan tarayıcı UA'sı ile gidiyoruz (HealthTürkiye
      // dersinin tersinden okunuşu — kamu uçları UA'ya duyarlı olabiliyor, davranışı sabitle).
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      Accept: "application/json",
    },
    body,
  });
}

interface Zarf {
  data?: unknown;
  // CAPTCHA sinyali sitenin JS'inde zarfın KÖKÜNDEN okunuyor (data.detailMessage); metadata
  // varyantı da savunmacı olarak taranır — gerçek CAPTCHA yanıtı canlıda henüz gözlemlenmedi.
  detailMessage?: string | null;
  metadata?: { FMTY?: string; detailMessage?: string | null };
}

/** Sunucu zarfını aç; ERROR/CAPTCHA'yı fırlat ki çağıran koşuyu nazikçe kessin. */
function unwrap(j: unknown, ctx: string): unknown {
  const z = j as Zarf;
  const fmty = z?.metadata?.FMTY;
  if (fmty !== "SUCCESS") {
    const detail = `${z?.detailMessage ?? ""} ${z?.metadata?.detailMessage ?? ""}`;
    const captcha = detail.includes("DisplayCaptcha");
    throw new Error(captcha ? `${ctx}: CAPTCHA istendi — koşu kesildi` : `${ctx}: FMTY=${fmty ?? "yok"}`);
  }
  return z.data;
}

/** Tek sayfa arama. total = sorgunun tüm sonuç sayısı. */
export async function searchYargitay(query: string, pageNumber: number): Promise<{ total: number; records: KararMeta[] }> {
  const data = unwrap(await post("/aramalist", searchPayload(query, pageNumber)), "aramalist") as {
    data?: unknown[]; recordsTotal?: number;
  };
  const records: KararMeta[] = [];
  for (const r of data?.data ?? []) {
    const k = r as Partial<KararMeta>;
    if (k.id && k.daire && k.esasNo && k.kararNo && k.kararTarihi) {
      records.push({ id: k.id, daire: k.daire, esasNo: k.esasNo, kararNo: k.kararNo, kararTarihi: k.kararTarihi });
    }
  }
  return { total: data?.recordsTotal ?? 0, records };
}

/** Karar tam metni (HTML) → sıyrılmış düz metin. */
export async function fetchKararText(id: string): Promise<string | null> {
  const j = await request(`${BASE}/getDokuman?id=${encodeURIComponent(id)}`, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
  });
  const html = unwrap(j, "getDokuman");
  return typeof html === "string" ? stripKararHtml(html) : null;
}

/**
 * Cron rotasyonu: her koşuda TÜM sorguları taramak istek bütçesini şişiriyordu (7 sorgu × ~4 sayfa
 * arama + metinler — 429'un tam tetikçisi). Günün indeksine göre CRON_QUERIES_PER_DAY sorgu seçilir;
 * tam tur ~4 günde döner — içtihat üretim hızı (yılda ~onlarca yeni karar) için fazlasıyla taze.
 * İlk dolum bu rotasyona takılmaz: scripts/ingest-yargitay.ts sorguların tamamını açıkça verir.
 */
export function queriesForToday(now = new Date()): string[] {
  const dayIndex = Math.floor(now.getTime() / 86_400_000);
  const start = (dayIndex * CRON_QUERIES_PER_DAY) % YARGITAY_QUERIES.length;
  return Array.from(
    { length: Math.min(CRON_QUERIES_PER_DAY, YARGITAY_QUERIES.length) },
    (_, i) => YARGITAY_QUERIES[(start + i) % YARGITAY_QUERIES.length],
  );
}

/**
 * Karar HTML'i → okunur düz metin. Parser bilinçli YOK (doctorium-ingest abstract deseniyle aynı
 * gerekçe): kaynak şablonu dar ve öngörülebilir; başarısızlık = null, uydurma değil.
 */
export function stripKararHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|ul|li|div)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** "02.04.2015" (dd.MM.yyyy) → UTC Date. Bozuk/eksik tarih null (kayıt atlanır, uydurulmaz). */
export function parseKararDate(s: string | undefined): Date | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec((s ?? "").trim());
  if (!m) return null;
  const d = new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function buildKararTitle(k: Pick<KararMeta, "daire" | "esasNo" | "kararNo">): string {
  return `Yargıtay ${k.daire} · E. ${k.esasNo}, K. ${k.kararNo}`;
}

/**
 * Yargıtay içtihat toplama — idempotent. Sorgular gezilir, benzersiz kararlar DB ile karşılaştırılır,
 * yalnız YENİ olanların metni çekilip yazılır (koşu başına maxDocFetch tavanıyla; kalan `deferred`
 * sayılır ve ertesi koşuda kendiliğinden alınır). İlk hata/CAPTCHA koşuyu keser — kısmi ilerleme
 * kalıcıdır, kayıp yoktur.
 */
export async function ingestYargitay(opts: { maxDocFetch?: number; queries?: string[] } = {}): Promise<YargitayIngestResult> {
  const maxDocFetch = opts.maxDocFetch ?? MAX_DOC_FETCH_DEFAULT;
  // queries verilmezse (cron yolu) günlük rotasyon; tam tarama isteyen script açıkça verir.
  const queries = opts.queries ?? queriesForToday();
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const out: YargitayIngestResult = { found: 0, created: 0, deferred: 0, errors: [] };

  // 1) Arama: benzersiz karar havuzu (aynı karar birden çok sorguda çıkar — Map dedupe).
  const pool = new Map<string, KararMeta>();
  for (const q of queries) {
    try {
      const first = await searchYargitay(q, 1);
      for (const r of first.records) pool.set(r.id, r);
      const pages = Math.min(Math.ceil(first.total / PAGE_SIZE), MAX_PAGES_PER_QUERY);
      for (let p = 2; p <= pages; p++) {
        await sleep(GAP_MS);
        const { records } = await searchYargitay(q, p);
        for (const r of records) pool.set(r.id, r);
      }
    } catch (e) {
      out.errors.push(`arama "${q}": ${short(e)}`);
      break; // nazik geri çekilme: CAPTCHA/ağ hatasında kalan sorgular ertesi koşuya
    }
    await sleep(GAP_MS);
  }
  out.found = pool.size;
  if (!pool.size) return out;

  // 2) DB'de zaten olanlar (metin isteği israf edilmez).
  const ids = [...pool.keys()];
  const existing = await db.newsArticle.findMany({
    where: { source: "yargitay", externalId: { in: ids } },
    select: { externalId: true },
  });
  const known = new Set(existing.map((r) => r.externalId));
  const fresh = ids.filter((id) => !known.has(id));

  // 3) Yeni kararların metni + kayıt. Tavan: cron bütçesi (kalan idempotent devirle alınır).
  const batch = fresh.slice(0, maxDocFetch);
  out.deferred = fresh.length - batch.length;
  let consecutiveFails = 0; // 2026-08-06 sahası: TEK timeout koşuyu kesiyordu (493'te 17) → eşikli
  for (const id of batch) {
    const meta = pool.get(id)!;
    const publishedAt = parseKararDate(meta.kararTarihi);
    if (!publishedAt) {
      out.errors.push(`karar ${id}: tarih çözülemedi (${meta.kararTarihi})`);
      continue;
    }
    try {
      await sleep(GAP_MS);
      const text = await fetchKararText(id);
      if (!text || text.length < 200) {
        // Metinsiz/anlamsız kısa içerik yazılmaz — "uydurma içerik yok" ilkesi.
        // İstek BAŞARILI döndü (içerik sorunu, ağ değil) → ardışık-hata sayacı sıfırlanır.
        out.errors.push(`karar ${id}: metin boş/kısa`);
        consecutiveFails = 0;
        continue;
      }
      await db.newsArticle.create({
        data: {
          source: "yargitay",
          externalId: id,
          module: "mevzuat", // iç anahtar — kullanıcı yüzünde "Hukuk" (lib/doctorium.ts)
          category: "ictihat",
          branchSlugs: "[]", // metinden branş çıkarımı bilinçli YOK (uydurma riski) — genel akış
          kind: "ictihat",
          title: buildKararTitle(meta),
          summary: text.slice(0, SUMMARY_MAX),
          sourceName: `Yargıtay — ${meta.daire}`,
          // SPA'da karara kalıcı derin link YOK → url null; arayüz E./K. ile resmî sistemde
          // doğrulama yönergesi gösterir ([id]/page.tsx).
          url: null,
          publishedAt,
        },
      });
      out.created++;
      consecutiveFails = 0;
    } catch (e) {
      // Benzersizlik yarışı (cron + yerel script eşzamanlı): P2002 sessizce atlanır — kayıt zaten var.
      if ((e as { code?: string })?.code === "P2002") continue;
      out.errors.push(`karar ${id}: ${short(e)}`);
      // Tekil hata (tek belgenin yavaşlığı/bozukluğu) atlanır; ARDIŞIK eşik gerçek kesinti sayılır.
      if (++consecutiveFails >= MAX_CONSECUTIVE_FAILS) break;
    }
  }
  return out;
}
