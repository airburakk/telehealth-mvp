// ÜRETİM hukuki çeviri ÖN-ISITMA (7-C, v6.286 · 2026-09-20) — apply-prod-migration.mjs deseni: .env'deki
// PROD_DATABASE_URL / PROD_DIRECT_URL ile scripts/translate-legal.ts'i koşar (dotenv; .env regex'le OKUNMAZ —
// PROD_DATABASE_URL satırı DATABASE_URL'e de uyar). Elle `DATABASE_URL=<prod> npx tsx …` YAZMA: Prisma'nın kendi
// .env yükleyicisi DEV değerini basabilir; burada süreç ortamı açıkça kurulur (dotenv var olan değeri EZMEZ).
// Çalıştırmak = bilinçli üretim yazımı (Translation önbelleği; idempotent, PHI yok) — yalnız kullanıcı isteğiyle.
// ⚠️ .env'de AURA_DB_GUARD=block ise db.ts korkuluğu bu süreci de durdurur (doğru davranış — betik korkuluğu GEVŞETMEZ).
// Bilinçli üretim ısıtması için yalnız o kabuk oturumunda: PowerShell `$env:AURA_DB_GUARD='warn'; node scripts/translate-legal-prod.mjs`.
// Kullanım: node scripts/translate-legal-prod.mjs [--lang=Rusça]
import "dotenv/config";
import { spawnSync } from "node:child_process";

const url = process.env.PROD_DATABASE_URL;
const direct = process.env.PROD_DIRECT_URL;
if (!url || !direct) {
  console.error("⛔ .env'de PROD_DATABASE_URL / PROD_DIRECT_URL yok — üretim hedefi kurulamadı.");
  process.exit(1);
}

const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: direct };
console.log("— ÜRETİM hukuki çeviri ön-ısıtma (hedef: PROD_DATABASE_URL) —");
const r = spawnSync("npx", ["tsx", "scripts/translate-legal.ts", ...process.argv.slice(2)], { shell: true, stdio: "inherit", env });
process.exit(r.status ?? 1);
