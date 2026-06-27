// M5 Faz 2 — Demo konsültasyon talepleri (anonim). Mevcut vakalardan türetir (lib/deidentify ile arındırılır).
// İdempotent: aynı sourceCaseId için talep varsa atlar → re-run'da 0 yeni. Hiçbir şey SİLMEZ.
// Onkoloji branş-sınırlı + genel havuz karışık ki demo hekim (Mehmet/Onkoloji) hem branş hem genel görsün.
// Çalıştır: npx tsx scripts/seed-consult-requests.ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { encryptField } from "../src/lib/crypto";
import { deidentifyCase } from "../src/lib/deidentify";

const db = new PrismaClient();

// Partner doktor (yurtdışı) görünen adları — demo.
const PARTNERS = ["Dr. Hans Weber (Almanya)", "Dr. Ivan Petrov (Rusya)", "Dr. Sarah Klein (Avusturya)", "Dr. Ahmed Nasser (BAE)"];

async function main() {
  // Çeşitli branşlardan vaka topla: birkaç Onkoloji + diğer branşlar.
  const onko = await db.case.findMany({ where: { branch: "Onkoloji" }, take: 2, orderBy: { createdAt: "desc" } });
  const others = await db.case.findMany({ where: { NOT: [{ branch: "Onkoloji" }] }, take: 4, orderBy: { createdAt: "desc" } });

  // plan: [sourceCase, branşSınırlı?] — Onkoloji'nin biri branş-sınırlı, biri genel; diğerleri karışık.
  const plan: { c: (typeof onko)[number]; branchLimited: boolean }[] = [
    ...(onko[0] ? [{ c: onko[0], branchLimited: true }] : []), // Onkoloji branş-sınırlı → yalnız Onkoloji hekimi
    ...(onko[1] ? [{ c: onko[1], branchLimited: false }] : []), // genel havuz
    ...(others[0] ? [{ c: others[0], branchLimited: false }] : []), // genel havuz → herkes görür
    ...(others[1] ? [{ c: others[1], branchLimited: true }] : []), // kendi branşına sınırlı
    ...(others[2] ? [{ c: others[2], branchLimited: false }] : []),
  ];

  let created = 0, skipped = 0;
  for (let i = 0; i < plan.length; i++) {
    const { c, branchLimited } = plan[i];
    const exists = await db.consultationRequest.findFirst({ where: { sourceCaseId: c.id }, select: { id: true } });
    if (exists) { skipped++; continue; }
    const deid = deidentifyCase(c);
    await db.consultationRequest.create({
      data: {
        sourceCaseId: c.id,
        requestedByName: PARTNERS[i % PARTNERS.length],
        branch: branchLimited ? c.branch : null,
        region: deid.region,
        language: deid.language,
        urgency: deid.urgency,
        icd10Code: deid.icd10Code,
        clinicalSummary: encryptField(deid.clinicalSummary),
        status: "OPEN",
      },
    });
    created++;
    console.log(`  ✓ ${branchLimited ? "[" + c.branch + "]" : "[genel]"} ${PARTNERS[i % PARTNERS.length]} — ${deid.clinicalSummary.slice(0, 50)}…`);
  }
  console.log(`Oluşturulan: ${created}, atlanan (zaten var): ${skipped}. (re-run → 0 yeni)`);
}

main().then(() => db.$disconnect()).catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
