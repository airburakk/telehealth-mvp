// TR kaynakları YERELDEN besleme — Resmî Gazete + OHSAD (v6.59, 2026-08-03) — kalıcı araç.
//
// NEDEN: v6.57 teşhis turu kanıtladı — RG'ye Vercel fra1'den TCP bağlantısı hiç kurulamıyor
// (veri-merkezi IP aralığı sessizce DROP ediliyor), OHSAD ise Cloudflare IP-itibar korumasına
// takılıyor (403; gerçekçi tarayıcı başlıkları yetmedi). İkisi de YEREL (TR ev) IP'den 200
// veriyor → içerik, bilgisayar açıkken bu script'le toplanıp prod'a taşınır (kullanıcı kararı,
// 2026-08-03: seçenek a'). TTB'ye GEREK YOK — v6.59 TLS zincir onarımıyla cron kendisi topluyor.
//
// GÜVENLİK TASARIMI (kullanıcı vaadi: AURA_DB_GUARD kalıcı olarak GEVŞETİLMEZ):
//   • Varsayılan DRY-RUN: hiçbir şey yazılmaz; "şunlar yazılırdı" listelenir. Yazma = --yaz.
//   • Varsayılan hedef: DATABASE_URL (yerel .env → Neon DEV branch).
//   • Prod hedefi YALNIZ --prod bayrağıyla ve YALNIZ ayrı PROD_DATABASE_URL env'i varsa.
//     DATABASE_URL'i elle prod'a çevirme akışı DESTEKLENMEZ (aşağıdaki ters-korkuluk durdurur).
//   • --prod modunda db.ts guard'ı process-İÇİ "warn"a çekilir (kalıcı .env'e dokunulmaz;
//     guard mesajı yine yüksek sesle basılır). Yazılan tek tablo NewsArticle — PHI YOK
//     (kamuya açık mevzuat/haber), şifreleme katmanına hiç girmez.
//
// Kullanım:
//   npx tsx scripts/ingest-tr-sources.ts                  → DEV, dry-run, RG son 7 gün + OHSAD
//   npx tsx scripts/ingest-tr-sources.ts --gun=30         → RG arşiv derinliği 30 gün
//   npx tsx scripts/ingest-tr-sources.ts --yaz            → DEV'e gerçekten yaz
//   npx tsx scripts/ingest-tr-sources.ts --prod           → PROD'a karşı dry-run (salt okuma)
//   npx tsx scripts/ingest-tr-sources.ts --prod --yaz     → PROD'a yaz
//
// İdempotent: (source, externalId) benzersiz → yeniden koşuda 0 yeni. Hiçbir şey SİLMEZ.
import "dotenv/config";

const args = process.argv.slice(2);
const DRY = !args.includes("--yaz");
const PROD = args.includes("--prod");
const DAYS = Math.min(1100, Math.max(0, Number(args.find((a) => a.startsWith("--gun="))?.slice(6)) || 7));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const GAP_MS = 250; // RG arşivine ~4 istek/sn (kurum sitesini yormamak için)

async function main() {
  if (PROD) {
    const prodUrl = process.env.PROD_DATABASE_URL;
    if (!prodUrl) {
      console.error("⛔ --prod istendi ama PROD_DATABASE_URL tanımlı değil. Bilinçli prod akışı bu env'i ŞART koşar.");
      process.exit(1);
    }
    // db.ts guard'ı block'ta import anında fırlatır; bilinçli --prod akışında process-içi warn'a
    // çekilir (guard mesajı yine basılır). Kalıcı .env değişmez.
    process.env.DATABASE_URL = prodUrl;
    if (process.env.AURA_DB_GUARD === "block") process.env.AURA_DB_GUARD = "warn";
    console.log(`🎯 HEDEF: ÜRETİM ${DRY ? "(dry-run — yazma YOK, yalnız var-mı okuması)" : "(YAZILACAK)"}`);
  } else {
    // Ters-korkuluk: --prod verilmeden DATABASE_URL zaten prod'u gösteriyorsa (yanlış .env) DUR.
    const fp = process.env.PROD_DB_FINGERPRINT;
    if (fp && (process.env.DATABASE_URL ?? "").includes(fp)) {
      console.error("⛔ DATABASE_URL üretime işaret ediyor ama --prod verilmedi; kazara yazımı önlemek için durduruldu.");
      console.error("   Üretim bilinçli hedefse: --prod (+ yazmak için --yaz) kullan.");
      process.exit(1);
    }
    console.log(`🎯 HEDEF: DEV ${DRY ? "(dry-run)" : "(yazılacak)"}`);
  }

  // Dinamik import ŞART: src/lib/db, DATABASE_URL/AURA_DB_GUARD'ı MODÜL YÜKLENİRKEN okur —
  // yukarıdaki env ayarları import'tan önce bitmeliydi (statik import bu sırayı bozar).
  const { fetchGazetteToday, fetchGazetteArchive, ingestGazetteItems, ingestOhsad, describeFetchError } =
    await import("../src/lib/doctorium-sources");
  const { db } = await import("../src/lib/db");

  const onItem = (line: string) => console.log(`  ${DRY ? "→ yazılırdı" : "＋ yazıldı "} ${line}`);
  let rgScanned = 0, rgNew = 0, rgEmpty = 0, rgFail = 0;

  // ── Resmî Gazete: bugün + son N gün arşiv ─────────────────────────────────
  console.log(`\n📜 Resmî Gazete (bugün + son ${DAYS} gün arşiv)`);
  try {
    const today = await fetchGazetteToday();
    const [s, c] = await ingestGazetteItems(today, { dryRun: DRY, onItem });
    rgScanned += s; rgNew += c;
  } catch (e) {
    rgFail++;
    console.warn(`  ⚠ bugün: ${describeFetchError(e).slice(0, 160)}`);
  }
  for (let i = 1; i <= DAYS; i++) {
    const d = new Date(Date.now() - i * 86400000);
    if (d.getUTCDay() === 0) continue; // Pazar günü RG yayımlanmaz
    try {
      const items = await fetchGazetteArchive(d);
      if (!items.length) { rgEmpty++; continue; }
      const [s, c] = await ingestGazetteItems(items, { dryRun: DRY, onItem });
      rgScanned += s; rgNew += c;
    } catch (e) {
      rgFail++;
      if (rgFail <= 3) console.warn(`  ⚠ ${d.toISOString().slice(0, 10)}: ${describeFetchError(e).slice(0, 160)}`);
    }
    await sleep(GAP_MS);
  }
  console.log(`  RG: taranan ${rgScanned} · yeni ${rgNew} · boş gün ${rgEmpty} · hata ${rgFail}`);

  // ── OHSAD ─────────────────────────────────────────────────────────────────
  console.log("\n🏥 OHSAD");
  let ohsad: [number, number] = [0, 0];
  try {
    ohsad = await ingestOhsad({ dryRun: DRY, onItem });
    console.log(`  OHSAD: taranan ${ohsad[0]} · yeni ${ohsad[1]}`);
  } catch (e) {
    console.warn(`  ⚠ OHSAD: ${describeFetchError(e).slice(0, 160)}`);
  }

  // ── Özet ──────────────────────────────────────────────────────────────────
  const [rgTotal, ohsadTotal] = await Promise.all([
    db.newsArticle.count({ where: { source: "resmi-gazete" } }),
    db.newsArticle.count({ where: { source: "ohsad" } }),
  ]);
  console.log(`\n${DRY ? "🔍 DRY-RUN — yazılan yok." : "✅ Yazma tamamlandı."}`);
  console.log(`Hedef DB'de toplam: resmi-gazete=${rgTotal} · ohsad=${ohsadTotal}`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
