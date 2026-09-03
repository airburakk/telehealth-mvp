// CHAMBER (eski üyelik-yazısı belge tipi — v6.124'te kapıdan düşmüş, v6.212'de koddan/şemadan kaldırılan)
// satırlarının DOSYALARINI ve satırlarını imha eder. Migration `20260903140000_drop_chamber_letter`'dan
// ÖNCE koşulur: migration'daki DELETE yalnız satırı siler, Blob nesnesine ulaşamaz — bu script Blob'u siler
// (lib/storage deleteDocument), satırı kaldırır ve audit zincirine DOCTOR_DOC_PURGE (neden=TIP_KALDIRILDI)
// yazar. Blob silinemezse satıra DOKUNULMAZ ve raporlanır (yetim nesne kalmasın — doc-purge.ts ilkesi).
//
// Korkuluklar (create-admin.ts deseni): prod YALNIZ --prod + PROD_DATABASE_URL; --prod'suz DATABASE_URL prod
// parmak izine uyuyorsa durur. Varsayılan SAYIM; imha için --yaz.
// Kullanım:  npx tsx scripts/purge-chamber-docs.ts               → DEV, yalnız sayım
//            npx tsx scripts/purge-chamber-docs.ts --yaz         → DEV, imha
//            npx tsx scripts/purge-chamber-docs.ts --prod --yaz  → ÜRETİM (ayrı kullanıcı onayıyla)
import "dotenv/config";

const args = process.argv.slice(2);
const PROD = args.includes("--prod");
const WRITE = args.includes("--yaz");

async function main() {
  if (PROD) {
    const prodUrl = process.env.PROD_DATABASE_URL;
    if (!prodUrl) {
      console.error("⛔ --prod istendi ama PROD_DATABASE_URL tanımlı değil.");
      process.exit(1);
    }
    process.env.DATABASE_URL = prodUrl;
    if (process.env.AURA_DB_GUARD === "block") process.env.AURA_DB_GUARD = "warn";
    console.log("🎯 HEDEF: ÜRETİM");
  } else {
    const fp = process.env.PROD_DB_FINGERPRINT;
    if (fp && (process.env.DATABASE_URL ?? "").includes(fp)) {
      console.error("⛔ DATABASE_URL üretime işaret ediyor; --prod olmadan durduruldu.");
      process.exit(1);
    }
    console.log("🎯 HEDEF: DEV");
  }
  // db import'u DATABASE_URL ayarından SONRA (guard modül yüklenirken env'i okur).
  const { db } = await import("../src/lib/db");
  const { deleteDocument, isPurgedRef } = await import("../src/lib/storage");
  const { recordAccess } = await import("../src/lib/audit");

  const rows = await db.doctorDocument.findMany({
    where: { type: "CHAMBER" },
    select: { id: true, doctorId: true, content: true, status: true, createdAt: true },
  });
  console.log(`CHAMBER satır: ${rows.length}${WRITE ? " — imha ediliyor" : " — yalnız sayım (--yaz yok)"}`);
  let purged = 0;
  let failed = 0;
  for (const r of rows) {
    if (!WRITE) {
      console.log(`  ${r.id} ${r.status} ${r.createdAt.toISOString().slice(0, 10)} dosya=${isPurgedRef(r.content) ? "imhalı" : "var"}`);
      continue;
    }
    const ok = await deleteDocument(r.content);
    if (!ok) {
      failed += 1;
      console.warn(`  ⚠️ Blob silinemedi, satır bırakıldı: ${r.id}`);
      continue;
    }
    await db.doctorDocument.delete({ where: { id: r.id } });
    const u = await db.user.findFirst({ where: { doctorId: r.doctorId }, select: { id: true } });
    await recordAccess({
      actor: null,
      action: "DOCTOR_DOC_PURGE",
      resourceType: "DOCTOR",
      resourceId: r.doctorId,
      subjectUserId: u?.id ?? null,
      detail: `belge=CHAMBER docId=${r.id} neden=TIP_KALDIRILDI`,
    });
    purged += 1;
  }
  if (WRITE) console.log(`imha: ${purged} · Blob hatası (satır durdu): ${failed}`);
  await db.$disconnect();
  if (failed > 0) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
