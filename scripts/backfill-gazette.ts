// Resmî Gazete geriye-dönük mevzuat taraması (v6.50) — kalıcı araç.
//
// NEDEN: günlük cron yalnız O GÜNÜ tarar; mevzuat haberi her gün çıkmadığı için Doctorium'un
// mevzuat/akış sekmeleri günlerce boş görünüyordu. Bu script geçmiş N günü tarar ve sağlıkla
// ilgili kalemleri tarihleriyle yazar → hekim "1 yıllık" filtresini seçtiğinde gerçek bir
// kronoloji görür.
//
// İdempotent: (source, externalId) benzersiz → yeniden koşuda 0 yeni. Hiçbir şey SİLMEZ.
// Nazik: her istek arasında GAP_MS bekler (kurum sitesini yormamak için).
//
// Kullanım:
//   npx tsx scripts/backfill-gazette.ts            → son 365 gün
//   npx tsx scripts/backfill-gazette.ts 90         → son 90 gün
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { fetchGazetteArchive, ingestGazetteItems } from "../src/lib/doctorium-sources";

const GAP_MS = 250; // ~4 istek/sn
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const db = new PrismaClient();

async function main() {
  // ⚠️ ÜRETİM KORUMASI (fill-markets/rotate-kek eşleniği; db.ts guard'ı script'lerden geçmez).
  const fp = process.env.PROD_DB_FINGERPRINT;
  if (fp && (process.env.DATABASE_URL ?? "").includes(fp) && process.env.ALLOW_PROD_BACKFILL !== "1") {
    console.error("⛔ DATABASE_URL üretime işaret ediyor; backfill durduruldu.");
    console.error("   Bilinçli istiyorsan ALLOW_PROD_BACKFILL=1 ile yeniden çalıştır.");
    process.exit(1);
  }

  const days = Math.min(1100, Math.max(1, Number(process.argv[2]) || 365));
  console.log(`Resmî Gazete taraması: son ${days} gün`);

  let fetched = 0;
  let created = 0;
  let emptyDays = 0;
  let failed = 0;
  const t0 = Date.now();

  for (let i = 1; i <= days; i++) {
    const d = new Date(Date.now() - i * 86400000);
    // Pazar günü Resmî Gazete yayımlanmaz → boş istek atmayalım.
    if (d.getUTCDay() === 0) continue;
    try {
      const items = await fetchGazetteArchive(d);
      if (!items.length) {
        emptyDays++;
      } else {
        const [scanned, made] = await ingestGazetteItems(items);
        fetched += scanned;
        created += made;
      }
    } catch (e) {
      failed++;
      if (failed <= 3) console.warn(`  ⚠ ${d.toISOString().slice(0, 10)}: ${e instanceof Error ? e.message : e}`);
    }
    if (i % 30 === 0) {
      console.log(`  ${i}/${days} gün · taranan ${fetched} · yeni ${created} · boş gün ${emptyDays} · hata ${failed}`);
    }
    await sleep(GAP_MS);
  }

  const total = await db.newsArticle.count({ where: { source: "resmi-gazete" } });
  const byCat = await db.newsArticle.groupBy({
    by: ["category"],
    where: { source: "resmi-gazete" },
    _count: true,
  });
  console.log(`\nSÜRE: ${((Date.now() - t0) / 1000).toFixed(0)} sn`);
  console.log(`Taranan fihrist kalemi: ${fetched} · YENİ kayıt: ${created} · boş/yayımsız gün: ${emptyDays} · hata: ${failed}`);
  console.log(`Resmî Gazete kaydı (toplam): ${total}`);
  console.log("Kategori dağılımı:", byCat.map((c) => `${c.category ?? "yok"}=${c._count}`).join(" · "));
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
