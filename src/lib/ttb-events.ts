// TTB akredite etkinlik ingest ÇEKİRDEĞİ (v6.129) — scripts/ingest-ttb-events.ts'ten çıkarıldı.
//
// NEDEN LIB'E TAŞINDI: TTB kaydına düzenleyiciler etkinlikten en az 30 gün önce başvuruyor →
// kayıt tek seferlik dolumla değil PERİYODİK taramayla güncel kalır (v6.120 dersi). Vercel Hobby
// cron 2/2 dolu olduğu için tarama, günlük bakım nöbetine (purge-deleted rotası) HAFTALIK
// kontenjanla bindirildi — o rota bu modülü statik import eder. CLI script'i (dry-run/--prod
// korkuluklarıyla) ince kabuk olarak yaşamaya devam eder ve bu çekirdeği env kurulumundan SONRA
// dinamik import eder (db.ts bağlantıyı modül yüklenirken okur — hukuk-ingest ile aynı desen).
//
// KAYNAK: TTB STE/SMG Akreditasyon-Kredilendirme kaydı (https://kredilendirme.ttb.dr.tr).
// Kimlik istemez, açıktır. Araştırma ve alan haritası: vault `output/ste-kredilendirme-
// arastirmasi-2026-08-19.md`.
//
// ── KAYNAĞIN TUZAKLARI (araştırma §5.3; hepsi burada karşılanıyor) ─────────────
//  1. Arama yanıtı 50 kayıtta TAVAN yapar (tarihe göre azalan) → AY AY taranır.
//     Bir ay 50'ye dayanırsa uyarı düşülür (sessiz eksik ingest olmasın).
//  2. Kayıtta TEST satırları var ("Deneme" / "asdf asdf") → sezgisel elek.
//  3. Tür ADDAN çıkarılmaz, etkinlik kodu önekinden okunur (KNG/SMP/KRS…).
//  4. Program dakikaları ÇİFT sayılır → süreden kredi TÜRETİLMEZ; cmeCredit'e sayı YAZILMAZ.
//  5. Uzmanlık dizgesi ayraçla bölünemez (yan dal `•`, dal adında virgül) → sözlük taraması.
//  6. Kapsam ÜÇ değerli: Ulusal | Uluslararası | Uluslararası Katılımlı.
//
// Yazılan tek tablo MedicalCongress — PHI yok (kamuya açık etkinlik bilgisi).
import { db } from "./db";
import { BRANCHES } from "./triage";
import { EVENT_TYPE_BY_TTB } from "./doctorium";

const BASE = "https://kredilendirme.ttb.dr.tr";
const UA = "Mozilla/5.0 (compatible; AURA-Doctorium/1.0; +https://telehealth-mvp-roan.vercel.app)";
export const TTB_SOURCE = "ttb-kredilendirme";

// ── HTML yardımcıları ───────────────────────────────────────────────────────
const HTML_ENT: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " ",
};
function clean(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, (m) => HTML_ENT[m] ?? " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** dd.mm.yyyy → UTC gün başı Date. Geçersizse null (tarih ASLA tahmin edilmez). */
function trDate(s: string): Date | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const d = new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ── Test kaydı eleği ────────────────────────────────────────────────────────
// TTB kaydında gerçek test satırları var (KNF34495: ad "Deneme", yer "aadsf asdf").
// Eşik bilinçli DAR: yalnız apaçık çöp elenir — gerçek bir etkinliği sessizce düşürmek,
// bir çöp satırı göstermekten daha pahalı.
const COP_DESEN = /\b(asdf|qwer|zxcv|deneme\s*\d*|test\s*\d*)\b/i;
function testKaydiMi(e: { title: string; venue: string | null; chair: string | null }): boolean {
  if (e.title.trim().length < 5) return true;
  if (/^(deneme|test)$/i.test(e.title.trim())) return true;
  return COP_DESEN.test(e.venue ?? "") && COP_DESEN.test(e.chair ?? "");
}

// ── Branş eşlemesi ──────────────────────────────────────────────────────────
// TTB 106 uzmanlık dalı kullanıyor, bizde 35 branş var. Eşleşmeyen dal branşSIZ bırakılır
// ("[]" = tüm branşlarda görünür) — UYDURMA slug yazmak sessiz kayıptır.
const TR_LOWER = (s: string) => s.toLocaleLowerCase("tr");
const norm = (s: string) =>
  TR_LOWER(s).replace(/[çğıöşü]/g, (c) => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" }[c]!))
    .replace(/[^a-z0-9]+/g, " ").trim();

/** TTB dal adı → bizim slug. Yalnız GÜVENLİ eşlemeler; şüpheli olan yazılmaz. */
const TTB_ALIAS: Record<string, string> = {
  "acil tip": "acil-tip",
  "anesteziyoloji ve reanimasyon": "anesteziyoloji",
  "beyin ve sinir cerrahisi": "norosirurji",
  "cocuk sagligi ve hastaliklari": "cocuk-sagligi",
  "deri ve zuhrevi hastaliklari": "dermatoloji",
  "deri ve zuhrevi hastaliklar": "dermatoloji",
  // 🪤 Branş ETİKETİMİZ "Dermatoloji (Cilt Hastalıkları)" — TTB düz "Dermatoloji" yazınca
  //    etiket taraması tutmaz. Parantezli etiketi olan her branşın kısa adı burada olmalı.
  "dermatoloji": "dermatoloji",
  "ic hastaliklari uzmanligi": "dahiliye",
  "kulak burun bogaz": "kbb",
  "goz hastaliklari ve cerrahisi": "goz",
  "enfeksiyon hastaliklari ve klinik mikrobiyoloji": "enfeksiyon",
  "fiziksel tip ve rehabilitasyon": "fizik-tedavi",
  "gogus cerrahisi": "gogus-cerrahisi",
  "gogus hastaliklari": "gogus-hastaliklari",
  "goz hastaliklari": "goz",
  "genel cerrahi": "genel-cerrahi",
  "ic hastaliklari": "dahiliye",
  "kadin hastaliklari ve dogum": "kadin-dogum",
  "kalp ve damar cerrahisi": "kvc",
  "kardiyoloji": "kardiyoloji",
  "kulak burun bogaz hastaliklari": "kbb",
  "noroloji": "noroloji",
  "ortopedi ve travmatoloji": "ortopedi",
  "plastik rekonstruktif ve estetik cerrahi": "estetik",
  "radyasyon onkolojisi": "radyasyon-onkolojisi",
  "radyoloji": "radyoloji",
  "ruh sagligi ve hastaliklari": "psikiyatri",
  "psikiyatri": "psikiyatri",
  "tibbi genetik": "tibbi-genetik",
  "tibbi onkoloji": "onkoloji",
  "tibbi patoloji": "patoloji",
  "uroloji": "uroloji",
};

// 🪤 AYRAÇLA BÖLME ÇALIŞMAZ — ölçüldü (SMP34449): dallar virgülle ayrılıyor AMA "Plastik,
// Rekonstrüktif ve Estetik Cerrahi" dal adının KENDİSİNDE virgül var; yan dal ana dala
// U+2022 (•) ile bitişik. Çözüm: bölme yok, SÖZLÜK TARAMASI (uzundan kısaya, sözcük sınırıyla).
// Sınır şartı yan dal bulaşmasını da keser ("Çocuk Kardiyolojisi" içindeki "kardiyoloji" eşleşmez).
const DAL_SOZLUGU: [string, string][] = [
  ...Object.entries(TTB_ALIAS),
  ...BRANCHES.map((b2) => [norm(b2.label), b2.key] as [string, string]),
].sort((x, y) => y[0].length - x[0].length);

function branchSlugsFor(uzmanliklar: string | null, eslesmeyen: Map<string, number>): string[] {
  if (!uzmanliklar) return [];
  const hedef = norm(uzmanliklar);
  const out = new Set<string>();
  for (const [ad, slug] of DAL_SOZLUGU) {
    if (new RegExp(`(^|[^a-z0-9])${ad}([^a-z0-9]|$)`).test(hedef)) out.add(slug);
  }
  if (!out.size) {
    const k = uzmanliklar.trim().slice(0, 120);
    eslesmeyen.set(k, (eslesmeyen.get(k) ?? 0) + 1);
  }
  return [...out];
}

// ── Kapsam ──────────────────────────────────────────────────────────────────
function scopeFor(kapsam: string | null): string {
  const n = norm(kapsam ?? "");
  if (n.includes("katilimli")) return "uluslararasi-katilimli";
  if (n.includes("uluslararasi")) return "uluslararasi";
  return "ulusal";
}

// ── Ağ ──────────────────────────────────────────────────────────────────────
async function post(path: string, form: Record<string, string>): Promise<string> {
  const res = await fetch(`${BASE}/${path}`, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Requested-With": "XMLHttpRequest",
      Referer: `${BASE}/etkinlik_bul.php`,
    },
    body: new URLSearchParams(form).toString(),
  });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return res.text();
}

async function get(path: string): Promise<string> {
  const res = await fetch(`${BASE}/${path}`, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return res.text();
}

// ── Liste ayrıştırma ────────────────────────────────────────────────────────
// ⚠️ `s` (dotAll) bayrağı YOK: tsconfig target'ı es2018 altı, `next build` bunu tip hatası yapar.
const ROW_RE =
  /Id=(\d+)">([A-Z]{3})(\d+)<\/a>\s*<br>\s*<a[^>]*>([\s\S]*?)<\/a>\s*<br>\s*<small>\s*([\s\S]*?)\s*-\s*\(\s*([\d.]+)\s*-\s*([\d.]+)\s*\)/g;

interface ListRow {
  id: string; kod: string; onek: string; title: string; city: string; bas: string; son: string;
}

function parseList(html: string): ListRow[] {
  const out: ListRow[] = [];
  for (const m of html.matchAll(ROW_RE)) {
    out.push({
      id: m[1], kod: m[2] + m[3], onek: m[2],
      title: clean(m[4]), city: clean(m[5]), bas: m[6], son: m[7],
    });
  }
  return out;
}

// ── Detay ayrıştırma ────────────────────────────────────────────────────────
/** Detay sayfası "etiket → değer" çiftlerini <label>/<div> olarak basar; sırayla okuruz. */
function parseDetail(html: string): Record<string, string> {
  const govde = html.slice(html.indexOf("ETKİNLİK DETAYI"));
  const bas = govde.slice(0, govde.indexOf("ETKİNLİK PROGRAMI") + 1 || undefined);
  const parcalar = bas
    .split(/<\/?div[^>]*>|<\/?label[^>]*>/)
    .map(clean)
    .filter((p) => p && p !== "ETKİNLİK DETAYI");
  const out: Record<string, string> = {};
  const ETIKETLER = ["Etkinlik Kodu", "Etkinlik Adı", "Düzenleyen Yapı", "Şehir/İlçe", "Yeri",
    "Başlama/Bitiş Trh.", "Türü", "Kapsamı", "Uzmanlıklar", "Kurul Başkanı"];
  for (const e of ETIKETLER) {
    const i = parcalar.indexOf(e);
    if (i >= 0 && parcalar[i + 1] && !ETIKETLER.includes(parcalar[i + 1])) out[e] = parcalar[i + 1];
  }
  return out;
}

// ── Ay penceresi ────────────────────────────────────────────────────────────
function aylar(fromYm: string, toYm: string): [string, string][] {
  const [fy, fm] = fromYm.split("-").map(Number);
  const [ty, tm] = toYm.split("-").map(Number);
  const out: [string, string][] = [];
  for (let y = fy, m = fm; y < ty || (y === ty && m <= tm); m === 12 ? (m = 1, y++) : m++) {
    const sonGun = new Date(Date.UTC(y, m, 0)).getUTCDate();
    out.push([`01.${String(m).padStart(2, "0")}.${y}`, `${sonGun}.${String(m).padStart(2, "0")}.${y}`]);
  }
  return out;
}

// ── Sonuç tipi ──────────────────────────────────────────────────────────────
export interface TtbEventsResult {
  months: number;
  found: number;      // listede bulunan etkinlik
  prepared: number;   // elekler sonrası yazıma hazır kayıt
  created: number;
  updated: number;
  adopted: number;    // ttbCode çipasıyla birleşmiş satıra devredilen
  skippedTest: number;
  skippedNoDate: number;
  skippedUnknownType: number;
  cappedMonths: number; // 50 kayıt tavanına çarpan ay (eksik tarama şüphesi)
  /** Hiçbir branşa bağlanamayan uzmanlık dizgeleri (en sık 15) — TTB_ALIAS'a eklenebilir. */
  unmatchedSpecialties: string[];
  warnings: string[];
  /** dryRun'da ilk 10 kayıt özeti (yazım YOK). */
  sample?: string[];
}

export interface TtbEventsOpts {
  /** "YYYY-MM" — verilmezse geçmiş 6 ay (CLI varsayılanı; cron daha dar pencere verir). */
  fromYm?: string;
  /** "YYYY-MM" — verilmezse gelecek 18 ay. */
  toYm?: string;
  dryRun?: boolean;
  onLog?: (line: string) => void;
}

/**
 * TTB kaydını ay ay tarar, MedicalCongress'e idempotent yazar (source="ttb-kredilendirme").
 * Küratörlü veriyi EZMEZ: (source, externalId) ayrı yaşar; merge-congress-sources'un yazdığı
 * ttbCode ÇİPASI sayesinde birleştirilmiş satır yeniden yaratılmaz (aşağıda "🔗 ÇİPA").
 */
export async function ingestTtbEvents(opts: TtbEventsOpts = {}): Promise<TtbEventsResult> {
  const log = opts.onLog ?? (() => {});
  const now = new Date();
  const ym = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  // Varsayılan pencere (CLI): geçmiş 6 ay + gelecek 18 ay — doktor katıldığı etkinliği geriye
  // dönük arayabilmeli (ileride STE puan defteri buna bağlanır).
  const from = opts.fromYm ?? ym(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 6, 1)));
  const to = opts.toYm ?? ym(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 18, 1)));
  const pencere = aylar(from, to);
  log(`📅 Pencere: ${from} → ${to} (${pencere.length} ay)`);

  const out: TtbEventsResult = {
    months: pencere.length, found: 0, prepared: 0, created: 0, updated: 0, adopted: 0,
    skippedTest: 0, skippedNoDate: 0, skippedUnknownType: 0, cappedMonths: 0,
    unmatchedSpecialties: [], warnings: [],
  };
  const eslesmeyenDallar = new Map<string, number>();

  // 1) Liste taraması (ay ay — 50 kayıtlık tavan yüzünden)
  const bulunan = new Map<string, ListRow>();
  for (const [bas, son] of pencere) {
    let rows: ListRow[] = [];
    try {
      rows = parseList(await post("etkinlik_bul_ok.php", {
        TarihBas: bas, TarihSon: son, Adi: "", SehirId: "0", IlceId: "0", UzmanlikId: "0", Bos: "0",
      }));
    } catch (e) {
      const msg = `${bas} taranamadı: ${e instanceof Error ? e.message : e}`;
      out.warnings.push(msg);
      log(`  ⚠️ ${msg}`);
      continue;
    }
    if (rows.length >= 50) {
      out.cappedMonths++;
      const msg = `${bas}: 50 kayıt TAVANI — bu ay EKSİK taranmış olabilir (gün gün bölün).`;
      out.warnings.push(msg);
      log(`  🚨 ${msg}`);
    }
    for (const r of rows) bulunan.set(r.id, r);
  }
  out.found = bulunan.size;
  log(`🔎 Listede ${bulunan.size} etkinlik bulundu${out.cappedMonths ? ` (${out.cappedMonths} ay tavana çarptı!)` : ""}`);

  // 2) Detay + normalizasyon
  const kayitlar: {
    externalId: string; ttbCode: string; eventType: string; title: string;
    organizer: string | null; city: string | null; venue: string | null;
    startDate: Date; endDate: Date | null; scope: string; branchSlugs: string[];
  }[] = [];

  for (const r of bulunan.values()) {
    const startDate = trDate(r.bas);
    if (!startDate) { out.skippedNoDate++; continue; } // tarih uydurulmaz — kayıt atlanır
    const eventType = EVENT_TYPE_BY_TTB[r.onek];
    if (!eventType) {
      // TTB yeni bir kod öneki eklemiş olabilir → SESSİZ atlamak yerine uyar.
      out.skippedUnknownType++;
      const msg = `Bilinmeyen tür öneki "${r.onek}" (${r.kod}) — EVENT_TYPES'a eklenmeli, kayıt atlandı.`;
      out.warnings.push(msg);
      log(`  ⚠️ ${msg}`);
      continue;
    }

    let d: Record<string, string> = {};
    try {
      d = parseDetail(await get(`etkinlik_detay.php?Id=${r.id}`));
    } catch {
      /* detay alınamadı — liste verisiyle devam (ad/tarih/şehir zaten var) */
    }

    const aday = {
      title: d["Etkinlik Adı"] || r.title,
      venue: d["Yeri"] || null,
      chair: d["Kurul Başkanı"] || null,
    };
    if (testKaydiMi(aday)) { out.skippedTest++; continue; }

    kayitlar.push({
      externalId: r.id,
      ttbCode: r.kod,
      eventType,
      title: aday.title.slice(0, 300),
      organizer: d["Düzenleyen Yapı"]?.slice(0, 200) || null,
      city: (d["Şehir/İlçe"]?.split("-")[0]?.trim() || r.city || null)?.slice(0, 100) ?? null,
      venue: aday.venue?.slice(0, 200) ?? null,
      startDate,
      endDate: trDate(r.son),
      scope: scopeFor(d["Kapsamı"] ?? null),
      branchSlugs: branchSlugsFor(d["Uzmanlıklar"] ?? null, eslesmeyenDallar),
    });
  }
  out.prepared = kayitlar.length;
  out.unmatchedSpecialties = [...eslesmeyenDallar.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 15).map(([ad, n]) => `${n}× ${ad}`);
  log(`✅ ${kayitlar.length} kayıt hazır · ${out.skippedTest} test elendi · ${out.skippedNoDate} tarihsiz · ${out.skippedUnknownType} tür bilinmiyor`);

  if (opts.dryRun) {
    out.sample = kayitlar.slice(0, 10).map((k) =>
      `[${k.eventType}] ${k.ttbCode} ${k.title.slice(0, 60)} · ${k.city ?? "?"} · ${k.scope} · branş: ${k.branchSlugs.join(",") || "(tümü)"}`);
    return out;
  }

  // 3) Yazma — idempotent upsert (source, externalId) + ttbCode ÇİPASI (v6.121)
  for (const k of kayitlar) {
    const data = {
      title: k.title, organizer: k.organizer, city: k.city, venue: k.venue,
      startDate: k.startDate, endDate: k.endDate, scope: k.scope,
      eventType: k.eventType, ttbCode: k.ttbCode,
      branchSlugs: JSON.stringify(k.branchSlugs),
      // Kredi NOTU: yalnız akreditasyon beyanı — SAYI YOK (puan katılım süresine göre TTB
      // kaydında oluşur; program dakikaları çift sayıldığı için türetilemez de).
      cmeCredit: `TTB akredite (${k.ttbCode})`,
      confidence: "dogrulandi",
      verifiedAt: new Date(),
      sourceUrls: JSON.stringify([`${BASE}/etkinlik_detay.php?Id=${k.externalId}`]),
    };
    const mevcut = await db.medicalCongress.findUnique({
      where: { source_externalId: { source: TTB_SOURCE, externalId: k.externalId } },
      select: { id: true },
    });
    if (mevcut) {
      await db.medicalCongress.update({ where: { id: mevcut.id }, data });
      out.updated++;
      continue;
    }

    // 🔗 ÇİPA (v6.121) — bu etkinlik BAŞKA bir kaynakta (küratörlü/elle) zaten duruyor olabilir.
    // merge-congress-sources.ts kaynaklar arası çifti birleştirirken ttbCode'u kalan satıra
    // yazar ve TTB satırını SİLER. Burada yalnız (source, externalId)'ye baksaydık silinen
    // satırı yeniden yaratır, çift kaydı geri getirirdik. Çipa akreditasyon kodunun kendisidir
    // (doğal anahtar): yeni şema alanı, migration ya da okuma yolu değişikliği gerekmez.
    // ⚠️ Sahiplenilmiş satıra YALNIZ TTB'ye ait alanlar yazılır. Küratörlü gövde (bildiri
    //    tarihi, kayıt ücreti, temalar, url, dil, kapak…) TTB'de TAMAMEN boştur; `data`yı
    //    olduğu gibi yazmak o gövdeyi silerdi.
    // `scope`/`eventType` BURADAN tazelenir (kullanıcı kararı 2026-08-19: TTB bu ikisinde yetkili).
    const sahiplenen = await db.medicalCongress.findFirst({
      where: { ttbCode: k.ttbCode, source: { not: TTB_SOURCE } },
      select: { id: true, cmeCredit: true },
    });
    if (sahiplenen) {
      await db.medicalCongress.update({
        where: { id: sahiplenen.id },
        data: {
          eventType: k.eventType,
          scope: k.scope,
          // cmeCredit yalnız BOŞSA doldurulur: küratörlü kredi metni TTB'nin tek satırlık
          // beyanından zengin (ölçüldü — 5 çiftin 3'ünde).
          ...(sahiplenen.cmeCredit ? {} : { cmeCredit: data.cmeCredit }),
          verifiedAt: data.verifiedAt,
        },
      });
      out.adopted++;
      continue;
    }

    await db.medicalCongress.create({ data: { source: TTB_SOURCE, externalId: k.externalId, ...data } });
    out.created++;
  }
  log(`💾 Yazıldı — ${out.created} yeni · ${out.updated} güncellendi · ${out.adopted} birleştirilmiş satıra devredildi`);
  return out;
}
