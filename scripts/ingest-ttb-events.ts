// TTB akredite etkinlik ingest'i — CLI KABUĞU (v6.120; v6.129'da çekirdek lib'e taşındı).
//
// ÇEKİRDEK: src/lib/ttb-events.ts (fetch + parse + elek + idempotent yazım + ttbCode çipası).
// Bu kabukta yalnız CLI korkulukları yaşar; cron bindirmesi (purge-deleted rotası) aynı çekirdeği
// statik import eder ve HAFTALIK dar pencereyle koşar. Tam/geri dönük tarama BU script'in işidir.
//
// ⚠️ Aynı etkinlik iki kaynaktan iki SATIR olabilir (v6.120'de yaşandı) — kaynaklar arası
// birleştirme ayrı araçtadır: scripts/merge-congress-sources.ts (satır SİLDİĞİ için cron'a
// bindirilmedi, insan gözetiminde koşulur). Koşum sırası: seed → BU SCRIPT → merge.
//
// GÜVENLİK: seed-congresses.ts ile aynı korkuluk deseni —
//   • Varsayılan DRY-RUN (yazma için --yaz)
//   • Prod YALNIZ --prod + ayrı PROD_DATABASE_URL env'i
//   • --prod'suz DATABASE_URL prod parmak izine uyuyorsa DURUR
//
// Kullanım:
//   npx tsx scripts/ingest-ttb-events.ts                     → DEV dry-run (geçmiş 6 ay + gelecek 18 ay)
//   npx tsx scripts/ingest-ttb-events.ts --yaz               → DEV'e yaz
//   npx tsx scripts/ingest-ttb-events.ts --from=2024-01 --to=2026-12 --yaz
//   npx tsx scripts/ingest-ttb-events.ts --prod --yaz        → PROD'a yaz
import "dotenv/config";

const args = process.argv.slice(2);
const DRY = !args.includes("--yaz");
const PROD = args.includes("--prod");
const argVal = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

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

  // ⚠️ Çekirdek env kurulumundan SONRA dinamik import edilir: lib/ttb-events → lib/db zinciri
  // bağlantı dizesini modül yüklenirken okur; statik import --prod anahtarını görmezden gelirdi
  // (seed-congresses.ts ile aynı ders).
  const { ingestTtbEvents } = await import("../src/lib/ttb-events");
  const r = await ingestTtbEvents({
    fromYm: argVal("from"),
    toYm: argVal("to"),
    dryRun: DRY,
    onLog: (line) => console.log(line),
  });

  if (r.unmatchedSpecialties.length) {
    console.log(`ℹ️  Hiçbir branşa bağlanmayan uzmanlık dizgeleri (kayıtlar TÜM branşlarda görünür — TTB_ALIAS'a eklenebilir):`);
    for (const s of r.unmatchedSpecialties) console.log(`     ${s}`);
  }

  if (DRY) {
    console.log("\n🧪 DRY-RUN — hiçbir şey yazılmadı. İlk 10 kayıt:");
    for (const s of r.sample ?? []) console.log(`   ${s}`);
    console.log("\n   Yazmak için: --yaz");
    return;
  }

  // Toplam sayaç (yalnız CLI bilgilendirmesi — çekirdek db'ye zaten yazdı)
  const { db } = await import("../src/lib/db");
  const toplam = await db.medicalCongress.count({ where: { source: "ttb-kredilendirme" } });
  console.log(`   TTB kaynaklı toplam ${toplam}`);
}

main().catch((e) => {
  console.error("⛔", e);
  process.exit(1);
});
