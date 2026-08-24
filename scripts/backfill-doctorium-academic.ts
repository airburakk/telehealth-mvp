// Doctorium akademik arşiv backfill'i (2026-08-18, kullanıcı kararı: "backfill yapalım,
// tüm kaynaklar için 1 yıl yeterli").
//
// KAPSAM: geriye dönük doldurma yalnız TARİH-SORGULANABİLİR API'lerde mümkündür:
//   · PubMed (tier-1 dergi beyaz-listesi sorguları, reldate=365)
//   · Europe PMC (FIRST_PDATE aralığı)
//   · DOAJ (created_date sıralı + istemci tarafı kesim)
// RSS/kazıma kaynakları (Medscape, Medical Xpress, TTB, İTO, OHSAD, Resmî Gazete fihristi)
// yalnız güncel beslemeyi yayınlar — 1 yıllık arşivleri YOKTUR, backfill edilemez (uydurma
// içerik üretilmez). Yargıtay içtihat + TR-Dizin doktrin zaten kendi arşiv ingest'leriyle dolu.
//
// KULLANIM (dev DB — .env):        npx tsx scripts/backfill-doctorium-academic.ts
//   isteğe bağlı: --days 365 --pubmed 12 --epmc 20 --doaj 15
// ⚠️ PROD'a karşı çalıştırmak = ayrı kullanıcı onayı + PROD_DATABASE_URL (proje kuralı).
import { config } from "dotenv";
config();

async function main() {
  const arg = (name: string, def: number) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 ? Number(process.argv[i + 1]) || def : def;
  };
  const days = arg("days", 365);
  const perPubmed = arg("pubmed", 12);
  const perEpmc = arg("epmc", 20);
  const perDoaj = arg("doaj", 15);

  // Dinamik import: dotenv yüklendikten SONRA (db.ts modül yüklenirken DATABASE_URL okur).
  const { ingestQuery } = await import("../src/lib/doctorium-ingest");
  const { ingestEuropePmcAll, ingestDoajAll } = await import("../src/lib/doctorium-academic-sources");
  const { NEWS_QUERIES } = await import("../src/lib/medical-news");
  const { tier1Query } = await import("../src/lib/academic-journals");
  const { BRANCHES } = await import("../src/lib/triage");

  const LABEL_TO_SLUG: Record<string, string> = Object.fromEntries(BRANCHES.map((b) => [b.label, b.key]));
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  console.log(`Backfill başlıyor — pencere ${days} gün · pubmed ${perPubmed}/branş · epmc ${perEpmc}/branş · doaj ${perDoaj}/branş`);

  // 1) PubMed (tier-1 beyaz-liste; NCBI 3 istek/sn → 400ms aralık)
  let pmScanned = 0;
  let pmNew = 0;
  for (const [label, mesh] of Object.entries(NEWS_QUERIES)) {
    const slug = LABEL_TO_SLUG[label];
    if (!slug) continue;
    try {
      const [s, c] = await ingestQuery(tier1Query(mesh, slug), perPubmed, [slug], days);
      pmScanned += s;
      pmNew += c;
      process.stdout.write(`  pubmed/${slug}: +${c}\n`);
    } catch (e) {
      console.warn(`  pubmed/${slug} HATA: ${e instanceof Error ? e.message : e}`);
    }
    await sleep(400);
  }
  console.log(`PubMed: ${pmScanned} tarandı, ${pmNew} yeni`);

  // 2) Europe PMC
  const [epS, epN] = await ingestEuropePmcAll({ days, perBranch: perEpmc });
  console.log(`Europe PMC: ${epS} tarandı, ${epN} yeni`);

  // 3) DOAJ
  const [djS, djN] = await ingestDoajAll({ days, perBranch: perDoaj });
  console.log(`DOAJ: ${djS} tarandı, ${djN} yeni`);

  const { db } = await import("../src/lib/db");
  const dist = await db.newsArticle.groupBy({ by: ["source"], where: { module: "akademik" }, _count: true });
  console.log("Akademik havuz dağılımı:", JSON.stringify(dist));
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
