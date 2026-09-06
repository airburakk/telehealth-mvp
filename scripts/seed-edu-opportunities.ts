// Kariyer EDU E1 statik kayıtlarını (lib/edu-opportunities, 13 kayıt) EduOpportunity tablosuna yükler (E2, 2026-09-06). KALICI ARAÇ.
//   npx tsx scripts/seed-edu-opportunities.ts            → .env DATABASE_URL (DEV dalı)
//   npx tsx scripts/seed-edu-opportunities.ts --prod     → PROD_DATABASE_URL (prod-onay disiplini: yalnız kullanıcı isteğiyle)
// Upsert: id = statik slug. Yeniden koşumda içerik alanları güncellenir; approvedAt DB'de ne ise KALIR (admin onayı/iptali ezilmez;
// yalnız yeni satırda statik değer yazılır). Silme yapılmaz (DB'de admin girişleri de yaşar).
import "dotenv/config";

async function main() {
  const prod = process.argv.includes("--prod");
  if (prod) {
    const url = process.env.PROD_DATABASE_URL;
    if (!url) throw new Error("--prod istendi ama PROD_DATABASE_URL tanımlı değil.");
    process.env.DATABASE_URL = url;
    if (process.env.PROD_DIRECT_URL) process.env.DIRECT_URL = process.env.PROD_DIRECT_URL;
    // Açık --prod = bilinçli üretim işlemi → DB guard "block" ise create-admin deseniyle "warn"a düşürülür (lib/db).
    if (process.env.AURA_DB_GUARD === "block") process.env.AURA_DB_GUARD = "warn";
  } else if (/neon\.tech/.test(process.env.DATABASE_URL ?? "") && !/falling-morning/.test(process.env.DATABASE_URL ?? "")) {
    throw new Error("DATABASE_URL DEV dalı değil ve --prod verilmedi — durduruldu.");
  }
  const { db } = await import("../src/lib/db");
  const { EDU_OPPORTUNITIES } = await import("../src/lib/edu-opportunities");
  const toDate = (s: string | null) => (s ? new Date(`${s}T00:00:00Z`) : null);
  let created = 0, updated = 0;
  for (const o of EDU_OPPORTUNITIES) {
    const data = {
      kind: o.kind, title: o.title, organizer: o.organizer, country: o.country, deadline: toDate(o.deadline), deadlineNote: o.deadlineNote,
      startsAt: o.startsAt, eligibility: o.eligibility, sourceUrl: o.sourceUrl, verifiedAt: toDate(o.verifiedAt) as Date,
    };
    const existing = await db.eduOpportunity.findUnique({ where: { id: o.id }, select: { id: true } });
    if (existing) { await db.eduOpportunity.update({ where: { id: o.id }, data }); updated++; }
    else { await db.eduOpportunity.create({ data: { id: o.id, ...data, approvedAt: toDate(o.approvedAt) } }); created++; }
  }
  const total = await db.eduOpportunity.count(); const approved = await db.eduOpportunity.count({ where: { approvedAt: { not: null } } });
  console.log(`${prod ? "PROD" : "DEV"}: oluşturulan ${created} · güncellenen ${updated} · tabloda ${total} (onaylı ${approved})`);
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
