// M5 — Mevcut demo hekimleri onboard et (idempotent). YALNIZCA onboardedAt=null olanları damgalar
// → re-run'da 0 değişiklik. Hiçbir şey SİLMEZ; opt-in'ler deterministik hash ile (~yarısı açık)
// ki demo Ana Sayfasında Pro Bono / Konsültasyon pencereleri görünür olsun. SO ünvana göre otomatik.
// Çalıştır: npx tsx scripts/onboard-doctors.ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}

async function main() {
  const pending = await db.doctor.findMany({ where: { onboardedAt: null }, select: { id: true, name: true, title: true } });
  console.log(`Onboard bekleyen hekim: ${pending.length}`);
  let n = 0;
  for (const d of pending) {
    const proBonoOptIn = hash(d.id) % 10 < 6; // ~%60 Pro Bono açık
    const consultOptIn = hash(d.id + "consult") % 10 < 5; // ~%50 Konsültasyon açık
    await db.doctor.update({
      where: { id: d.id },
      data: { onboardedAt: new Date(), proBonoOptIn, consultOptIn },
    });
    n++;
    console.log(`  ✓ ${d.title} ${d.name} — proBono:${proBonoOptIn} consult:${consultOptIn}`);
  }
  console.log(`Damgalanan: ${n}. (re-run → 0)`);
}

main().then(() => db.$disconnect()).catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
