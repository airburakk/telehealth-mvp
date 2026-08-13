// Doktrin (TR-Dizin) — YEREL ilk dolum + elle tazeleme (v6.91, 2026-08-12) — kalıcı araç.
//
// İçtihat'ın aksine tek aşamalı ve ucuz (metadata arama yanıtında tam gelir; ikinci belge isteği
// yok) — cron her gece sorgu başına İLK sayfayı zaten tarar. Bu script tam ilk dolumu (sorgu
// başına en yeni MAX_PAGES sayfa) tek koşuda yapar; TR-Dizin'de saha freni gözlemlenmedi ama
// GAP + ardışık-hata korumaları lib'te durur (Yargıtay dersi: fizibilite ≠ işletim).
//
// GÜVENLİK TASARIMI ingest-yargitay/ingest-tr-sources ile AYNI:
//   • Varsayılan DRY-RUN; yazma = --yaz. Varsayılan hedef DEV; prod YALNIZ --prod + PROD_DATABASE_URL.
//   • Yazılan tek tablo NewsArticle — TELİF sınırı lib'te: yalnız başlık+yazar+ÖZET+link (dizinin
//     herkese açık metadata'sı); tam metin/PDF ASLA. PHI yok.
//
// Kullanım:
//   npx tsx scripts/ingest-doktrin.ts                → DEV, dry-run (arama + fark raporu)
//   npx tsx scripts/ingest-doktrin.ts --yaz          → DEV'e yaz
//   npx tsx scripts/ingest-doktrin.ts --prod         → PROD'a karşı dry-run (salt okuma)
//   npx tsx scripts/ingest-doktrin.ts --prod --yaz   → PROD'a yaz
//
// İdempotent: (source=trdizin, externalId) benzersiz → yeniden koşuda 0 yeni. Hiçbir şey SİLMEZ.
import "dotenv/config";

const args = process.argv.slice(2);
const DRY = !args.includes("--yaz");
const PROD = args.includes("--prod");

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
  const { ingestDoktrin, DOKTRIN_QUERIES, searchUrl, pickTitleAbstract, matchesQuery, GAP_MS } = await import("../src/lib/doktrin-ingest");
  const { db } = await import("../src/lib/db");

  if (DRY) {
    // Dry-run: arama havuzunu kur (lib ile AYNI ibare süzgeci), DB ile karşılaştır — yazma YOK.
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const pool = new Map<string, string>();
    for (const q of DOKTRIN_QUERIES) {
      let total = 0;
      let matched = 0;
      try {
        for (let p = 1; p <= 5; p++) {
          const j = (await fetch(searchUrl(q, p), { headers: { "User-Agent": "Mozilla/5.0" } }).then((r) => r.json())) as {
            error?: { reason?: string };
            hits?: { total?: { value?: number }; hits?: { _source?: Parameters<typeof matchesQuery>[0] & { id?: number | string } }[] };
          };
          if (j?.error) throw new Error(String(j.error.reason).slice(0, 80));
          total = j?.hits?.total?.value ?? 0;
          for (const h of j?.hits?.hits ?? []) {
            const s = h._source;
            if (s?.id != null && matchesQuery(s, q)) {
              matched++;
              pool.set(String(s.id), pickTitleAbstract(s.abstracts)?.title ?? "(başlıksız)");
            }
          }
          if ((j?.hits?.hits ?? []).length === 0 || p * 24 >= total) break;
          await sleep(GAP_MS);
        }
      } catch (e) {
        console.error(`  ⚠️ arama "${q}": ${e instanceof Error ? e.message : e}`);
        break;
      }
      console.log(`  🔎 ${q} → ${total} ES sonucu · ibare-doğrulanan ${matched} (ilk 5 sayfa)`);
      await sleep(GAP_MS);
    }
    const ids = [...pool.keys()];
    const existing = ids.length
      ? await db.newsArticle.findMany({ where: { source: "trdizin", externalId: { in: ids } }, select: { externalId: true } })
      : [];
    const known = new Set(existing.map((r) => r.externalId));
    const fresh = ids.filter((id) => !known.has(id));
    console.log(`\n📊 Benzersiz yayın: ${pool.size} · DB'de var: ${known.size} · YAZILIRDI: ${fresh.length}`);
    for (const id of fresh.slice(0, 12)) console.log(`   + ${pool.get(id)?.slice(0, 90)}`);
    if (fresh.length > 12) console.log(`   … +${fresh.length - 12} yayın daha`);
    console.log("\nYazmak için: --yaz");
  } else {
    console.log("📥 Doktrin toplama başlıyor…");
    const r = await ingestDoktrin(); // tam varsayılanlar: 5 sorgu × 5 sayfa
    console.log(`\n📊 bulunan=${r.found} yazılan=${r.created}`);
    for (const e of r.errors) console.error(`  ⚠️ ${e}`);
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error("⛔ beklenmeyen hata:", e);
  process.exit(1);
});
