// PROD KEK KURTARMA — "elimdeki aday değerlerden hangisi BU veritabanının anahtarı?" (2026-08-05)
//
// NEDEN VAR: encrypt-existing.ts'in KEK↔DB kanıt kapısı fail-closed'dur ve DOĞRU davranır, ama tek bir
// mesajla İKİ farklı arızayı anlatır: (a) gerçekten yanlış ortamın anahtarı, (b) DOĞRU anahtarın yanlış
// KODLAMASI. Sebep: getKek() (crypto.ts) 32 bayta çözülmeyen değerde throw eder ve bu throw, kanıt
// bloğundaki try/catch'e düşüp "yanlış ortamın anahtarı" mesajını bastırır. 64 karakterlik bir HEX dize
// tam olarak 32 bayttır (= geçerli AES-256 anahtarı) ama base64 sanılıp parse edilirse 48 bayt çıkar →
// kapı kapanır. Bu betik adayları base64 · hex · base64url olarak DENEYEREK ayrımı yapar.
//
// GÜVENLİK SÖZLEŞMESİ (bu betiğin varlık şartı):
//   · SIRRI ASLA BASMAZ — ne tamamını, ne parçasını. Çıktı yalnız "kaynak satır no + varyant adı".
//   · PHI'yi ÇÖZMEZ — kanıt için decryptField DEĞİL, rewrapEnvelope(sample, kek, kek) kullanılır:
//     yalnız DEK sarımı açılıp yeniden sarılır (iv/tag/ct'ye dokunulmaz), dönüş değeri atılır.
//     Yanlış anahtar → GCM auth hatası; doğru anahtar → sessiz başarı. İçerik hiç düz metne dönmez.
//   · HİÇBİR ŞEY YAZMAZ (--run --apply hariç; o da encrypt-existing'in kendi iki kapısına tabidir).
//   · Adaylar KOMUT SATIRINDAN DEĞİL DOSYADAN okunur — 2026-08-05 dersi: hata çıktısını komut
//     satırıyla birlikte yapıştırmak sırrı sohbete düşürür ([[user-terminal-powershell-rules]]).
//
// KULLANIM (üç adım — her biri bir öncekinin kanıtı üstüne biner):
//   npx.cmd tsx scripts/find-kek.ts --file "<aday dosyası>"                → hangi aday doğru (salt-okur)
//   npx.cmd tsx scripts/find-kek.ts --file "<aday dosyası>" --run          → doğru anahtarla DRY-RUN raporu
//   npx.cmd tsx scripts/find-kek.ts --file "<aday dosyası>" --run --apply  → gerçek şifreleme (geri dönüşü YOK)
//
// PROD_DATABASE_URL açıkça tanımlı olmalı (probe-plaintext-count.ts deseni — DATABASE_URL fallback'i
// bilinçli YOK: yanlışlıkla dev'i ölçüp "prod tamam" sanma riski).
import "dotenv/config";
import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";
import { kekFromBase64, rewrapEnvelope } from "../src/lib/crypto";

const argv = process.argv.slice(2);
const arg = (ad: string): string | null => {
  const i = argv.indexOf(ad);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : null;
};
const DOSYA = arg("--file");
const RUN = argv.includes("--run");

const url = process.env.PROD_DATABASE_URL;
if (!url) {
  console.error("✋ PROD_DATABASE_URL tanımsız — prod anahtar kurtarma açık niyet ister.");
  console.error("   .env'e PROD_DATABASE_URL=... ekle (DEPLOY.md 'Ortam ayrımı').");
  process.exit(1);
}
const db = new PrismaClient({ datasourceUrl: url });

/** Bir aday: nereden geldiği (etiket) + hangi dönüşümle base64'e getirildiği. Değer LOGLANMAZ. */
type Aday = { etiket: string; varyant: string; b64: string };

/**
 * Satırdaki sır-benzeri token'ları çıkar. Dosya biçimi bilinmiyor (markdown tablo, `KEY=value`,
 * backtick, tırnak…) → biçim ayrıştırmak yerine "yeterince uzun base64/hex alfabesi dizisi" avlanır.
 */
function tokenlar(satir: string): string[] {
  return satir.match(/[A-Za-z0-9+/=_-]{20,}/g) ?? [];
}

/** Bir token'ın olası base64 karşılıkları (kodlama tahmini). Hepsi 32 bayt şartıyla süzülür. */
function varyantlar(token: string): { varyant: string; b64: string }[] {
  const out: { varyant: string; b64: string }[] = [];
  out.push({ varyant: "base64 (olduğu gibi)", b64: token });
  if (/^[0-9a-fA-F]{64}$/.test(token)) {
    // 64 hex karakter = 32 bayt: geçerli AES-256 anahtarı, yalnız kodlaması farklı.
    out.push({ varyant: "hex → base64", b64: Buffer.from(token, "hex").toString("base64") });
  }
  if (/[-_]/.test(token)) {
    out.push({ varyant: "base64url → base64", b64: token.replace(/-/g, "+").replace(/_/g, "/") });
  }
  return out;
}

/** 32 bayta çözülen ve tekrarsız adayları topla (DB'ye gitmeden ucuz eleme). */
function adaylariTopla(): Aday[] {
  const ham: { etiket: string; token: string }[] = [];

  // Kaynak 1 — .env'deki PROD_DATA_ENCRYPTION_KEK (konvansiyon .env.example:27). Varsa bedava kazanç.
  const envKek = process.env.PROD_DATA_ENCRYPTION_KEK;
  if (envKek) ham.push({ etiket: ".env PROD_DATA_ENCRYPTION_KEK", token: envKek.trim() });

  // Kaynak 2 — kullanıcının verdiği aday dosyası (escrow kaydı vb.). İçeriği yalnız burada, RAM'de.
  if (DOSYA) {
    let icerik: string;
    try {
      icerik = readFileSync(DOSYA, "utf8");
    } catch {
      console.error(`✋ Dosya okunamadı: ${DOSYA}`);
      process.exit(1);
    }
    icerik.split(/\r?\n/).forEach((satir, i) => {
      for (const t of tokenlar(satir)) ham.push({ etiket: `dosya satır ${i + 1}`, token: t });
    });
  }

  const gorulen = new Set<string>();
  const adaylar: Aday[] = [];
  for (const { etiket, token } of ham) {
    for (const { varyant, b64 } of varyantlar(token)) {
      try {
        kekFromBase64(b64); // 32 bayt değilse throw → aday değil
      } catch {
        continue;
      }
      if (gorulen.has(b64)) continue; // aynı anahtar iki kodlamadan geldiyse bir kez dene
      gorulen.add(b64);
      adaylar.push({ etiket, varyant, b64 });
    }
  }
  return adaylar;
}

/** Bu DB'den şifreli bir örnek satır bul (encrypt-existing'in kanıt listesiyle aynı kaynaklar). */
async function ornekEnvelope(): Promise<{ kaynak: string; deger: string } | null> {
  const probes: { label: string; find: () => Promise<string | null> }[] = [
    { label: "Case.symptoms", find: () => db.case.findFirst({ where: { symptoms: { startsWith: "enc:v1:" } }, select: { symptoms: true } }).then((r) => r?.symptoms ?? null) },
    { label: "Case.patientName", find: () => db.case.findFirst({ where: { patientName: { startsWith: "enc:v1:" } }, select: { patientName: true } }).then((r) => r?.patientName ?? null) },
    { label: "CaseDocument.content", find: () => db.caseDocument.findFirst({ where: { content: { startsWith: "enc:v1:" } }, select: { content: true } }).then((r) => r?.content ?? null) },
    { label: "SoCase.diagnosisSummary", find: () => db.secondOpinionCase.findFirst({ where: { diagnosisSummary: { startsWith: "enc:v1:" } }, select: { diagnosisSummary: true } }).then((r) => r?.diagnosisSummary ?? null) },
  ];
  for (const p of probes) {
    const deger = await p.find();
    if (deger) return { kaynak: p.label, deger };
  }
  return null;
}

async function main() {
  console.log("🔑 KEK kurtarma — adaylar bu veritabanının şifreli örneğine karşı sınanır.");
  console.log("   (sır BASILMAZ · içerik ÇÖZÜLMEZ · bu aşamada hiçbir şey YAZILMAZ)\n");

  const adaylar = adaylariTopla();
  if (adaylar.length === 0) {
    console.error("✋ Hiç geçerli aday yok — dosyadaki hiçbir değer 32 bayta çözülmedi.");
    console.error("   Anlamı: elindeki kayıtta bu DB'nin KEK'i YOK (ya da bambaşka biçimde).");
    console.error("   Sıradaki yol: Vercel prod ortamından DATA_ENCRYPTION_KEK'i güvenle indir.");
    process.exit(1);
  }
  console.log(`📋 ${adaylar.length} geçerli aday (32 bayta çözülenler):`);
  for (const a of adaylar) console.log(`   · ${a.etiket.padEnd(28)} [${a.varyant}]`);

  const ornek = await ornekEnvelope();
  if (!ornek) {
    console.error("\n✋ Bu veritabanında hiç şifreli satır yok — kanıt üretilemez.");
    process.exit(1);
  }
  console.log(`\n🔬 Kanıt satırı: ${ornek.kaynak} (yalnız DEK sarımı sınanır, içerik açılmaz)\n`);

  for (const a of adaylar) {
    try {
      rewrapEnvelope(ornek.deger, kekFromBase64(a.b64), kekFromBase64(a.b64)); // yanlışsa GCM auth hatası
    } catch {
      console.log(`   ✗ ${a.etiket} [${a.varyant}]`);
      continue;
    }
    console.log(`\n✅ DOĞRU ANAHTAR BULUNDU → ${a.etiket} · varyant: ${a.varyant}`);
    if (a.varyant !== "base64 (olduğu gibi)") {
      console.log("   ⚠️ Kayıttaki biçim base64 DEĞİL — escrow kaydını 44 karakterlik base64 hâline");
      console.log("      güncelle, yoksa bir sonraki kurtarma da aynı duvara toslar.");
    }
    if (!RUN) {
      console.log("\n   Sıradaki: aynı komuta --run ekle → encrypt-existing DRY-RUN raporu (yazmaz).");
      return;
    }
    // Bulunan anahtarla backfill'i AYNI SÜREÇTE koş: sır terminale/dosyaya hiç kopyalanmaz.
    // dotenv mevcut env'i EZMEZ (override:false) → aşağıdaki atamalar encrypt-existing'de geçerli kalır.
    process.env.DATA_ENCRYPTION_KEK = a.b64;
    process.env.DATABASE_URL = url; // encrypt-existing düz `new PrismaClient()` kurar → DATABASE_URL'e bakar
    console.log("\n── encrypt-existing devralıyor ─────────────────────────────────────────────\n");
    await db.$disconnect();
    await import("./encrypt-existing"); // --apply / --allow-unproven-kek argv'den doğrudan okunur
    return;
  }

  console.error("\n🛑 Hiçbir aday bu veritabanının anahtarı değil.");
  console.error("   Anlamı: kayıt gerçekten eksik/bayat → Vercel prod ortamından indirme gerekir.");
  process.exit(1);
}

main()
  .catch((e) => {
    console.error("❌ Hata:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => void db.$disconnect().catch(() => {}));
