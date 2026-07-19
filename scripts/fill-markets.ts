// Doctor.markets HEDEFLİ doldurma (yalnız BOŞ alanlar) — enrich-profiles.ts'in markets kümesinin izole hali.
// Kapsam bilinçli DAR: procedures/foto/yorum/vaka alanlarına DOKUNMAZ (o kümeler ayrı kullanıcı kararı;
// enrich-profiles.ts foto atamasını "yanlışsa düzeltir" ve yorum üretir → markets onayıyla koşulamaz).
// KULLANIM (dry-run varsayılan; hiçbir şey yazmaz):
//   npx tsx scripts/fill-markets.ts            → ne yazılacağını listeler
//   npx tsx scripts/fill-markets.ts --write    → boş markets alanlarını doldurur
// ⚠️ ÜRETİM KORUMASI: DATABASE_URL, PROD_DB_FINGERPRINT'i içeriyorsa ALLOW_PROD_MARKETS_FILL=1 şart
//    (rotate-kek.ts korkuluğunun eşleniği; db.ts guard'ı script'lerden geçmez).
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { COUNTRIES } from "../src/lib/constants";

const WRITE = process.argv.includes("--write");

const fp = process.env.PROD_DB_FINGERPRINT;
if (fp && (process.env.DATABASE_URL ?? "").includes(fp) && process.env.ALLOW_PROD_MARKETS_FILL !== "1") {
  console.error("⛔ DATABASE_URL üretim parmak izini içeriyor. Prod koşumu yalnız kullanıcı onayı +");
  console.error("   ALLOW_PROD_MARKETS_FILL=1 AÇIKÇA verilerek olur.");
  process.exit(1);
}

const db = new PrismaClient();

// enrich-profiles.ts marketsFor ile birebir aynı mantık (o dosya import edilemez: top-level main koşuyor).
// Doktorun Türkçe-dışı dillerine karşılık gelen hedef ülkeler + TR (yerel); en çok 6 pazar.
function marketsFor(languages: string): string {
  const langs = languages.split(",").map((s) => s.trim()).filter(Boolean);
  const targetLangs = langs.filter((l) => l !== "Türkçe");
  const codes = new Set<string>(["TR"]);
  for (const c of COUNTRIES) {
    if (c.code === "TR") continue;
    if (c.langs.some((l) => targetLangs.includes(l))) codes.add(c.code);
  }
  return [...codes].slice(0, 6).join(",");
}

async function main() {
  const doctors = await db.doctor.findMany({
    select: { id: true, name: true, languages: true, markets: true },
    orderBy: { name: "asc" },
  });
  const empty = doctors.filter((d) => !d.markets || !d.markets.trim());
  console.log(`Doktor: ${doctors.length} · markets boş: ${empty.length} · mod: ${WRITE ? "WRITE" : "DRY-RUN"}`);
  for (const d of empty) {
    const m = marketsFor(d.languages);
    console.log(`  ${d.name} [${d.languages}] → ${m}`);
    if (WRITE && m) await db.doctor.update({ where: { id: d.id }, data: { markets: m } });
  }
  if (!WRITE && empty.length) console.log("→ Yazmak için: npx tsx scripts/fill-markets.ts --write");
  if (WRITE) {
    const still = await db.doctor.count({ where: { OR: [{ markets: null }, { markets: "" }] } });
    console.log(`✓ Yazım bitti · markets hâlâ boş: ${still}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await db.$disconnect(); });
