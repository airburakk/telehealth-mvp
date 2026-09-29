// Case.policyNo TEMİZLİĞİ (2026-09-29, 👤 karar — şifreleme kapsam sondası bulgusu).
//
// NEDEN: sigortalı ödeme yolu 2026-08-05'te kaldırıldı (api/cases/route.ts notu: INSURED kabul edilmez); kolonu yazan kod
// kalmadı ama üretimde 19 eski satırda hastanın poliçe numarası DÜZ METİN duruyordu (kişisel/finansal tanımlayıcı; Doctor.mmssPolicyNo
// ise şifreli). Amaç dışı saklanan veri → null'lanır (KVKK m.4 amaçla sınırlılık; kolon şemada kalır, migration yok).
//
// KULLANIM (dry-run varsayılan — hiçbir şey yazmaz):
//   npx tsx scripts/cleanup-case-policyno.ts            → dev sayım
//   npx tsx scripts/cleanup-case-policyno.ts --yaz      → dev'de null'la
//   npx tsx scripts/cleanup-case-policyno.ts --prod     → ÜRETİM sayım (PROD_DATABASE_URL açıkça; fallback YOK)
//   npx tsx scripts/cleanup-case-policyno.ts --prod --yaz
// Değer BASILMAZ — yalnız sayı. İdempotent.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const PROD = process.argv.includes("--prod");
const YAZ = process.argv.includes("--yaz");
const url = PROD ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!url) {
  console.error(PROD ? "✋ PROD_DATABASE_URL tanımsız — üretim işlemi açık niyet ister." : "✋ DATABASE_URL tanımsız.");
  process.exit(1);
}
if (!PROD) {
  const fp = process.env.PROD_DB_FINGERPRINT;
  if (fp && url.includes(fp)) { console.error("⛔ DATABASE_URL üretim parmak izini içeriyor — üretim için --prod kullan."); process.exit(1); }
}
const db = new PrismaClient({ datasourceUrl: url });

async function main() {
  console.log(`🧹 Case.policyNo temizliği — hedef: ${PROD ? "ÜRETİM" : "dev"} · mod: ${YAZ ? "YAZ" : "DRY-RUN"}`);
  const [{ n }] = await db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM "Case" WHERE "policyNo" IS NOT NULL AND "policyNo" <> ''`;
  if (n === 0) { console.log("✓ Dolu policyNo satırı yok."); return; }
  if (!YAZ) { console.log(`DRY-RUN: ${n} satırda policyNo dolu — null'lamak için --yaz.`); return; }
  const changed = await db.$executeRaw`UPDATE "Case" SET "policyNo" = NULL WHERE "policyNo" IS NOT NULL AND "policyNo" <> ''`;
  console.log(`✅ ${changed} satırda policyNo null'landı.`);
}

main().catch((e) => { console.error("❌", e instanceof Error ? e.message : e); process.exitCode = 1; }).finally(() => db.$disconnect());
