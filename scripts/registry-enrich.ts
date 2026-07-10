// HealthTürkiye tesis detay zenginleştirme — ELLE bulk koşu (ilk doldurma). 2026-07-10.
// languages=null tüm aktif tesisleri sitenin SSR detay JSON'undan doldurur
// (languages/accreditations/facilities ADLARI + yetki belge no). Cron aynı fonksiyonu
// günlük 40'lık bütçeyle koşar; bu script birikmişleri tek seferde bitirir.
// ⚠️ Yerel .env'in DATABASE_URL'ine yazar (yerel .env = PROD Neon — hedefi bilerek koş).
// Çalıştırma: npx tsx scripts/registry-enrich.ts            → yeni tesisler (languages=null)
//             npx tsx scripts/registry-enrich.ts auth       → v5.2 authorizationNumber backfill
import { enrichHospitalDetails } from "../src/lib/ht-registry";
import { db } from "../src/lib/db";

const BATCH = 200;
const MODE = process.argv[2] === "auth" ? ("auth-backfill" as const) : ("new" as const);

async function main() {
  const where = MODE === "auth-backfill"
    ? { removedAt: null, authorizationNumber: null }
    : { removedAt: null, languages: null };
  const backlog = await db.registryHospital.count({ where });
  console.log(`Zenginleştirme başlıyor (mod: ${MODE}) — bekleyen tesis: ${backlog}`);
  const t0 = Date.now();
  let done = 0, enriched = 0, empty = 0, failedTotal = 0;

  for (;;) {
    const s = await enrichHospitalDetails(BATCH, MODE);
    if (s.scanned === 0) break;
    done += s.scanned; enriched += s.enriched; empty += s.empty; failedTotal += s.failed;
    const sec = ((Date.now() - t0) / 1000).toFixed(0);
    console.log(`  ${done}/${backlog} · +${s.enriched} dolu · ${s.empty} detaysız · ${s.failed} hata · ${sec}sn`);
    // Parti tamamen hata verdiyse (site/ağ düştü) sonsuz döngüye girme — kalanlar cron'a kalır
    if (s.failed === s.scanned) { console.log("Parti tamamen hatalı — koşu durduruluyor (kalanlar sonraki koşuya)."); break; }
  }

  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nBitti: ${sec}sn · taranan ${done} · dolu ${enriched} · detaysız ${empty} · hata ${failedTotal}`);
  const remaining = await db.registryHospital.count({ where });
  console.log(`Kalan (null): ${remaining} — bunlar günlük cron'da / yeniden koşuda denenir.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
