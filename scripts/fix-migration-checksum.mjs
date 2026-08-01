// Migration checksum onarıcı (2026-08-01) — kalıcı runbook aracı.
//
// NE YAPAR: `_prisma_migrations` tablosundaki BİR satırın `checksum` sütununu, diskteki
// migration.sql dosyasının SHA-256'sıyla hizalar. ŞEMAYA DOKUNMAZ, VERİYE DOKUNMAZ.
//
// NE ZAMAN KULLANILIR: uygulanmış bir migration dosyası sonradan düzenlenmişse Prisma checksum
// uyuşmazlığı görür → `migrate dev` veritabanını SIFIRLAMAK ister, `migrate deploy` HATA verip
// sonraki tüm prod migration'larını BLOKE eder.
//
// ⚠️ ÖN KOŞUL (elle doğrula): hedef veritabanının şeması, dosyanın NİHAİ içeriğiyle zaten uyumlu
// olmalı. Uyumlu değilse checksum'ı hizalamak eksikliği GİZLER — o durumda eksik ifadeyi YENİ bir
// migration ile uygula, bu aracı kullanma.
//
// Kullanım:
//   node scripts/fix-migration-checksum.mjs <migration_adi>                 → dev (.env DATABASE_URL)
//   node scripts/fix-migration-checksum.mjs <migration_adi> --prod --yes    → ÜRETİM (çift onay)
import "dotenv/config";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith("--"));
const useProd = args.includes("--prod");
const confirmed = args.includes("--yes");

if (!name) {
  console.error("Kullanım: node scripts/fix-migration-checksum.mjs <migration_adi> [--prod --yes]");
  process.exit(1);
}
// Üretimde kazara koşmayı engelle: --prod TEK BAŞINA yetmez, --yes de gerekir.
if (useProd && !confirmed) {
  console.error("⛔ Üretim hedefi için --yes de gerekli (bilinçli işlem onayı).");
  process.exit(1);
}

const url = useProd ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!url) {
  console.error(`⛔ ${useProd ? "PROD_DATABASE_URL" : "DATABASE_URL"} tanımlı değil.`);
  process.exit(1);
}

const file = join("prisma/migrations", name, "migration.sql");
if (!existsSync(file)) {
  console.error(`⛔ Dosya yok: ${file}`);
  process.exit(1);
}
const want = createHash("sha256").update(readFileSync(file)).digest("hex");

const db = new PrismaClient({ datasources: { db: { url } } });
try {
  console.log(`Hedef: ${useProd ? "ÜRETİM" : "dev"} · ${url.replace(/\/\/[^@]*@/, "//***@").split("?")[0]}`);
  const before = await db.$queryRaw`
    SELECT checksum, finished_at FROM "_prisma_migrations" WHERE migration_name = ${name}`;
  if (!before.length) {
    console.error(`⛔ Bu veritabanında böyle bir migration kaydı yok: ${name}`);
    process.exit(1);
  }
  console.log(`  kayıtlı: ${before[0].checksum}`);
  console.log(`  dosya  : ${want}`);
  if (before[0].checksum === want) {
    console.log("✓ Zaten hizalı — değişiklik yapılmadı.");
    process.exit(0);
  }

  const n = await db.$executeRaw`
    UPDATE "_prisma_migrations" SET checksum = ${want} WHERE migration_name = ${name}`;
  const after = await db.$queryRaw`
    SELECT checksum FROM "_prisma_migrations" WHERE migration_name = ${name}`;
  const ok = after[0]?.checksum === want;
  console.log(`  güncellenen satır: ${n} · doğrulama: ${ok ? "✓ hizalandı" : "✗ HİZALANMADI"}`);
  process.exit(ok ? 0 : 1);
} finally {
  await db.$disconnect();
}
