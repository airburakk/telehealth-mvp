// Registry fingerprint backfill (v5.4, 2026-07-11) — BİR DEFALIK yerel koşu.
// Mevcut kayıtların fingerprint'ini DB'DEKİ değerlerden hesaplar (kaynağa istek YOK):
// satırlar kaynaktan çekilmiş anlık görüntü olduğundan, DB-değerlerinden hesaplanan hash
// "kayıt eklenirken kaynaktaki hali"ne eşittir → sonraki senkronlarda kaynak değişirse
// hash uyuşmaz ve yalnız o kayıt güncellenir. Yeni eklenen kayıtlar hash'ini senkronda alır.
// ⚠️ Yerel .env'in DATABASE_URL'ine yazar (yerel .env = PROD Neon — hedefi bilerek koş).
// Çalıştırma: npx tsx scripts/registry-fingerprint-backfill.ts
import { db } from "../src/lib/db";
import { doctorFpFromRow, hospitalFpFromRow } from "../src/lib/ht-registry";

const READ_BATCH = 1000;
const WRITE_CONCURRENCY = 10;

async function chunkRun<T>(rows: T[], run: (r: T) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += WRITE_CONCURRENCY) {
    await Promise.all(rows.slice(i, i + WRITE_CONCURRENCY).map(run));
  }
}

async function main() {
  const t0 = Date.now();

  // ── Doktorlar ──
  let docDone = 0;
  for (;;) {
    const rows = await db.registryDoctor.findMany({
      where: { removedAt: null, fingerprint: null },
      select: { id: true, name: true, lastName: true, jobName: true, jobId: true, branchName: true, branchId: true, cityId: true, establishmentId: true, establishmentName: true, slug: true, address: true, experience: true, genderId: true },
      take: READ_BATCH,
    });
    if (!rows.length) break;
    await chunkRun(rows, (r) => db.registryDoctor.update({ where: { id: r.id }, data: { fingerprint: doctorFpFromRow(r) } }));
    docDone += rows.length;
    console.log(`  doktor ${docDone} · ${((Date.now() - t0) / 1000).toFixed(0)}sn`);
  }

  // ── Tesisler ──
  let hospDone = 0;
  for (;;) {
    const rows = await db.registryHospital.findMany({
      where: { removedAt: null, fingerprint: null },
      select: { id: true, name: true, slug: true, cityName: true, cityCode: true, cityHasAirport: true, address: true, phone: true, totalPersonnel: true, unitCapacity: true, facilityTypeId: true, facilityTypeName: true, accreditationCount: true, certificationCount: true, insuranceCount: true, doctorCount: true, foundationYear: true, latitude: true, longitude: true, branches: true, treatments: true },
      take: READ_BATCH,
    });
    if (!rows.length) break;
    await chunkRun(rows, (r) => db.registryHospital.update({ where: { id: r.id }, data: { fingerprint: hospitalFpFromRow(r) } }));
    hospDone += rows.length;
    console.log(`  tesis ${hospDone} · ${((Date.now() - t0) / 1000).toFixed(0)}sn`);
  }

  const remainDoc = await db.registryDoctor.count({ where: { removedAt: null, fingerprint: null } });
  const remainHosp = await db.registryHospital.count({ where: { removedAt: null, fingerprint: null } });
  console.log(`\nBitti: ${((Date.now() - t0) / 1000).toFixed(1)}sn · doktor ${docDone} · tesis ${hospDone} · kalan null: doktor ${remainDoc} / tesis ${remainHosp}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
