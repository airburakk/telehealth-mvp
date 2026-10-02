// RSS kimlik geçişi ÇİFT KAYIT temizliği (v6.307, 2026-10-02, 👤 onay — arka plan: src/lib/rss-twins.ts başlığı).
//
// NEDEN: 1438e05 (2026-09-29) ingestRss kimliğini link → guid yaptı, eski satırlar taşınmadı → 30 Eylül gecesi dernek
// beslemelerinde (klimik / tjod / tatd / tgd-gastro / tgcd) pencere içindeki eski kalemler yeni kimlikle YENİDEN yaratıldı.
// Kod tarafı v6.307'de kapandı (adoptLegacyRssKey — artık yeni çift oluşmaz); bu betik OLUŞMUŞ ikizleri birleştirir.
//
// NE YAPAR (çift başına TEK transaction):
//   1. Yeni ikize işaret eden `SavedArticle` satırları eski satıra çevrilir (doktor ikisini de kaydettiyse fazlası silinir).
//   2. `DailyDigest.itemsJson` anlık görüntülerindeki yeni ikiz id'si eski id ile değiştirilir (Post arşiv bağlantısı kopmaz).
//   3. Eski satırın AI özeti yoksa ikizinki taşınır (yeniden üretim maliyeti doğmasın).
//   4. Yeni ikiz SİLİNİR; eski satırın `externalId`'si guid'e çevrilir (sonraki gece "var" bulunur).
// KALAN = ESKİ satır: gerçek ilk görülme tarihi (`createdAt` → tazelik pencereleri) ve kaydetmeler onda.
// Beklenen kalıba uymayan gruplar (3+ satır vb.) ve "aynı başlık / farklı URL" kümeleri yalnız RAPORLANIR, dokunulmaz.
//
// KULLANIM (dry-run varsayılan — hiçbir şey yazmaz):
//   npx tsx scripts/dedupe-rss-guid.ts              → dev sayım
//   npx tsx scripts/dedupe-rss-guid.ts --yaz        → dev'de birleştir
//   npx tsx scripts/dedupe-rss-guid.ts --prod       → ÜRETİM sayım (PROD_DATABASE_URL açıkça; fallback YOK)
//   npx tsx scripts/dedupe-rss-guid.ts --prod --yaz
// İçerik herkese açık haber başlığıdır (PHI değil) — örnek başlıklar basılır. İdempotent: ikinci koşu 0 çift bulur.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { ASSOCIATION_RSS_SOURCES, RSS_SOURCES } from "../src/lib/doctorium-sources";
import { scanRssTwins } from "../src/lib/rss-twins";

const PROD = process.argv.includes("--prod");
const YAZ = process.argv.includes("--yaz");
const url = PROD ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!url) {
  console.error(PROD ? "✋ PROD_DATABASE_URL tanımsız — üretim işlemi açık niyet ister." : "✋ DATABASE_URL tanımsız.");
  process.exit(1);
}
if (!PROD) {
  const fp = process.env.PROD_DB_FINGERPRINT;
  if (fp && url.includes(fp)) { console.error("⛔ DATABASE_URL üretim parmak izini içeriyor — üretim için --prod kullan."); process.exit(1); }
}
// lib/doctorium-sources kendi `db` istemcisini (yerel .env) İÇE ALIR ama bu betik onu hiç SORGULAMAZ — tüm okuma/yazma aşağıdaki
// açık-URL'li istemciden geçer (hedef karışmasın).
const db = new PrismaClient({ datasourceUrl: url });

const SOURCES = [...RSS_SOURCES, ...ASSOCIATION_RSS_SOURCES].map((s) => s.source);
const kisalt = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

async function main() {
  console.log(`🧹 RSS kimlik geçişi çift kayıt temizliği — hedef: ${PROD ? "ÜRETİM" : "dev"} · mod: ${YAZ ? "YAZ" : "DRY-RUN"}`);
  const rows = await db.newsArticle.findMany({
    where: { source: { in: SOURCES }, url: { not: null } },
    select: { id: true, source: true, externalId: true, url: true, createdAt: true, title: true, aiSummary: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  console.log(`Taranan: ${rows.length} satır · ${SOURCES.length} kaynak (${SOURCES.join(", ")})`);

  const scan = scanRssTwins(rows);
  const perSource = new Map<string, number>();
  for (const p of scan.pairs) perSource.set(p.source, (perSource.get(p.source) ?? 0) + 1);
  console.log(`\nOnarılabilir çift: ${scan.pairs.length}${scan.pairs.length ? ` → ${[...perSource].map(([s, n]) => `${s} ${n}`).join(" · ")}` : ""}`);
  for (const p of scan.pairs) {
    console.log(`  [${p.source}] ${kisalt(p.keep.title)}  (eski ${p.keep.createdAt.toISOString().slice(0, 10)} ← ikiz ${p.drop.createdAt.toISOString().slice(0, 10)})`);
  }

  if (scan.odd.length) {
    console.log(`\nİnceleme (DOKUNULMAZ — beklenen kalıp dışı): ${scan.odd.length} grup`);
    for (const o of scan.odd) console.log(`  [${o.source}] ${o.reason} · ${kisalt(o.url, 100)}`);
  }

  // Bilgi: aynı kaynak + aynı başlık, FARKLI URL (WordPress'te tarihi değişen yazı — 1438e05'in asıl hedefi). Dokunulmaz:
  // başlık kimlik değildir ("Duyuru" gibi yinelenen başlıklar meşru olabilir).
  const byTitle = new Map<string, Set<string>>();
  for (const r of rows) {
    const k = `${r.source}\n${r.title}`;
    const urls = byTitle.get(k) ?? new Set<string>();
    urls.add(r.url as string);
    byTitle.set(k, urls);
  }
  const sameTitle = [...byTitle].filter(([, urls]) => urls.size > 1);
  if (sameTitle.length) {
    console.log(`\nBilgi (DOKUNULMAZ): aynı kaynak + aynı başlık, farklı URL: ${sameTitle.length} küme`);
    for (const [k, urls] of sameTitle.slice(0, 12)) console.log(`  [${k.split("\n")[0]}] ${kisalt(k.split("\n")[1])} · ${urls.size} URL`);
  }

  if (scan.pairs.length === 0) { console.log("\n✓ Birleştirilecek çift yok."); return; }

  // Bağlı kayıt sayımı (kuru koşuda da görünür — yazımın neye dokunacağı önceden bilinir).
  const dropIds = scan.pairs.map((p) => p.drop.id);
  const saveCount = await db.savedArticle.count({ where: { articleId: { in: dropIds } } });
  let digestCount = 0;
  for (const id of dropIds) digestCount += await db.dailyDigest.count({ where: { itemsJson: { contains: `"${id}"` } } });
  const ozetTasinacak = scan.pairs.filter((p) => !p.keep.aiSummary && p.drop.aiSummary).length;
  console.log(`\nİkizlere bağlı kayıt: kaydetme ${saveCount} · Post baskısı başvurusu ${digestCount} · taşınacak AI özeti ${ozetTasinacak}`);

  if (!YAZ) { console.log(`\nDRY-RUN: ${scan.pairs.length} çift birleştirilecekti — yazmak için --yaz.`); return; }

  let done = 0;
  for (const p of scan.pairs) {
    await db.$transaction(async (tx) => {
      const saves = await tx.savedArticle.findMany({ where: { articleId: p.drop.id }, select: { id: true, doctorId: true } });
      for (const s of saves) {
        const mevcut = await tx.savedArticle.findUnique({ where: { doctorId_articleId: { doctorId: s.doctorId, articleId: p.keep.id } }, select: { id: true } });
        if (mevcut) await tx.savedArticle.delete({ where: { id: s.id } });
        else await tx.savedArticle.update({ where: { id: s.id }, data: { articleId: p.keep.id } });
      }
      const digests = await tx.dailyDigest.findMany({ where: { itemsJson: { contains: `"${p.drop.id}"` } }, select: { id: true, itemsJson: true } });
      for (const d of digests) {
        await tx.dailyDigest.update({ where: { id: d.id }, data: { itemsJson: d.itemsJson.split(`"${p.drop.id}"`).join(`"${p.keep.id}"`) } });
      }
      await tx.newsArticle.delete({ where: { id: p.drop.id } });
      await tx.newsArticle.update({
        where: { id: p.keep.id },
        data: { externalId: p.drop.externalId, ...(!p.keep.aiSummary && p.drop.aiSummary ? { aiSummary: p.drop.aiSummary } : {}) },
      });
    });
    done++;
  }
  console.log(`\n✅ ${done} çift birleştirildi (ikiz silindi, eski satır guid'e anahtarlandı).`);
}

main().catch((e) => { console.error("❌", e instanceof Error ? e.message : e); process.exitCode = 1; }).finally(() => db.$disconnect());
