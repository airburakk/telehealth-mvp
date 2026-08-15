// Doktrin arşivi temizliği — hukuk alaka süzgecini MEVCUT kayıtlara uygular (v6.99, 2026-08-15).
//
// Neden gerekli: süzgeç (lib/doktrin-filter.ts) yalnız yeni toplamayı daraltır; 2026-08-15'ten
// önce yazılmış kayıtlar (dev 192 · prod ayrı ölçülür) hukukla ilgisiz klinik/sosyal çalışmalar
// içeriyordu. Kullanıcı kararı 2026-08-15: sıkı filtre + arşiv temizliği.
//
// ⚠️ KANAL FARKI: DB kaydında anahtar kelime alanı YOK (NewsArticle: title/summary/sourceName).
// Süzgece keywords BOŞ gider → skor, toplama anındakinden bir tık düşük çıkabilir. Bu yüzden
// silme DAİMA dry-run listesiyle önce gösterilir; sınırdaki kayıt elle bağışlanabilir (KEEP_IDS).
//
// GÜVENLİK TASARIMI (ingest-doktrin/ingest-yargitay ile aynı): varsayılan DRY-RUN + varsayılan
// hedef DEV; prod YALNIZ --prod + PROD_DATABASE_URL. Yalnız category="doktrin" satırlarına dokunur.
//
// Kullanım:
//   npx tsx scripts/temizle-doktrin.ts                → DEV, dry-run (düşecek/kalacak tam liste)
//   npx tsx scripts/temizle-doktrin.ts --sil          → DEV'den sil
//   npx tsx scripts/temizle-doktrin.ts --prod         → PROD dry-run (salt okuma)
//   npx tsx scripts/temizle-doktrin.ts --prod --sil   → PROD'dan sil
import "dotenv/config";

const args = process.argv.slice(2);
const DRY = !args.includes("--sil");
const PROD = args.includes("--prod");

/** Süzgecin elediği ama HUKUKÇU kararıyla kalacak kayıtlar (dry-run incelemesinden sonra doldurulur). */
const KEEP_IDS: string[] = [];

async function main() {
  if (PROD) {
    const prodUrl = process.env.PROD_DATABASE_URL;
    if (!prodUrl) {
      console.error("⛔ --prod istendi ama PROD_DATABASE_URL tanımlı değil.");
      process.exit(1);
    }
    process.env.DATABASE_URL = prodUrl;
    if (process.env.AURA_DB_GUARD === "block") process.env.AURA_DB_GUARD = "warn";
    console.log(`🎯 HEDEF: ÜRETİM ${DRY ? "(dry-run — silme YOK)" : "(SİLİNECEK)"}`);
  } else {
    const fp = process.env.PROD_DB_FINGERPRINT;
    if (fp && (process.env.DATABASE_URL ?? "").includes(fp)) {
      console.error("⛔ DATABASE_URL üretime işaret ediyor ama --prod verilmedi.");
      process.exit(1);
    }
    console.log(`🎯 HEDEF: DEV ${DRY ? "(dry-run)" : "(silinecek)"}`);
  }

  // Dinamik import ŞART: src/lib/db env'i MODÜL YÜKLENİRKEN okur (ingest-tr-sources dersi).
  const { scoreLegalRelevance } = await import("../src/lib/doktrin-filter");
  const { db } = await import("../src/lib/db");

  const rows = await db.newsArticle.findMany({
    where: { category: "doktrin" },
    select: { id: true, title: true, summary: true, sourceName: true, publishedAt: true },
    orderBy: { publishedAt: "desc" },
  });

  const keep: typeof rows = [];
  const drop: { row: (typeof rows)[number]; reason: string; score: number }[] = [];
  for (const r of rows) {
    const v = scoreLegalRelevance({ title: r.title, abstract: r.summary, keywords: "", journal: r.sourceName });
    if (v.accepted || KEEP_IDS.includes(r.id)) keep.push(r);
    else drop.push({ row: r, reason: v.reason, score: v.score });
  }

  console.log(`\n📊 Doktrin arşivi: ${rows.length} kayıt · KALIR ${keep.length} · DÜŞER ${drop.length}\n`);
  console.log("── DÜŞECEKLER ──────────────────────────────────────────────");
  for (const d of drop) {
    console.log(`  ✕ [${d.row.publishedAt.getUTCFullYear()}] ${d.row.title.slice(0, 88)}`);
    console.log(`      ⟨${d.row.sourceName.slice(0, 46)}⟩ · ${d.reason}`);
  }
  console.log("\n── KALANLAR (ilk 25) ───────────────────────────────────────");
  for (const k of keep.slice(0, 25)) console.log(`  ✓ [${k.publishedAt.getUTCFullYear()}] ${k.title.slice(0, 92)}`);
  if (keep.length > 25) console.log(`  … +${keep.length - 25} kayıt daha`);

  if (DRY) {
    console.log("\nSilmek için: --sil (önce yukarıdaki listeyi hukukçu gözüyle oku)");
  } else if (drop.length) {
    const res = await db.newsArticle.deleteMany({ where: { id: { in: drop.map((d) => d.row.id) } } });
    console.log(`\n🗑️  Silindi: ${res.count} kayıt`);
    // ⚠️ Kaydedilmiş makaleler (SavedArticle) yabancı anahtarla bağlıysa şema kuralı devrededir —
    // silme hata verirse önce o bağ incelenir (sessiz geçilmez).
  } else {
    console.log("\n✅ Silinecek kayıt yok.");
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error("⛔ beklenmeyen hata:", e);
  process.exit(1);
});
