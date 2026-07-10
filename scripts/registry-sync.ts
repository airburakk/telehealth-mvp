// HealthTürkiye kayıt defteri — ELLE senkron (ilk tam çekim / sorun giderme). FAZ 6 (2026-07-10).
// Cron (api/cron/registry-sync) aynı fonksiyonu günlük koşar; bu script yereldeki .env'in
// DATABASE_URL'ine yazar (⚠️ yerel .env = PROD Neon — koşmadan önce hedefi bilerek koş).
// Çalıştırma: npx tsx scripts/registry-sync.ts
import { runRegistrySync } from "../src/lib/ht-registry";

async function main() {
  console.log("HealthTürkiye senkronu başlıyor (doktor + tesis, tek rapor)...");
  const t0 = Date.now();
  const s = await runRegistrySync();
  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nDurum: ${s.status} · ${s.date} · ${sec}sn`);
  console.log(`Doktor: ${s.doctorsTotal} aktif · +${s.addedDoctors.length} eklendi · −${s.removedDoctors.length} çıkarıldı`);
  console.log(`Tesis : ${s.hospitalsTotal} aktif · +${s.addedHospitals.length} eklendi · −${s.removedHospitals.length} çıkarıldı`);
  if (s.detail) console.log(`Not: ${s.detail}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
