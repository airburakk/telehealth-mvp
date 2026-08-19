// e-Devlet ÇEVRİMİÇİ doğrulama istemcisi — yerel duman testi (v6.130).
//
// Kullanım:
//   EDEVLET_VERIFY_ENABLED=1 npx tsx scripts/edevlet-dogrula-dene.ts <BARKOD> <TC> ["Ad Soyad"]
//
// NİÇİN VAR: `lib/edevlet-dogrula.ts` üretimde açılmadan ÖNCE bir kez gerçek serviste koşmalıdır.
// Sabitler (btn / negatif imzalar) canlı formdan kalibre edildi ama Node tarafındaki çerez kavanozu
// + elle 302 izleme + form gönderimi zinciri hiç sınanmadı. Sessiz bir hata `BELIRSIZ` üretir ve
// (onayKarari gereği) TÜM doğrulamaları insan incelemesine düşürür — bayrağı açmadan bunu görmeliyiz.
//
// 🔒 GİZLİLİK: barkod/TC yalnız argümandan okunur, hiçbir yere yazılmaz; çıktıda TC maskelidir.
// ⚖️ Bu betik akışın 3. aşamasındaki taahhüdü kabul eder (lib/edevlet-dogrula.ts başlığı) —
//    kullanıcı kararı 2026-08-19.

import { edevletDogrula } from "../src/lib/edevlet-dogrula";

const [, , barkod, tc, ad] = process.argv;
if (!barkod || !tc) {
  console.error('Kullanım: EDEVLET_VERIFY_ENABLED=1 npx tsx scripts/edevlet-dogrula-dene.ts <BARKOD> <TC> ["Ad Soyad"]');
  process.exit(1);
}

async function main() {
  const t0 = Date.now();
  const r = await edevletDogrula(barkod, tc, ad ?? null);
  const ms = Date.now() - t0;

  console.log("\n── e-Devlet çevrimiçi doğrulama ─────────────────");
  console.log(`  Barkod      : ${barkod}`);
  console.log(`  TC (maskeli): ${tc.slice(0, 3)}********`);
  console.log(`  Profil adı  : ${ad ?? "(verilmedi)"}`);
  console.log(`  Süre        : ${ms} ms`);
  console.log("\n── Sonuç ────────────────────────────────────────");
  console.log(`  DURUM : ${r.durum}`);
  console.log(`  Neden : ${r.reason}`);
  if (r.sonuc) {
    console.log(`  Resmî nüsha değerlendirmesi: ok=${r.sonuc.ok} tanindi=${r.sonuc.tanindi}`);
    console.log(`  Barkod (resmî nüshadan)    : ${r.sonuc.barcode ?? "—"}`);
  }
  console.log("");
  if (r.durum === "KAPALI") {
    console.log("  ⚠️ EDEVLET_VERIFY_ENABLED=1 verilmedi — ağa hiç dokunulmadı.");
  }
}

main().catch((e) => {
  console.error("✕ Beklenmedik hata (istemci fırlatmamalıydı!):", e);
  process.exit(1);
});
