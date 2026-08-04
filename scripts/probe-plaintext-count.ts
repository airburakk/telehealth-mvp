// Şifreleme kapsamı sağlık kontrolü — SALT-OKUR sayım (E2EE Faz 1 backfill karar desteği).
//
// SORU 1: encrypt-existing.ts kapsamındaki kolonlarda kaç DÜZ METİN satır var?
// SORU 2: bu satırlar demo (@air.test) hesaplara mı ait, gerçek kullanıcıya mı?
// Arşiv kararı (2026-08-03, dis-denetim-degerlendirmesi §9): backfill "şimdi koşulmayacak";
// kararı çürütecek tek şey üretimde GERÇEK hasta kaydı bulunması. Bu betik tam onu ölçer —
// encrypt-existing.ts dry-run'ı KEK↔DB kanıtı istediğinden (prod KEK yalnız Vercel'de) prod
// sayımı için KEK'siz bu yol gerekir.
//
// GÜVENLİK: HİÇBİR ŞEY YAZMAZ · PHI/e-posta İÇERİĞİ BASMAZ (yalnız sayılar) · PROD_DATABASE_URL
// açıkça tanımlıysa çalışır (yanlışlıkla dev sayıp "prod temiz" sanma riskine karşı DATABASE_URL
// fallback'i BİLİNÇLİ yok).
//
// Kullanım: npx tsx scripts/probe-plaintext-count.ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const url = process.env.PROD_DATABASE_URL;
if (!url) {
  console.error("✋ PROD_DATABASE_URL tanımsız — prod keşfi açık niyet ister (DATABASE_URL fallback'i bilinçli yok).");
  process.exit(1);
}
const db = new PrismaClient({ datasourceUrl: url });

// Düz metin = boş değil + "enc:v1:" ile başlamıyor. NOT-startsWith NULL satırları da eler
// (Prisma NOT semantiği) — burada İSTENEN davranış: NULL satır backfill'e zaten girmez.
const duzMetin = (alan: string) => ({ NOT: { [alan]: { startsWith: "enc:v1:" } }, [alan]: { not: "" } });

async function main() {
  const sayimlar: [string, number][] = [
    ["Case.symptoms", await db.case.count({ where: duzMetin("symptoms") })],
    ["Case.patientName", await db.case.count({ where: duzMetin("patientName") })],
    ["Case.patientIdentifier", await db.case.count({ where: duzMetin("patientIdentifier") })],
    ["Case.reasoning", await db.case.count({ where: duzMetin("reasoning") })],
    ["Case.dischargeReport", await db.case.count({ where: duzMetin("dischargeReport") })],
    ["CaseDocument.content", await db.caseDocument.count({ where: duzMetin("content") })],
    ["Signal.data", await db.signal.count({ where: duzMetin("data") })],
    ["Consultation.notes", await db.consultation.count({ where: duzMetin("notes") })],
    ["CheckIn.note", await db.checkIn.count({ where: duzMetin("note") })],
    ["CheckIn.photo", await db.checkIn.count({ where: duzMetin("photo") })],
    ["SoCase.diagnosisSummary", await db.secondOpinionCase.count({ where: duzMetin("diagnosisSummary") })],
    ["SoCase.patientPhone", await db.secondOpinionCase.count({ where: duzMetin("patientPhone") })],
    ["SecondOpinion.content", await db.secondOpinion.count({ where: duzMetin("content") })],
  ];

  console.log("── Düz metin satır sayıları (prod, salt-okur) ──");
  for (const [ad, n] of sayimlar) console.log(`  ${ad.padEnd(26)} ${String(n).padStart(5)}`);

  // Demo analizi — şemada Case→User/SoCase→User İLİŞKİ ALANI YOK (bilinçli mimari borç,
  // skalar userId/patientId) → join yerine iki aşama: demo id'leri çek, `in` ile say.
  // select yalnız id — e-posta içeriği belleğe/çıktıya alınmaz.
  const demoIds = (await db.user.findMany({ where: { email: { endsWith: "@air.test" } }, select: { id: true } })).map((u) => u.id);
  const toplamUser = await db.user.count();
  const toplamCase = await db.case.count();
  const demoCase = demoIds.length ? await db.case.count({ where: { userId: { in: demoIds } } }) : 0;
  const toplamSoCase = await db.secondOpinionCase.count();
  const demoSoCase = demoIds.length ? await db.secondOpinionCase.count({ where: { patientId: { in: demoIds } } }) : 0;
  const duzSoDemo = demoIds.length
    ? await db.secondOpinionCase.count({ where: { ...duzMetin("diagnosisSummary"), patientId: { in: demoIds } } })
    : 0;

  console.log("\n── Demo (@air.test) analizi ──");
  console.log(`  User: ${toplamUser} toplam · ${demoIds.length} demo`);
  console.log(`  Case: ${toplamCase} toplam · ${demoCase} demo-sahipli`);
  console.log(`  SoCase: ${toplamSoCase} toplam · ${demoSoCase} demo-sahipli · düz-metin diagnosisSummary'nin demo kesişimi: ${duzSoDemo}`);
}

main()
  .catch((e) => { console.error("HATA:", e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => db.$disconnect());
