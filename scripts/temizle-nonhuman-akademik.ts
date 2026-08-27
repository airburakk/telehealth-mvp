// İnsan tıbbı DIŞI akademik kayıt TEMİZLİĞİ (2026-08-26) — kalıcı ops aracı.
//
// NEDEN: Akademik akışa "Journal of Integrative Agriculture"dan buzağı ishali makalesi sızdı
// (DOAJ, serbest-metin eşleşme — DOAJ tüm disiplinleri indeksler; hatta insan-tıbbı kısıtı yoktu).
// Toplayıcılar 2026-08-26'da süzgeçlendi (lib/academic-journals: PUBMED_HUMAN_FILTER +
// isNonHumanAcademic + lccNonMedicine), AMA mevcut kayıtlar kendiliğinden temizlenmez.
// Bu betik module="akademik" havuzunu aynı ölçütlerle tarayıp kaçakları SİLER.
//
// İKİ KADEME:
//   1) Desen: sourceName + title üstünde isNonHumanAcademic (tüm kaynaklar, API'siz).
//   2) DOAJ LCC: desene takılmayan source="doaj" kayıtları için DOAJ API'sinden LCC konu kodu
//      çekilir (lccNonMedicine) — kimya/mühendislik gibi veteriner-desensiz disiplin kaçakları
//      ancak böyle görünür. API'ye ulaşılamayan kayıt DOKUNULMAZ ve raporlanır (uydurma karar yok).
//
// GÜVENLİK TASARIMI (fix-pubmed-dates.ts ile aynı korkuluklar):
//   • Varsayılan DRY-RUN: hiçbir şey silinmez; "şu silinirdi" listelenir. Silme = --yaz.
//   • Varsayılan hedef: DATABASE_URL (yerel .env → Neon DEV branch).
//   • Prod YALNIZ --prod + ayrı PROD_DATABASE_URL ile; --prod'suz DATABASE_URL prod'u gösteriyorsa DURUR.
//   • Dokunulan tek tablo: NewsArticle (kamuya açık literatür — PHI YOK, FK ilişkisi YOK).
//   • Ölçüt toplayıcının KENDİ fonksiyonlarıyla uygulanır (tek doğruluk kaynağı — kopya ayrışır).
//
// Kullanım:
//   npx tsx scripts/temizle-nonhuman-akademik.ts               → DEV, dry-run (ne silinirdi?)
//   npx tsx scripts/temizle-nonhuman-akademik.ts --yaz         → DEV'den sil
//   npx tsx scripts/temizle-nonhuman-akademik.ts --prod        → PROD'a karşı dry-run (salt okuma)
//   npx tsx scripts/temizle-nonhuman-akademik.ts --prod --yaz  → PROD'dan sil
//   --lcc-atla → DOAJ API kademesini atla (yalnız desen; çevrimdışı/hızlı koşu)
//
// İdempotent: ikinci koşuda "silinecek 0" döner.
import "dotenv/config";

const args = process.argv.slice(2);
const DRY = !args.includes("--yaz");
const PROD = args.includes("--prod");
const SKIP_LCC = args.includes("--lcc-atla");

const DOAJ_GAP_MS = 350; // DOAJ'a nezaket — anahtarsız API
const UA = "Mozilla/5.0 (compatible; AuraHealth/1.0; +https://telehealth-mvp-roan.vercel.app)";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface DoajArticle {
  bibjson?: { subject?: { scheme?: string; code?: string }[] };
}

/** DOAJ makale kaydından LCC kodları; null = API'ye ulaşılamadı (karar VERİLMEZ). */
async function doajLccCodes(articleId: string): Promise<string[] | null> {
  try {
    const res = await fetch(`https://doaj.org/api/articles/${encodeURIComponent(articleId)}`, {
      headers: { "user-agent": UA },
    });
    if (res.status === 404) return []; // kayıt DOAJ'dan kalkmış — kod bilgisi yok say
    if (!res.ok) return null;
    const json = (await res.json()) as DoajArticle;
    return (json.bibjson?.subject ?? [])
      .filter((s) => (s.scheme ?? "").toUpperCase() === "LCC")
      .map((s) => s.code ?? "")
      .filter(Boolean);
  } catch {
    return null;
  }
}

async function main() {
  if (PROD) {
    const prodUrl = process.env.PROD_DATABASE_URL;
    if (!prodUrl) {
      console.error("⛔ --prod istendi ama PROD_DATABASE_URL tanımlı değil. Bilinçli prod akışı bu env'i ŞART koşar.");
      process.exit(1);
    }
    process.env.DATABASE_URL = prodUrl;
    if (process.env.AURA_DB_GUARD === "block") process.env.AURA_DB_GUARD = "warn";
    console.log(`🎯 HEDEF: ÜRETİM ${DRY ? "(dry-run — silme YOK)" : "(SİLİNECEK)"}`);
  } else {
    const fp = process.env.PROD_DB_FINGERPRINT;
    if (fp && (process.env.DATABASE_URL ?? "").includes(fp)) {
      console.error("⛔ DATABASE_URL üretime işaret ediyor ama --prod verilmedi; kazara silmeyi önlemek için durduruldu.");
      console.error("   Üretim bilinçli hedefse: --prod (+ silmek için --yaz) kullan.");
      process.exit(1);
    }
    console.log(`🎯 HEDEF: DEV ${DRY ? "(dry-run)" : "(silinecek)"}`);
  }

  // Dinamik import ŞART: src/lib/db, DATABASE_URL/AURA_DB_GUARD'ı MODÜL YÜKLENİRKEN okur.
  const { db } = await import("../src/lib/db");
  const { isNonHumanAcademic, lccNonMedicine } = await import("../src/lib/academic-journals");

  const rows = await db.newsArticle.findMany({
    where: { module: "akademik" },
    select: { id: true, source: true, externalId: true, sourceName: true, title: true, branchSlugs: true },
    orderBy: { publishedAt: "desc" },
  });
  console.log(`\n📚 Akademik kayıt: ${rows.length}`);
  if (!rows.length) return;

  type Aday = (typeof rows)[number] & { neden: string };
  const adaylar: Aday[] = [];

  // Kademe 1 — desen (tüm kaynaklar, API'siz).
  for (const r of rows) {
    if (isNonHumanAcademic(r.sourceName, r.title)) adaylar.push({ ...r, neden: "desen (dergi/başlık)" });
  }

  // Kademe 2 — DOAJ LCC (desene takılmayan doaj kayıtları).
  let lccUlasilamadi = 0;
  if (!SKIP_LCC) {
    const flagged = new Set(adaylar.map((a) => a.id));
    const doajKalan = rows.filter((r) => r.source === "doaj" && !flagged.has(r.id));
    if (doajKalan.length) console.log(`🔎 DOAJ LCC kontrolü: ${doajKalan.length} kayıt (≈${Math.ceil((doajKalan.length * DOAJ_GAP_MS) / 1000)} sn)`);
    for (const r of doajKalan) {
      const codes = await doajLccCodes(r.externalId);
      if (codes === null) lccUlasilamadi++;
      else if (lccNonMedicine(codes)) adaylar.push({ ...r, neden: `LCC tıp-dışı (${codes.join(", ")})` });
      await sleep(DOAJ_GAP_MS);
    }
  }

  if (!adaylar.length) {
    console.log("✅ Silinecek kayıt yok — havuz temiz.");
    if (lccUlasilamadi) console.log(`   ⚠️ LCC'si okunamayan ${lccUlasilamadi} DOAJ kaydı KONTROLSÜZ kaldı — tekrar koş.`);
    return;
  }

  console.log(`\n── ${DRY ? "SİLİNİRDİ" : "SİLİNİYOR"} (${adaylar.length}) ──`);
  for (const a of adaylar) {
    console.log(`  [${a.source}] ${a.sourceName.slice(0, 40)} | ${a.title.slice(0, 60)}`);
    console.log(`     ↳ ${a.neden} · branşlar=${a.branchSlugs}`);
    if (!DRY) await db.newsArticle.delete({ where: { id: a.id } });
  }

  console.log(`\n── ÖZET ──`);
  console.log(`  aday    : ${adaylar.length} ${DRY ? "(dry-run — SİLİNMEDİ; silmek için --yaz)" : "(silindi)"}`);
  console.log(`  temiz   : ${rows.length - adaylar.length}`);
  if (lccUlasilamadi) console.log(`  ⚠️ LCC okunamadı: ${lccUlasilamadi} DOAJ kaydı (dokunulmadı — tekrar koş)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
