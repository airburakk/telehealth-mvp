// Migration bütünlük denetçisi (2026-08-01) — SALT OKUR, hiçbir şey değiştirmez.
//
// NEDEN VAR: uygulanmış bir migration dosyası SONRADAN düzenlenirse Prisma checksum uyuşmazlığı
// görür; `migrate dev` DEV VERİTABANINI SIFIRLAMAK ister, `migrate deploy` ise ÜRETİMDE HATA verir
// (yani bir sonraki prod migration'ı bloke olur). 2026-08-01'de tam bu oldu: v6.35'in migration'ı
// dev'e uygulandıktan sonra dosyaya bir "drift temizliği" satırı eklenmişti.
//
// KURAL: uygulanmış migration dosyası DEĞİŞMEZDİR. Değişiklik gerekiyorsa YENİ migration yaz.
//
// Kullanım:
//   node scripts/check-migrations.mjs            → .env DATABASE_URL (dev)
//   node scripts/check-migrations.mjs --prod     → PROD_DATABASE_URL (salt-okur; bilinçli işlem)
import "dotenv/config";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const useProd = process.argv.includes("--prod");
const url = useProd ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!url) {
  console.error(`⛔ ${useProd ? "PROD_DATABASE_URL" : "DATABASE_URL"} tanımlı değil.`);
  process.exit(1);
}
console.log(`Hedef: ${useProd ? "ÜRETİM" : "dev"} · ${url.replace(/\/\/[^@]*@/, "//***@").split("?")[0]}`);

const db = new PrismaClient({ datasources: { db: { url } } });
const MIG_DIR = "prisma/migrations";

try {
  const rows = await db.$queryRaw`
    SELECT migration_name, checksum, finished_at, rolled_back_at
    FROM "_prisma_migrations" ORDER BY started_at`;

  let bad = 0;
  let failed = 0;
  for (const r of rows) {
    const file = join(MIG_DIR, r.migration_name, "migration.sql");
    if (!existsSync(file)) {
      console.log(`  ⚠ DB'de var, dosyası YOK: ${r.migration_name}`);
      bad++;
      continue;
    }
    if (!r.finished_at && !r.rolled_back_at) {
      console.log(`  ⛔ FAILED kayıt (deploy kilidi): ${r.migration_name}`);
      failed++;
    }
    const want = createHash("sha256").update(readFileSync(file)).digest("hex");
    if (want !== r.checksum) {
      bad++;
      console.log(`  ✗ CHECKSUM UYUŞMUYOR: ${r.migration_name}`);
      console.log(`      kayıtlı: ${r.checksum}`);
      console.log(`      dosya  : ${want}`);
      console.log("      → dosya uygulandıktan SONRA düzenlenmiş. Şema doğruysa kayıtlı checksum");
      console.log("        dosyanınkiyle hizalanır; değilse eksik ifade ayrı migration'la uygulanır.");
    }
  }

  const dirs = readdirSync(MIG_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  const pending = dirs.filter((d) => !rows.some((r) => r.migration_name === d));

  console.log(
    `\nKayıtlı: ${rows.length} · dosya: ${dirs.length} · uyuşmazlık: ${bad} · failed: ${failed} · bekleyen: ${
      pending.length ? pending.join(", ") : "yok"
    }`,
  );
  process.exit(bad || failed ? 1 : 0);
} finally {
  await db.$disconnect();
}
