// TTB akredite etkinlik ingest'i (v6.120) — kalıcı araç.
//
// KAYNAK: TTB STE/SMG Akreditasyon-Kredilendirme kaydı (https://kredilendirme.ttb.dr.tr).
// Kimlik istemez, açıktır, sorgulanabilir. Araştırma ve alan haritası:
// vault `output/ste-kredilendirme-arastirmasi-2026-08-19.md`.
//
// ⚠️ Bu, MedicalCongress modelindeki "otomatik kaynak YOK" varsayımının düzeltmesidir:
// dernek siteleri makine-okunur takvim yayımlamıyor ama KREDİLENDİRME OTORİTESİ yayımlıyor.
// Küratörlü veri (source="curated") tamamlayıcıdır, bu ingest onu EZMEZ — source değerleri
// ayrı olduğu için (source, externalId) unique'i ikisini çakıştırmaz.
// ⚠️ Ama tam da bu yüzden AYNI etkinlik iki kaynaktan iki SATIR olabilir (v6.120'de yaşandı:
//    "35. Ulusal Patoloji Kongresi" doktorun listesinde iki kart). Kaynaklar arası eşleştirme
//    ayrı bir araçtadır: scripts/merge-congress-sources.ts. O araç birleştirdiğinde ttbCode'u
//    kalan satıra ÇİPA olarak yazar; aşağıdaki yazma döngüsü çipayı sorar ve silinmiş TTB
//    satırını yeniden YARATMAZ (bkz. "🔗 ÇİPA"). Koşum sırası: seed → BU SCRIPT → merge.
//
// ── KAYNAĞIN TUZAKLARI (araştırma §5.3; hepsi burada karşılanıyor) ─────────────
//  1. Arama yanıtı 50 kayıtta TAVAN yapar (tarihe göre azalan) → AY AY taranır.
//     Bir ay 50'ye dayanırsa uyarı basılır (sessiz eksik ingest olmasın).
//  2. Kayıtta TEST satırları var ("Deneme" / "asdf asdf") → sezgisel elek.
//  3. Tür ADDAN çıkarılmaz, etkinlik kodu önekinden okunur (KNG/SMP/KRS…).
//     TTB'de "8. Pulmoner Vasküler Hastalıklar Kongresi" SEMPOZYUM kayıtlıdır.
//  4. Program dakikaları ÇİFT sayılır (üst oturum + alt oturumları ayrı satır) →
//     süreden kredi TÜRETİLMEZ. cmeCredit'e sayı YAZILMAZ, yalnız "TTB akredite (kod)".
//  5. Uzmanlık etiketlerinde yan dal özel bir tire ile bitişik ("Radyoloji—Nöroradyoloji").
//  6. Kapsam ÜÇ değerli: Ulusal | Uluslararası | Uluslararası Katılımlı.
//
// GÜVENLİK: seed-congresses.ts ile aynı korkuluk deseni —
//   • Varsayılan DRY-RUN (yazma için --yaz)
//   • Prod YALNIZ --prod + ayrı PROD_DATABASE_URL env'i
//   • --prod'suz DATABASE_URL prod parmak izine uyuyorsa DURUR
// Yazılan tek tablo MedicalCongress — PHI yok (kamuya açık etkinlik bilgisi).
//
// Kullanım:
//   npx tsx scripts/ingest-ttb-events.ts                     → DEV dry-run (varsayılan pencere)
//   npx tsx scripts/ingest-ttb-events.ts --yaz               → DEV'e yaz
//   npx tsx scripts/ingest-ttb-events.ts --from=2024-01 --to=2026-12 --yaz
//   npx tsx scripts/ingest-ttb-events.ts --prod --yaz        → PROD'a yaz
import "dotenv/config";
// ⚠️ lib/doctorium STATİK import EDİLMEZ: db.ts'i çeker ve db env'i modül yüklenirken okur —
// --prod anahtarı DATABASE_URL'i main() içinde değiştirdiği için statik import yanlış veritabanına
// bağlanırdı (seed-congresses.ts ile aynı ders). Dinamik import main() içinde.
// lib/triage import'suz saf veri (kontrol edildi) → statik güvenli.
import { BRANCHES } from "../src/lib/triage";

const args = process.argv.slice(2);
const DRY = !args.includes("--yaz");
const PROD = args.includes("--prod");
const argVal = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

const BASE = "https://kredilendirme.ttb.dr.tr";
const UA = "Mozilla/5.0 (compatible; AURA-Doctorium/1.0; +https://telehealth-mvp-roan.vercel.app)";
const SOURCE = "ttb-kredilendirme";

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
// TTB kaydında gerçek test satırları var (KNF34495: ad "Deneme", yer "aadsf asdf",
// kurul başkanı "Dr. asdf asdf"). Bunlar doktorun takvimine düşerse güven kaybı olur.
// Eşik bilinçli DAR: yalnız apaçık çöp elenir, şüpheliyi ALIKOYUP loglarız — gerçek bir
// etkinliği sessizce düşürmek, bir çöp satırı göstermekten daha pahalı.
const COP_DESEN = /\b(asdf|qwer|zxcv|deneme\s*\d*|test\s*\d*)\b/i;
function testKaydiMi(e: { title: string; venue: string | null; chair: string | null }): boolean {
  if (e.title.trim().length < 5) return true;
  if (/^(deneme|test)$/i.test(e.title.trim())) return true;
  // Ad TEMİZ ama yer VE başkan birlikte çöpse: klavye-gürültüsü kaydı.
  return COP_DESEN.test(e.venue ?? "") && COP_DESEN.test(e.chair ?? "");
}

// ── Branş eşlemesi ──────────────────────────────────────────────────────────
// TTB 106 uzmanlık dalı kullanıyor, bizde 35 branş var. Eşleşmeyen dal branşSIZ bırakılır
// ("[]" = tüm branşlarda görünür) — UYDURMA slug yazmak sessiz kayıptır: upcomingCongresses
// branş süzgeci ve parseBranchPrefs bilinmeyen slug'ı atar, kayıt DB'de durur ama hiçbir
// doktora görünmez, hata da vermez (bkz. lib/triage.ts doktor-only branş notu).
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

const eslesmeyenDallar = new Map<string, number>();

// 🪤 AYRAÇLA BÖLME ÇALIŞMAZ — ölçüldü (SMP34449):
//   "Beyin ve Sinir Cerrahisi, Halk Sağlığı•İşyeri Hekimliği, Ortopedi ve Travmatoloji•El
//    Cerrahisi, Plastik, Rekonstrüktif ve Estetik Cerrahi, ..."
//   • Dallar VİRGÜLLE ayrılıyor AMA "Plastik, Rekonstrüktif ve Estetik Cerrahi" dal adının
//     KENDİSİNDE virgül var → virgülle bölmek onu ikiye parçalar ve ikisi de eşleşmez.
//   • Yan dal ana dala U+2022 (•) ile bitişik — tire DEĞİL.
// Çözüm: bölme yok, SÖZLÜK TARAMASI. Bilinen dal adları uzundan kısaya, sözcük sınırıyla
// aranır. Sınır şartı yan dal bulaşmasını da keser: "Çocuk Kardiyolojisi" içindeki
// "kardiyoloji"nin ardından "s" geldiği için eşleşmez (pediatrik vaka erişkin kardiyolojiye
// yazılmaz).
const DAL_SOZLUGU: [string, string][] = [
  ...Object.entries(TTB_ALIAS),
  ...BRANCHES.map((b2) => [norm(b2.label), b2.key] as [string, string]),
].sort((x, y) => y[0].length - x[0].length);

function branchSlugsFor(uzmanliklar: string | null): string[] {
  if (!uzmanliklar) return [];
  const hedef = norm(uzmanliklar);
  const out = new Set<string>();
  for (const [ad, slug] of DAL_SOZLUGU) {
    if (new RegExp(`(^|[^a-z0-9])${ad}([^a-z0-9]|$)`).test(hedef)) out.add(slug);
  }
  // Hiç eşleşme yoksa RAW metni logla — "bu etkinlik hiçbir branşa bağlanmadı" eyleme
  // dönüşebilir tek sinyal (kısmi eşleşmeyi ayıklamak sözlük taramasında güvenilir değil).
  if (!out.size) {
    const k = uzmanliklar.trim().slice(0, 120);
    eslesmeyenDallar.set(k, (eslesmeyenDallar.get(k) ?? 0) + 1);
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
// ⚠️ `s` (dotAll) bayrağı YOK: tsconfig target'ı es2018 altı, `next build` bunu tip hatası
// yapar (`tsc --noEmit` scripts/'i atladığı için orada görünmez — build asıl kapıdır).
// Nokta yerine [\s\S] kullanılıyor; davranış aynı.
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

async function main() {
  if (PROD) {
    const prodUrl = process.env.PROD_DATABASE_URL;
    if (!prodUrl) {
      console.error("⛔ --prod istendi ama PROD_DATABASE_URL tanımlı değil.");
      process.exit(1);
    }
    process.env.DATABASE_URL = prodUrl;
    if (process.env.AURA_DB_GUARD === "block") process.env.AURA_DB_GUARD = "warn";
    console.log(`🎯 HEDEF: ÜRETİM ${DRY ? "(dry-run)" : "(YAZILACAK)"}`);
  } else {
    const fp = process.env.PROD_DB_FINGERPRINT;
    if (fp && (process.env.DATABASE_URL ?? "").includes(fp)) {
      console.error("⛔ DATABASE_URL üretime işaret ediyor ama --prod verilmedi; durduruldu.");
      process.exit(1);
    }
    console.log(`🎯 HEDEF: DEV ${DRY ? "(dry-run)" : "(yazılacak)"}`);
  }

  // Varsayılan pencere: geçmiş 6 ay + gelecek 18 ay. Geçmiş de alınır çünkü doktor
  // katıldığı etkinliği geriye dönük arayabilmeli (ileride STE puan defteri buna bağlanır).
  const now = new Date();
  const ym = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const from = argVal("from") ?? ym(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 6, 1)));
  const to = argVal("to") ?? ym(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 18, 1)));
  const pencere = aylar(from, to);
  console.log(`📅 Pencere: ${from} → ${to} (${pencere.length} ay)`);

  // Tür sözlüğü tek kaynaktan (lib/doctorium EVENT_TYPES) — env ayarı bittikten SONRA yüklenir.
  const { EVENT_TYPE_BY_TTB } = await import("../src/lib/doctorium");

  // 1) Liste taraması (ay ay — 50 kayıtlık tavan yüzünden)
  const bulunan = new Map<string, ListRow>();
  let tavanaCarpan = 0;
  for (const [bas, son] of pencere) {
    let rows: ListRow[] = [];
    try {
      rows = parseList(await post("etkinlik_bul_ok.php", {
        TarihBas: bas, TarihSon: son, Adi: "", SehirId: "0", IlceId: "0", UzmanlikId: "0", Bos: "0",
      }));
    } catch (e) {
      console.warn(`  ⚠️ ${bas} taranamadı: ${e instanceof Error ? e.message : e}`);
      continue;
    }
    if (rows.length >= 50) {
      tavanaCarpan++;
      console.warn(`  🚨 ${bas}: 50 kayıt TAVANI — bu ay EKSİK taranmış olabilir (gün gün bölün).`);
    }
    for (const r of rows) bulunan.set(r.id, r);
  }
  console.log(`🔎 Listede ${bulunan.size} etkinlik bulundu${tavanaCarpan ? ` (${tavanaCarpan} ay tavana çarptı!)` : ""}`);

  // 2) Detay + normalizasyon
  const kayitlar: {
    externalId: string; ttbCode: string; eventType: string; title: string;
    organizer: string | null; city: string | null; venue: string | null;
    startDate: Date; endDate: Date | null; scope: string; branchSlugs: string[];
  }[] = [];
  let elenenTest = 0, tarihsiz = 0, turBilinmeyen = 0;

  for (const r of bulunan.values()) {
    const startDate = trDate(r.bas);
    if (!startDate) { tarihsiz++; continue; } // tarih uydurulmaz — kayıt atlanır
    const eventType = EVENT_TYPE_BY_TTB[r.onek];
    if (!eventType) {
      // TTB yeni bir kod öneki eklemiş olabilir → SESSİZ atlamak yerine uyar.
      turBilinmeyen++;
      console.warn(`  ⚠️ Bilinmeyen tür öneki "${r.onek}" (${r.kod}) — EVENT_TYPES'a eklenmeli, kayıt atlandı.`);
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
    if (testKaydiMi(aday)) { elenenTest++; continue; }

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
      branchSlugs: branchSlugsFor(d["Uzmanlıklar"] ?? null),
    });
  }

  console.log(`✅ ${kayitlar.length} kayıt hazır · ${elenenTest} test kaydı elendi · ${tarihsiz} tarihsiz · ${turBilinmeyen} tür bilinmiyor`);
  if (eslesmeyenDallar.size) {
    const ilk = [...eslesmeyenDallar.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
    console.log(`ℹ️  Hiçbir branşa bağlanmayan ${eslesmeyenDallar.size} uzmanlık dizgesi (kayıtlar TÜM branşlarda görünür — TTB_ALIAS'a eklenebilir):`);
    for (const [ad, n] of ilk) console.log(`     ${n}× ${ad}`);
  }

  if (DRY) {
    console.log("\n🧪 DRY-RUN — hiçbir şey yazılmadı. İlk 10 kayıt:");
    for (const k of kayitlar.slice(0, 10)) {
      console.log(`   [${k.eventType}] ${k.ttbCode} ${k.title.slice(0, 60)} · ${k.city ?? "?"} · ${k.scope} · branş: ${k.branchSlugs.join(",") || "(tümü)"}`);
    }
    console.log("\n   Yazmak için: --yaz");
    return;
  }

  // 3) Yazma — idempotent upsert (source, externalId) + ttbCode ÇİPASI (v6.121)
  const { db } = await import("../src/lib/db");
  let yeni = 0, guncel = 0, sahiplenilen = 0;
  for (const k of kayitlar) {
    const data = {
      title: k.title, organizer: k.organizer, city: k.city, venue: k.venue,
      startDate: k.startDate, endDate: k.endDate, scope: k.scope,
      eventType: k.eventType, ttbCode: k.ttbCode,
      branchSlugs: JSON.stringify(k.branchSlugs),
      // Kredi NOTU: yalnız akreditasyon beyanı — SAYI YOK (puan katılım süresine göre
      // TTB kaydında oluşur; program dakikaları çift sayıldığı için türetilemez de).
      cmeCredit: `TTB akredite (${k.ttbCode})`,
      confidence: "dogrulandi",
      verifiedAt: new Date(),
      sourceUrls: JSON.stringify([`${BASE}/etkinlik_detay.php?Id=${k.externalId}`]),
    };
    const mevcut = await db.medicalCongress.findUnique({
      where: { source_externalId: { source: SOURCE, externalId: k.externalId } },
      select: { id: true },
    });
    if (mevcut) {
      await db.medicalCongress.update({ where: { id: mevcut.id }, data });
      guncel++;
      continue;
    }

    // 🔗 ÇİPA (v6.121) — bu etkinlik BAŞKA bir kaynakta (küratörlü/elle) zaten duruyor olabilir.
    // merge-congress-sources.ts kaynaklar arası çifti birleştirirken ttbCode'u kalan satıra
    // yazar ve TTB satırını SİLER. Burada yalnız (source, externalId)'ye baksaydık silinen
    // satırı yeniden yaratır, çift kaydı geri getirirdik — yani birleştirme tek başına
    // KARARSIZ olurdu. Çipa akreditasyon kodunun kendisidir (doğal anahtar): yeni şema alanı,
    // migration ya da okuma yolu değişikliği gerekmez.
    // ⚠️ Sahiplenilmiş satıra YALNIZ TTB'ye ait alanlar yazılır. Küratörlü gövde (bildiri
    //    tarihi, kayıt ücreti, temalar, url, dil, kapak…) TTB'de TAMAMEN boştur; `data`yı
    //    olduğu gibi yazmak o gövdeyi silerdi.
    // `scope` BURADAN tazelenir (kullanıcı kararı 2026-08-19: TTB kapsamda yetkili).
    // Bu dal ŞART: birleştirme TTB satırını sildiği için zaten birleşmiş kayıtlarda TTB'nin
    // scope değeri veritabanında KALMAZ — merge script'ine devir eklemek eski kayıtları
    // düzeltmez, düzeltme yalnız buradan gelebilir.
    const sahiplenen = await db.medicalCongress.findFirst({
      where: { ttbCode: k.ttbCode, source: { not: SOURCE } },
      select: { id: true, cmeCredit: true },
    });
    if (sahiplenen) {
      await db.medicalCongress.update({
        where: { id: sahiplenen.id },
        data: {
          eventType: k.eventType, // tür TTB'nin yetkisinde (küratörlü satırlar varsayılan "kongre")
          scope: k.scope,         // kapsam da TTB'nin yetkisinde (üç değerli; küratörlü veri iki)
          // cmeCredit yalnız BOŞSA doldurulur: küratörlü kredi metni TTB'nin tek satırlık
          // beyanından zengin (ölçüldü — 5 çiftin 3'ünde).
          ...(sahiplenen.cmeCredit ? {} : { cmeCredit: data.cmeCredit }),
          verifiedAt: data.verifiedAt,
        },
      });
      sahiplenilen++;
      continue;
    }

    await db.medicalCongress.create({ data: { source: SOURCE, externalId: k.externalId, ...data } });
    yeni++;
  }
  const toplam = await db.medicalCongress.count({ where: { source: SOURCE } });
  console.log(
    `\n💾 Yazıldı — ${yeni} yeni · ${guncel} güncellendi · ${sahiplenilen} birleştirilmiş satıra devredildi` +
    ` · TTB kaynaklı toplam ${toplam}`,
  );
}

main().catch((e) => {
  console.error("⛔", e);
  process.exit(1);
});
