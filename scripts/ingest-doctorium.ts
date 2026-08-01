// Doctorium içerik toplayıcılarını ELLE koş (v6.50) — kalıcı ops aracı.
//
// Normalde günlük bakım cron'u (purge-deleted) ingestDoctorium() çağırır. Bu script aynı işi
// hemen çalıştırır: yeni kaynak eklendiğinde, kazıyıcı düzeltildiğinde veya dev DB'yi
// doldurmak istediğinde. İdempotent: (source, externalId) benzersiz → tekrar koşuda 0 yeni.
//
// Kullanım:
//   npx tsx scripts/ingest-doctorium.ts            → TÜM kaynaklar (PubMed dahil, ~2 dk)
//   npx tsx scripts/ingest-doctorium.ts --sektor    → yalnız sektörel/mevzuat/ilaç (PubMed atla)
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { ingestDoctorium } from "../src/lib/doctorium-ingest";
import { ingestOhsad, ingestTtb, ingestFdaRecalls, ingestTrials, ingestWho } from "../src/lib/doctorium-sources";

const db = new PrismaClient();

async function main() {
  const fp = process.env.PROD_DB_FINGERPRINT;
  if (fp && (process.env.DATABASE_URL ?? "").includes(fp) && process.env.ALLOW_PROD_INGEST !== "1") {
    console.error("⛔ DATABASE_URL üretime işaret ediyor; ALLOW_PROD_INGEST=1 ile bilinçli koş.");
    process.exit(1);
  }
  const t0 = Date.now();

  if (process.argv.includes("--sektor")) {
    const jobs: [string, () => Promise<[number, number]>][] = [
      ["ohsad", ingestOhsad], ["ttb", ingestTtb],
      ["fda", () => ingestFdaRecalls(12)], ["trials", () => ingestTrials(12)], ["who", () => ingestWho(8)],
    ];
    for (const [name, fn] of jobs) {
      try { const [s, c] = await fn(); console.log(`  ${name}: taranan=${s} yeni=${c}`); }
      catch (e) { console.log(`  ${name}: HATA ${e instanceof Error ? e.message : e}`); }
    }
  } else {
    console.log(JSON.stringify(await ingestDoctorium(), null, 1));
  }

  const g = await db.newsArticle.groupBy({ by: ["module", "category"], _count: true });
  console.log(`\nSÜRE ${((Date.now() - t0) / 1000).toFixed(0)} sn · MODÜL/KATEGORİ:`);
  for (const x of g.sort((a, b) => `${a.module}${a.category}`.localeCompare(`${b.module}${b.category}`))) {
    console.log(`  ${x.module}/${x.category ?? "-"} = ${x._count}`);
  }
  console.log("TOPLAM:", await db.newsArticle.count());
}

main().then(() => db.$disconnect()).catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
