// KEK ROTASYONU (CLI) — at-rest envelope sarımlarını eski KEK'ten yeni KEK'e taşır (gate 4, 2026-07-17;
// 2026-09-18'den beri ŞEMA-GÜDÜMLÜ ortak motor: src/lib/kek-rotation.ts — break-glass ucu /api/admin/kek-rotate
// ile aynı çekirdek). İçerik HİÇ ÇÖZÜLMEZ: yalnız DEK sarımı değişir (iv/tag/ct aynen kalır).
//
// Kapsam: ENVANTER YOK — information_schema'daki TÜM base tabloların TÜM metin kolonlarında `enc:v1:` /
// `blob:v1:` değerler taranır (2026-09-18 bulgusu: eski 13 kolonluk elle envanter, koddaki ~40 şifreli
// kolonun çoğunu kaçırıyordu; yeni şifreli kolon artık otomatik kapsanır).
//
// Satır sınıflandırması (hiçbir değer basılmaz):
//   enc:v1: + eski KEK açıyor  → rewrap  (yalnız --apply ile yazılır)
//   enc:v1: + yeni KEK açıyor  → already (önceki yarım koşudan — idempotent devam)
//   enc:v1: + ikisi de açmıyor → foreign (başka ortamın anahtarı / bozuk) → DOKUNMA + sonda exit 1
//   blob:v1:                   → blob    (yalnız --blobs ile işlenir; sayısı her koşuda raporlanır)
//
// KULLANIM (dry-run varsayılan; hiçbir şey yazmaz):
//   $env:ROTATE_NEW_KEK = "<base64 32B>"; npx tsx scripts/rotate-kek.ts
//   ... --apply          → DB alanlarını yeniden sarar
//   ... --apply --blobs  → blob:v1: belgeleri de döndürür (indir→rewrap→yeni blob→ref güncelle→eskiyi sil)
//   ROTATE_OLD_KEK verilmezse mevcut DATA_ENCRYPTION_KEK eski anahtar sayılır.
//
// ⚠️ ÜRETİM KORUMASI: DATABASE_URL, PROD_DB_FINGERPRINT'i içeriyorsa ALLOW_PROD_KEK_ROTATION=1
//   olmadan ÇALIŞMAZ (scriptler kendi PrismaClient'ını kurar → db.ts guard'ı buradan geçmez;
//   koruma bilinçli olarak script içinde tekrarlanır). Prod rotasyonu runbook'u: vault
//   wiki/yonetisim/sir-envanteri.md §3.1 (özet: uygulamayı yeni KEK'e geçirmeden script bitmeli;
//   pencere boyunca eski KEK'le yazan instance'lar kalabilir → script SONDA ikinci tur ister).
// ⚠️ --blobs + ortak tedarikçi token'ı: Blob store ortamlar arası ORTAK olabilir (Ray B2 açık notu)
//   → dev provasında --blobs KULLANMA (dev seed'inde blob ref yoktur; sayaç 0 doğrular).
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { kekFromBase64 } from "../src/lib/crypto";
import { rotateKek, shortFingerprint } from "../src/lib/kek-rotation";

const APPLY = process.argv.includes("--apply");
const DO_BLOBS = process.argv.includes("--blobs");

const oldRaw = process.env.ROTATE_OLD_KEK || process.env.DATA_ENCRYPTION_KEK;
const newRaw = process.env.ROTATE_NEW_KEK;
if (!oldRaw || !newRaw) {
  console.error("✋ ROTATE_NEW_KEK zorunlu (base64 32B); eski anahtar = ROTATE_OLD_KEK veya DATA_ENCRYPTION_KEK.");
  process.exit(1);
}
const OLD_KEK = kekFromBase64(oldRaw);
const NEW_KEK = kekFromBase64(newRaw);
if (OLD_KEK.equals(NEW_KEK)) {
  console.error("✋ Eski ve yeni KEK aynı — rotasyon anlamsız.");
  process.exit(1);
}

// Üretim korkuluğu (db.ts guard'ının script eşleniği).
const fp = process.env.PROD_DB_FINGERPRINT;
if (fp && (process.env.DATABASE_URL ?? "").includes(fp) && process.env.ALLOW_PROD_KEK_ROTATION !== "1") {
  console.error("⛔ DATABASE_URL üretim parmak izini içeriyor. Prod KEK rotasyonu yalnız runbook'la ve");
  console.error("   ALLOW_PROD_KEK_ROTATION=1 AÇIKÇA verilerek koşulur (vault sir-envanteri §3).");
  process.exit(1);
}

const db = new PrismaClient();

async function main() {
  console.log(
    `🔁 KEK rotasyonu — mod: ${APPLY ? "APPLY (yazar)" : "DRY-RUN (yazmaz)"}${DO_BLOBS ? " + blobs" : ""} · ` +
    `eski ${shortFingerprint(oldRaw!)}… → yeni ${shortFingerprint(newRaw!)}… (sha256 önekleri)\n`,
  );
  const r = await rotateKek({ db, oldKek: OLD_KEK, newKek: NEW_KEK, apply: APPLY, blobs: DO_BLOBS, log: console.log });

  console.log(`\nTarandı: ${r.scanned.tables} tablo · ${r.scanned.columns} metin kolonu · ${(r.durationMs / 1000).toFixed(1)} sn`);
  console.log(`TOPLAM  rewrap:${r.totals.rewrap}  already:${r.totals.already}  blob:${r.totals.blob}` +
    `${APPLY && DO_BLOBS ? ` (döndü:${r.totals.blobRotated})` : ""}  foreign:${r.totals.foreign}`);
  if (r.totals.blob > 0 && !DO_BLOBS) console.log(`ℹ ${r.totals.blob} blob ref'i işlenmedi (--blobs bayrağı yok) — prod rotasyonunda unutma.`);
  if (r.unrotatable.length) {
    console.error(`\n⛔ Tekil id'si olmayan tabloda envelope var — DOKUNULMADI: ${r.unrotatable.join(" · ")}`);
    process.exitCode = 1;
  }
  if (r.totals.foreign > 0) {
    console.error(`\n⛔ ${r.totals.foreign} FOREIGN satır (ne eski ne yeni KEK açıyor) — DOKUNULMADI. Örnekler: ${r.foreignSamples.join(" · ")}`);
    console.error("   Olası neden: başka ortamın anahtarıyla yazılmış satır / bozuk veri. Araştırmadan rotasyonu bitmiş sayma.");
    process.exitCode = 1;
  }
  if (!APPLY && r.totals.rewrap > 0) console.log("\nDRY-RUN bitti — yazmak için --apply.");
  if (APPLY) {
    console.log("\n✅ APPLY bitti. Uygulama env'ini (DATA_ENCRYPTION_KEK) İKİ Vercel projesinde YENİ anahtara geçirmeyi ve pencere");
    console.log("   sırasında eski KEK'le yazılmış olabilecek satırlar için scripti BİR KEZ DAHA (already ağırlıklı) koşmayı unutma.");
  }
}

main()
  .catch((e) => { console.error("❌ Rotasyon hatası:", e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => db.$disconnect());
