// Hukuk içerikleri (İçtihat + Doktrin) — BRANŞ ETİKETİ BACKFILL'İ (v6.93, 2026-08-14) — kalıcı araç.
//
// NEDEN: branş çıkarımı (lib/hukuk-keywords extractBranches) ingest'lere v6.93'te bağlandı;
// ondan önce yazılmış kayıtlar `branchSlugs="[]"` taşıyor. Bu script mevcut kayıtların etiketini
// AYNI deterministik kuralla yeniden hesaplar (İçtihat: tam metin + minHits:2 · Doktrin:
// başlık+özet + minHits:1) ve YALNIZ DEĞİŞENLERİ günceller. Sözlük/desen değişince de yeniden
// koşulabilir (idempotent — aynı girdi aynı etiketi üretir).
//
// GÜVENLİK TASARIMI diğer ingest script'leriyle AYNI: dry-run varsayılan · --yaz · prod yalnız
// --prod + PROD_DATABASE_URL. Dokunulan tek alan `NewsArticle.branchSlugs` (kamuya açık içerik,
// PHI yok). Hiçbir şey silinmez.
//
// Kullanım:
//   npx tsx scripts/backfill-hukuk-brans.ts                → DEV, dry-run (fark raporu)
//   npx tsx scripts/backfill-hukuk-brans.ts --yaz          → DEV'e yaz
//   npx tsx scripts/backfill-hukuk-brans.ts --prod         → PROD dry-run
//   npx tsx scripts/backfill-hukuk-brans.ts --prod --yaz   → PROD'a yaz
import "dotenv/config";

const args = process.argv.slice(2);
const DRY = !args.includes("--yaz");
const PROD = args.includes("--prod");

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

  // Dinamik import ŞART: src/lib/db env'i modül yüklenirken okur.
  const { extractBranches } = await import("../src/lib/hukuk-keywords");
  const { db } = await import("../src/lib/db");

  const rows = await db.newsArticle.findMany({
    where: { category: { in: ["ictihat", "doktrin"] } },
    select: { id: true, category: true, title: true, summary: true, branchSlugs: true },
  });

  let changed = 0;
  const sample: string[] = [];
  const counts: Record<string, number> = {};
  for (const r of rows) {
    const next =
      r.category === "ictihat"
        ? extractBranches(r.summary, { minHits: 2 }) // uzun karar metni — yan-cümle geçişi elenir
        : extractBranches(`${r.title} ${r.summary}`); // kısa/odaklı makale metadata'sı
    const nextJson = JSON.stringify(next);
    for (const s of next) counts[s] = (counts[s] ?? 0) + 1;
    if (nextJson === r.branchSlugs) continue;
    changed++;
    if (sample.length < 12) sample.push(`${r.category} · ${r.title.slice(0, 60)} → [${next.join(", ") || "genel"}]`);
    if (!DRY) await db.newsArticle.update({ where: { id: r.id }, data: { branchSlugs: nextJson } });
  }

  console.log(`\n📊 Taranan: ${rows.length} (ictihat+doktrin) · ${DRY ? "DEĞİŞECEK" : "GÜNCELLENDİ"}: ${changed}`);
  console.log("Branş dağılımı:", Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(" · ") || "(hiç etiket çıkmadı)");
  for (const s of sample) console.log(`   ${s}`);
  if (DRY && changed) console.log("\nYazmak için: --yaz");

  await db.$disconnect();
}

main().catch((e) => {
  console.error("⛔ beklenmeyen hata:", e);
  process.exit(1);
});
