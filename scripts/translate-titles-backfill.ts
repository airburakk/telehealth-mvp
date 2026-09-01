// Akademik başlık çevirisi BACKFILL'i (2026-08-31, kullanıcı kararı: "bültende İngilizce
// başlık olmasın") — mevcut çevrilmemiş kayıtları (titleOriginal IS NULL) Türkçeleştirir.
// İleri-dönük çeviri ingest'te (lib/translate-news); bu script birikmişi kapatır.
//
// KULLANIM (dev DB — .env):  npx tsx scripts/translate-titles-backfill.ts        (DRY-RUN)
//   uygulamak için:          npx tsx scripts/translate-titles-backfill.ts --yaz
//   isteğe bağlı:            --limit 2000
// ⚠️ PROD: --prod bayrağı PROD_DATABASE_URL ister (proje kuralı: prod'a açık onay + açık env).
import { config } from "dotenv";
config();

async function main() {
  const yaz = process.argv.includes("--yaz");
  const prod = process.argv.includes("--prod");
  const li = process.argv.indexOf("--limit");
  const limit = li > -1 ? Number(process.argv[li + 1]) || 2000 : 2000;

  if (prod) {
    if (!process.env.PROD_DATABASE_URL) {
      console.error("--prod için PROD_DATABASE_URL gerekli (dev .env'i prod sanma korkuluğu).");
      process.exit(1);
    }
    process.env.DATABASE_URL = process.env.PROD_DATABASE_URL;
  }

  // Dinamik import: dotenv yüklendikten SONRA (db.ts modül yüklenirken DATABASE_URL okur).
  const { db } = await import("../src/lib/db");
  const { translateTitlesTr } = await import("../src/lib/translate-news");

  const toplam = await db.newsArticle.count({ where: { module: "akademik", titleOriginal: null } });
  const rows = await db.newsArticle.findMany({
    where: { module: "akademik", titleOriginal: null },
    select: { id: true, title: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
  });
  console.log(`${prod ? "PROD" : "dev"} DB · çevrilmemiş akademik kayıt TOPLAM: ${toplam} · bu koşuda: ${rows.length} (limit ${limit}) · mod: ${yaz ? "YAZ" : "DRY-RUN"}`);
  if (!rows.length) return;

  const ceviriler = await translateTitlesTr(rows.map((r) => r.title));
  let cevrildi = 0;
  let atlandi = 0; // zaten Türkçe / çeviri gelmedi (fail-open)
  for (let i = 0; i < rows.length; i++) {
    const tr = ceviriler[i];
    if (!tr) { atlandi++; continue; }
    if (yaz) {
      await db.newsArticle.update({
        where: { id: rows[i].id },
        data: { title: tr, titleOriginal: rows[i].title },
      });
    } else if (cevrildi < 10) {
      console.log(`  "${rows[i].title.slice(0, 60)}" → "${tr.slice(0, 60)}"`);
    }
    cevrildi++;
  }
  console.log(`bitti — çevrilen: ${cevrildi} · atlanan: ${atlandi}${yaz ? "" : " · (dry-run: DB'ye yazılmadı; ilk 10 örnek yukarıda)"}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
