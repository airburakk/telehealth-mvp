// BRANŞ ETİKETİ VERİ TAŞIMASI (2026-09-29, 👤 karar: "Estetik Cerrahi" → "Plastik, Rekonstrüktif ve Estetik Cerrahi").
//
// NEDEN: lib/triage BRANCHES etiketi hem arayüz yazısı hem de VERİDİR — Doctor/Case/Recovery/Booking/ConsultAppointment/
// ConsultationRequest/PartnerDoctor tablolarında `branch` kolonu etiket dizesini saklar (SecondOpinionCase KEY saklar,
// kapsam DIŞI). Kod tarafı eski etiketi takma adla çözer (lib/triage BRANCH_LABEL_ALIASES → eski kayıt kırılmaz); bu
// betik veriyi de kanonik etikete taşır ki liste/süzgeç/görsel kimlik tek dizeye baksın.
//
// KULLANIM (dry-run varsayılan — hiçbir şey yazmaz):
//   npx tsx scripts/rename-branch-label.ts            → dev (DATABASE_URL) sayım
//   npx tsx scripts/rename-branch-label.ts --yaz      → dev'de uygula
//   npx tsx scripts/rename-branch-label.ts --prod     → ÜRETİM sayım (PROD_DATABASE_URL açıkça şart; DATABASE_URL fallback'i YOK)
//   npx tsx scripts/rename-branch-label.ts --prod --yaz → üretimde uygula (👤 onayıyla)
// İdempotent: eski etiket kalmadıysa 0 satır. PHI basmaz — yalnız tablo başına sayı.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { BRANCH_LABEL_ALIASES, BRANCHES } from "../src/lib/triage";

const PROD = process.argv.includes("--prod");
const YAZ = process.argv.includes("--yaz");

const url = PROD ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!url) {
  console.error(PROD ? "✋ PROD_DATABASE_URL tanımsız — üretim taşıması açık niyet ister." : "✋ DATABASE_URL tanımsız.");
  process.exit(1);
}
if (!PROD) {
  const fp = process.env.PROD_DB_FINGERPRINT;
  if (fp && url.includes(fp)) { console.error("⛔ DATABASE_URL üretim parmak izini içeriyor — üretim için --prod kullan."); process.exit(1); }
}
const db = new PrismaClient({ datasourceUrl: url });

/** Etiket dizesi saklayan tablolar (şema: `branch String`). SecondOpinionCase.branch KEY saklar → yok. */
const TABLES = ["Booking", "Case", "ConsultAppointment", "ConsultationRequest", "Doctor", "PartnerDoctor", "Recovery"] as const;

async function main() {
  const pairs = Object.entries(BRANCH_LABEL_ALIASES).map(([oldLabel, key]) => {
    const cur = BRANCHES.find((b) => b.key === key);
    if (!cur) throw new Error(`Takma ad ${oldLabel} → ${key}: anahtar BRANCHES'ta yok.`);
    return { oldLabel, newLabel: cur.label };
  });
  console.log(`🔁 Branş etiketi taşıması — hedef: ${PROD ? "ÜRETİM" : "dev"} · mod: ${YAZ ? "YAZ" : "DRY-RUN"}`);
  for (const { oldLabel, newLabel } of pairs) console.log(`   "${oldLabel}" → "${newLabel}"`);
  let total = 0;
  for (const t of TABLES) {
    for (const { oldLabel, newLabel } of pairs) {
      const [{ n }] = await db.$queryRawUnsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM "${t}" WHERE "branch" = $1`, oldLabel);
      if (n === 0) continue;
      total += n;
      if (YAZ) {
        const changed = await db.$executeRawUnsafe(`UPDATE "${t}" SET "branch" = $1 WHERE "branch" = $2`, newLabel, oldLabel);
        console.log(`  ${t.padEnd(22)} ${String(n).padStart(5)} satır → güncellendi ${changed}`);
      } else {
        console.log(`  ${t.padEnd(22)} ${String(n).padStart(5)} satır (eski etiket)`);
      }
    }
  }
  console.log(total === 0 ? "\n✓ Eski etiketli satır yok — taşınacak bir şey kalmadı." : YAZ ? `\n✅ ${total} satır taşındı.` : `\nDRY-RUN: ${total} satır taşınacak — uygulamak için --yaz.`);
}

main().catch((e) => { console.error("❌", e instanceof Error ? e.message : e); process.exitCode = 1; }).finally(() => db.$disconnect());
