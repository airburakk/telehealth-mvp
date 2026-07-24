// ÜRETİM migration uygulayıcı (2026-07-24) — kalıcı runbook aracı (DEPLOY.md Adım 2).
// .env'deki PROD_DATABASE_URL + PROD_DIRECT_URL ile `prisma migrate deploy` koşar.
// Kabuk-bağımsız tek komut (cmd/PowerShell/bash aynı): node scripts/apply-prod-migration.mjs
// Sır ekrana YAZILMAZ (yalnız host adı prisma çıktısında görünür). Çalıştırmak = bilinçli
// üretim işlemi onayı — yalnız kullanıcı isteğiyle koşulur (prod-onay disiplini).
import "dotenv/config";
import { spawnSync } from "node:child_process";

const url = process.env.PROD_DATABASE_URL;
const direct = process.env.PROD_DIRECT_URL;
if (!url || !direct) {
  console.error("⛔ .env'de PROD_DATABASE_URL / PROD_DIRECT_URL yok — üretim hedefi kurulamadı.");
  process.exit(1);
}

const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: direct };

console.log("— Üretim migration durumu —");
const st = spawnSync("npx", ["prisma", "migrate", "status"], { shell: true, stdio: "inherit", env });

console.log("\n— migrate deploy (üretim) —");
const dep = spawnSync("npx", ["prisma", "migrate", "deploy"], { shell: true, stdio: "inherit", env });
process.exit(dep.status ?? 1);
