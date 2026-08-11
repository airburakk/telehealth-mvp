// Yargıtay İçtihat — YEREL ilk dolum + elle tazeleme (v6.86, 2026-08-06) — kalıcı araç.
//
// NEDEN: cron koşusu başına metin tavanı düşük (lib/hukuk-ingest MAX_DOC_FETCH_DEFAULT — bakım
// nöbetinin bütçesi); yüzlerce kararlık İLK DOLUM cron'a sığmaz → bilgisayar açıkken buradan
// koşulur. Ayrıca Vercel fra1 → devlet sitesi erişimi garanti değil (RG dersi, ingest-tr-sources
// başlığı); cron'da sürekli hata görülürse kalıcı besleme yolu da burasıdır.
//
// GÜVENLİK TASARIMI ingest-tr-sources.ts ile AYNI (kullanıcı vaadi: AURA_DB_GUARD kalıcı gevşetilmez):
//   • Varsayılan DRY-RUN: yazılmaz; "şu kadar yeni yazılırdı" raporlanır. Yazma = --yaz.
//   • Varsayılan hedef DEV (DATABASE_URL); prod YALNIZ --prod + ayrı PROD_DATABASE_URL.
//   • Yazılan tek tablo NewsArticle — PHI YOK (kamuya açık, kaynakta anonimleştirilmiş yargı
//     kararları), şifreleme katmanına girmez.
//
// Kullanım:
//   npx tsx scripts/ingest-yargitay.ts                → DEV, dry-run (arama + fark raporu)
//   npx tsx scripts/ingest-yargitay.ts --yaz          → DEV'e yaz (varsayılan tavan 500 metin)
//   npx tsx scripts/ingest-yargitay.ts --yaz --limit=50
//   npx tsx scripts/ingest-yargitay.ts --prod         → PROD'a karşı dry-run (salt okuma)
//   npx tsx scripts/ingest-yargitay.ts --prod --yaz   → PROD'a yaz
//
// İdempotent: (source=yargitay, externalId) benzersiz → yeniden koşuda 0 yeni. Hiçbir şey SİLMEZ.
import "dotenv/config";

const args = process.argv.slice(2);
const DRY = !args.includes("--yaz");
const PROD = args.includes("--prod");
const LIMIT = Math.min(2000, Math.max(1, Number(args.find((a) => a.startsWith("--limit="))?.slice(8)) || 500));

async function main() {
  if (PROD) {
    const prodUrl = process.env.PROD_DATABASE_URL;
    if (!prodUrl) {
      console.error("⛔ --prod istendi ama PROD_DATABASE_URL tanımlı değil. Bilinçli prod akışı bu env'i ŞART koşar.");
      process.exit(1);
    }
    process.env.DATABASE_URL = prodUrl;
    if (process.env.AURA_DB_GUARD === "block") process.env.AURA_DB_GUARD = "warn";
    console.log(`🎯 HEDEF: ÜRETİM ${DRY ? "(dry-run — yazma YOK, yalnız var-mı okuması)" : "(YAZILACAK)"}`);
  } else {
    const fp = process.env.PROD_DB_FINGERPRINT;
    if (fp && (process.env.DATABASE_URL ?? "").includes(fp)) {
      console.error("⛔ DATABASE_URL üretime işaret ediyor ama --prod verilmedi; kazara yazımı önlemek için durduruldu.");
      process.exit(1);
    }
    console.log(`🎯 HEDEF: DEV ${DRY ? "(dry-run)" : "(yazılacak)"}`);
  }

  // Dinamik import ŞART (ingest-tr-sources dersi): src/lib/db env'i MODÜL YÜKLENİRKEN okur.
  const { ingestYargitay, searchYargitay, YARGITAY_QUERIES, GAP_MS } = await import("../src/lib/hukuk-ingest");
  const { db } = await import("../src/lib/db");

  if (DRY) {
    // Dry-run: arama havuzunu kur, DB ile karşılaştır, HİÇBİR metin çekme / yazma yapma.
    // Bekleme lib sabitinden (GAP_MS): 2026-08-06 sahası — 1 sn aralık ~20 istekte HTTP 429 yedi.
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const pool = new Map<string, string>(); // id → örnek başlık bilgisi
    for (const q of YARGITAY_QUERIES) {
      let total = 0;
      try {
        const first = await searchYargitay(q, 1);
        total = first.total;
        for (const r of first.records) pool.set(r.id, `${r.daire} E.${r.esasNo} K.${r.kararNo} (${r.kararTarihi})`);
        const pages = Math.min(Math.ceil(first.total / 10), 40);
        for (let p = 2; p <= pages; p++) {
          await sleep(GAP_MS);
          for (const r of (await searchYargitay(q, p)).records) {
            pool.set(r.id, `${r.daire} E.${r.esasNo} K.${r.kararNo} (${r.kararTarihi})`);
          }
        }
      } catch (e) {
        console.error(`  ⚠️ arama "${q}": ${e instanceof Error ? e.message : e}`);
        break;
      }
      console.log(`  🔎 ${q} → ${total} sonuç`);
      await sleep(GAP_MS);
    }
    const ids = [...pool.keys()];
    const existing = ids.length
      ? await db.newsArticle.findMany({ where: { source: "yargitay", externalId: { in: ids } }, select: { externalId: true } })
      : [];
    const known = new Set(existing.map((r) => r.externalId));
    const fresh = ids.filter((id) => !known.has(id));
    console.log(`\n📊 Benzersiz karar: ${pool.size} · DB'de var: ${known.size} · YAZILIRDI: ${fresh.length}`);
    for (const id of fresh.slice(0, 15)) console.log(`   + ${pool.get(id)}`);
    if (fresh.length > 15) console.log(`   … +${fresh.length - 15} karar daha`);
    console.log("\nYazmak için: --yaz (metin çekimi karar başına ~1 sn sürer)");
  } else {
    console.log(`📥 İçtihat toplama başlıyor (metin tavanı ${LIMIT})…`);
    // queries AÇIKÇA verilir: parametresiz çağrı cron'un GÜNLÜK ROTASYONUNU (2 sorgu) seçer —
    // ilk dolum tüm listeyi taramalı.
    const r = await ingestYargitay({ maxDocFetch: LIMIT, queries: YARGITAY_QUERIES });
    console.log(`\n📊 bulunan=${r.found} yazılan=${r.created} erteli=${r.deferred}`);
    for (const e of r.errors) console.error(`  ⚠️ ${e}`);
    if (r.deferred > 0) console.log("  ↻ Kalanlar için script'i yeniden koş (idempotent).");
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error("⛔ beklenmeyen hata:", e);
  process.exit(1);
});
