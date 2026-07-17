// Şifreleme tanı probu (gate 4 KEK rotasyonu runbook'unun doğrulama adımı, 2026-07-17).
// Bağlı DB'de şifreli alan sayımı + MEVCUT env KEK'iyle örnek çözüm (içerik basılmaz; yalnız uzunluk).
// Kullanım: npx tsx scripts/probe-encryption.ts [decrypt]
// Rotasyon provasında üçlü kanıt: rotate --apply → eski KEK'le prob FAIL → yeni KEK'le prob OK.
// ⚠️ Hangi DB'ye bağlandığın .env'e bağlıdır (Ray B2: yerel .env = DEV branch; prod = PROD_* açıkça).
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { decryptField } from "../src/lib/crypto";

const db = new PrismaClient();

async function main() {
  const total = await db.case.count();
  const enc = await db.case.count({ where: { symptoms: { startsWith: "enc:v1:" } } });
  const encDocs = await db.caseDocument.count({ where: { content: { startsWith: "enc:v1:" } } });
  console.log(`Case toplam: ${total} | symptoms şifreli: ${enc} | CaseDocument şifreli: ${encDocs}`);

  if (process.argv.includes("decrypt")) {
    const row = await db.case.findFirst({ where: { symptoms: { startsWith: "enc:v1:" } }, select: { id: true, symptoms: true } });
    if (!row) { console.log("çözülecek şifreli satır yok"); return; }
    const plain = decryptField(row.symptoms);
    console.log(`✅ decrypt OK — Case#${row.id.slice(0, 8)}… symptoms ${plain!.length} karakter (içerik basılmadı)`);
  }
}

main()
  .catch((e) => { console.error("❌ prob hatası:", e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => db.$disconnect());
