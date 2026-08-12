// PubMed yayın tarihi ONARIMI (v6.85, 2026-08-11) — kalıcı ops aracı.
//
// NEDEN: PubMed'in `pubdate`/`sortpubdate` alanı YAYIN tarihi değil, derginin KAPAK/CİLT tarihidir
// (cover date). Sürekli-yayın dergileri tüm yılı tek cilt sayar → `"2026 Dec 31"`; aylık dergiler
// makaleyi gelecek sayıya yazar → `"2026 Dec"`. Makale aylar önce çevrimiçi çıkmış olsa bile tarih
// GELECEKTE görünüyordu: 2026-08-11 ölçümünde akademik havuzun 74 kaydından 71'i gelecek tarihliydi
// (58'i tam 31 Aralık'ta yığılmıştı) → doktorun gördüğü tarih yanlış, "en yeni" sıralaması anlamsız.
// Doğru alan `epubdate` (çevrimiçi ilk yayın). Toplayıcı v6.85'te düzeltildi (doctorium-ingest.ts
// `pubDate`), AMA ingest mevcut kayıtların `publishedAt`'ine bilinçli DOKUNMAZ (yalnız branchSlugs
// birleştirir) → geçmiş kayıtlar kendiliğinden düzelmez. Bu betik onları esummary'den yeniden
// hesaplayıp hizalar.
//
// GÜVENLİK TASARIMI (ingest-tr-sources.ts ile aynı korkuluklar):
//   • Varsayılan DRY-RUN: hiçbir şey yazılmaz; "şu tarih şu olurdu" listelenir. Yazma = --yaz.
//   • Varsayılan hedef: DATABASE_URL (yerel .env → Neon DEV branch).
//   • Prod YALNIZ --prod + ayrı PROD_DATABASE_URL ile; --prod'suz DATABASE_URL prod'u gösteriyorsa DURUR.
//   • Dokunulan tek alan: NewsArticle.publishedAt (kamuya açık literatür — PHI YOK). Hiçbir şey SİLİNMEZ.
//   • Tarih hesabı toplayıcının KENDİ `pubDate()` fonksiyonuyla yapılır (tek doğruluk kaynağı —
//     betik kendi kopyasını tutsaydı ikisi zamanla ayrışırdı).
//
// Kullanım:
//   npx tsx scripts/fix-pubmed-dates.ts               → DEV, dry-run (ne değişirdi?)
//   npx tsx scripts/fix-pubmed-dates.ts --yaz         → DEV'e yaz
//   npx tsx scripts/fix-pubmed-dates.ts --prod        → PROD'a karşı dry-run (salt okuma)
//   npx tsx scripts/fix-pubmed-dates.ts --prod --yaz  → PROD'a yaz
//
// İdempotent: ikinci koşuda "değişecek 0" döner (epubdate sabittir).
import "dotenv/config";

const args = process.argv.slice(2);
const DRY = !args.includes("--yaz");
const PROD = args.includes("--prod");

const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const BATCH = 150; // esummary tek istekte rahat taşır; NCBI'ya nezaket için aralıklı
const GAP_MS = 400; // anahtarsız NCBI sınırı 3 istek/sn — altında kal

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Summary {
  uid: string;
  pubdate?: string;
  sortpubdate?: string;
  epubdate?: string;
}

async function esummary(ids: string[]): Promise<Record<string, Summary>> {
  const qs = new URLSearchParams({
    db: "pubmed", id: ids.join(","), retmode: "json", tool: "aura-health", email: "info@aura.health",
  });
  const res = await fetch(`${EUTILS}/esummary.fcgi?${qs}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`esummary ${res.status}`);
  const json = (await res.json()) as { result?: Record<string, Summary> };
  const { uids: _uids, ...rest } = (json.result ?? {}) as Record<string, Summary> & { uids?: unknown };
  return rest;
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
    console.log(`🎯 HEDEF: ÜRETİM ${DRY ? "(dry-run — yazma YOK)" : "(YAZILACAK)"}`);
  } else {
    const fp = process.env.PROD_DB_FINGERPRINT;
    if (fp && (process.env.DATABASE_URL ?? "").includes(fp)) {
      console.error("⛔ DATABASE_URL üretime işaret ediyor ama --prod verilmedi; kazara yazımı önlemek için durduruldu.");
      console.error("   Üretim bilinçli hedefse: --prod (+ yazmak için --yaz) kullan.");
      process.exit(1);
    }
    console.log(`🎯 HEDEF: DEV ${DRY ? "(dry-run)" : "(yazılacak)"}`);
  }

  // Dinamik import ŞART: src/lib/db, DATABASE_URL/AURA_DB_GUARD'ı MODÜL YÜKLENİRKEN okur.
  const { db } = await import("../src/lib/db");
  const { pubDate } = await import("../src/lib/doctorium-ingest");

  const rows = await db.newsArticle.findMany({
    where: { source: "pubmed" },
    select: { id: true, externalId: true, publishedAt: true, title: true },
    orderBy: { publishedAt: "desc" },
  });
  console.log(`\n📚 PubMed kaydı: ${rows.length}`);
  if (!rows.length) return;

  const now = new Date();
  const oncekiGelecek = rows.filter((r) => r.publishedAt > now).length;
  console.log(`   bunlardan GELECEK tarihli: ${oncekiGelecek}`);

  const byId = new Map(rows.map((r) => [r.externalId, r]));
  let degisen = 0, ayni = 0, bulunamayan = 0, hata = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const parca = rows.slice(i, i + BATCH);
    let sums: Record<string, Summary>;
    try {
      sums = await esummary(parca.map((r) => r.externalId));
    } catch (e) {
      hata += parca.length;
      console.log(`  ⚠️ esummary hatası (${parca.length} kayıt atlandı): ${e instanceof Error ? e.message : e}`);
      continue;
    }

    for (const [uid, s] of Object.entries(sums)) {
      const row = byId.get(uid);
      if (!row) continue;
      const yeni = pubDate(s.pubdate, s.sortpubdate, s.epubdate);
      if (!yeni) { bulunamayan++; continue; }
      // Gün çözünürlüğünde karşılaştır — saat farkı gürültüsü yazma üretmesin.
      if (yeni.toISOString().slice(0, 10) === row.publishedAt.toISOString().slice(0, 10)) { ayni++; continue; }
      degisen++;
      const ok = row.publishedAt > now ? "🔮" : "  ";
      console.log(
        `  ${ok} ${DRY ? "olurdu" : "yazıldı"}: ${row.publishedAt.toISOString().slice(0, 10)} → ${yeni.toISOString().slice(0, 10)}` +
        `  [epub=${s.epubdate ?? "-"} · kapak=${s.pubdate ?? "-"}]  ${row.title.slice(0, 52)}`,
      );
      if (!DRY) await db.newsArticle.update({ where: { id: row.id }, data: { publishedAt: yeni } });
    }

    if (i + BATCH < rows.length) await sleep(GAP_MS);
  }

  console.log(`\n── ÖZET ──`);
  console.log(`  değişen   : ${degisen} ${DRY ? "(dry-run — YAZILMADI)" : "(yazıldı)"}`);
  console.log(`  aynı      : ${ayni}`);
  console.log(`  tarihsiz  : ${bulunamayan} (esummary tarih vermedi — dokunulmadı)`);
  if (hata) console.log(`  hata      : ${hata} (esummary ulaşılamadı — tekrar koş)`);

  if (!DRY) {
    const kalan = await db.newsArticle.count({ where: { source: "pubmed", publishedAt: { gt: new Date() } } });
    console.log(`  TEYİT — hâlâ gelecek tarihli: ${kalan} (beklenen 0)`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
