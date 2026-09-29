// ŞİFRELEME KAPSAM SONDASI — şema-güdümlü, SALT-OKUR (2026-09-29; v6.273'ün devamı).
//
// SORU: hangi metin kolonları KARIŞIK — hem envelope (enc:v1:) hem DÜZ METİN taşıyor? Karışık kolon = uygulama bu kolonu
// artık şifreli yazıyor ama şifreleme eklenmeden ÖNCE yazılmış düz satırlar duruyor → geriye dönük şifreleme adayı.
// Eski `probe-plaintext-count.ts` 13 kolonluk elle envanterle sayıyordu; şifrelemesi sonradan eklenen kolonlar
// (Doctor.phone/mmssPolicyNo · ConsultationRequest.* · SystemMessage.* · StaffApplication.answers …) hiç görünmüyordu.
// Burada envanter YOK: information_schema'daki tüm base tabloların tüm metin kolonları (lib/kek-rotation discoverTextColumns).
//
// GÜVENLİK: HİÇBİR ŞEY YAZMAZ · içerik/PHI BASMAZ (yalnız sayılar) · KEK istemez · `--prod` yalnız PROD_DATABASE_URL ile
// (DATABASE_URL fallback'i bilinçli YOK — dev'i sayıp "prod temiz" sanma riski).
//
// Kullanım: npx tsx scripts/probe-encryption-coverage.ts [--prod] [--tum]
//   --tum  → yalnız-düz-metin kolonları da listeler (gürültülü: başlık/özet gibi tasarım gereği düz kolonlar).
import "dotenv/config";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import { discoverTextColumns, quoteIdent } from "../src/lib/kek-rotation";

/**
 * KOD-TÜREVLİ İPUCU (envanter DEĞİL): src/ altında `<alan>: encryptField(` · `<alan>: await storeDocument(` · `data.<alan> = encryptField(`
 * desenlerinden şifrelenen ALAN ADLARI çıkarılır. Yalnız-düz bir kolonun adı bu kümedeyse "kod şifreliyor ama bu kolonda hiç şifreli
 * satır yok" demektir → şifreleme eklenmeden ÖNCE yazılmış satırlar (karışık sezgisi bunu göremez: şifreli satır hiç yok).
 * Model bilgisi yok (yalnız ad) → aynı adlı başka tablo kolonu da işaretlenebilir; bu bir ipucudur, karar insanındır.
 */
function encryptedFieldNamesFromSource(root: string): Set<string> {
  const names = new Set<string>();
  const re = /(?:\b(\w+)\s*:\s*(?:await\s+)?(?:encryptField|storeDocument)\(|\bdata\.(\w+)\s*=\s*encryptField\()/g;
  const walk = (dir: string) => {
    for (const ent of readdirSync(dir)) {
      const p = join(dir, ent);
      if (statSync(p).isDirectory()) { if (ent !== "node_modules") walk(p); continue; }
      if (!/\.(ts|tsx)$/.test(ent)) continue;
      const src = readFileSync(p, "utf8");
      for (const m of src.matchAll(re)) names.add(m[1] ?? m[2]);
    }
  };
  walk(root);
  return names;
}

const PROD = process.argv.includes("--prod");
const ALL = process.argv.includes("--tum");
const url = PROD ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!url) {
  console.error(PROD ? "✋ PROD_DATABASE_URL tanımsız — üretim keşfi açık niyet ister." : "✋ DATABASE_URL tanımsız.");
  process.exit(1);
}
if (!PROD) {
  const fp = process.env.PROD_DB_FINGERPRINT;
  if (fp && url.includes(fp)) { console.error("⛔ DATABASE_URL üretim parmak izini içeriyor — üretim için --prod kullan."); process.exit(1); }
}
const db = new PrismaClient({ datasourceUrl: url });

interface Row { enc: number; blob: number; purged: number; plain: number }
interface Report extends Row { table: string; column: string }

async function main() {
  const t0 = Date.now();
  const { columns } = await discoverTextColumns(db);
  const mixed: Report[] = [], covered: Report[] = [], plainOnly: Report[] = [];
  for (const { table, column } of columns) {
    const t = quoteIdent(table), c = quoteIdent(column);
    const [r] = await db.$queryRawUnsafe<Row[]>(
      `SELECT count(*) FILTER (WHERE ${c} LIKE 'enc:v1:%')::int AS enc, ` +
      `count(*) FILTER (WHERE ${c} LIKE 'blob:v1:%')::int AS blob, ` +
      `count(*) FILTER (WHERE ${c} LIKE 'purged:v1:%')::int AS purged, ` +
      `count(*) FILTER (WHERE ${c} IS NOT NULL AND ${c} <> '' AND ${c} NOT LIKE 'enc:v1:%' AND ${c} NOT LIKE 'blob:v1:%' AND ${c} NOT LIKE 'purged:v1:%')::int AS plain ` +
      `FROM ${t}`,
    );
    const rep: Report = { table, column, ...r };
    if (r.enc + r.blob > 0 && r.plain > 0) mixed.push(rep);
    else if (r.enc + r.blob > 0) covered.push(rep);
    else if (r.plain > 0) plainOnly.push(rep);
  }
  const fmt = (x: Report) => `  ${`${x.table}.${x.column}`.padEnd(44)} enc:${String(x.enc).padStart(5)}  blob:${String(x.blob).padStart(4)}  purged:${String(x.purged).padStart(3)}  DÜZ:${String(x.plain).padStart(5)}`;

  console.log(`🔎 Şifreleme kapsam sondası — hedef: ${PROD ? "ÜRETİM" : "dev"} · ${columns.length} metin kolonu · ${((Date.now() - t0) / 1000).toFixed(1)} sn\n`);
  console.log(`⚠️ KARIŞIK kolonlar (şifreli + düz metin birlikte → geriye dönük şifreleme adayı): ${mixed.length}`);
  for (const x of mixed) console.log(fmt(x));
  console.log(`\n✅ Tam kapsanan kolonlar (yalnız envelope/blob): ${covered.length}`);
  for (const x of covered) console.log(fmt(x));
  const codeNames = encryptedFieldNamesFromSource(join(process.cwd(), "src"));
  const suspect = plainOnly.filter((x) => codeNames.has(x.column));
  console.log(`\n🟠 Kodda şifrelenen ALAN ADI taşıyan ama DB'de yalnız DÜZ satırı olan kolonlar (şifreleme öncesi eski satır adayı; ad-bazlı ipucu): ${suspect.length}`);
  for (const x of suspect) console.log(fmt(x));
  if (ALL) {
    console.log(`\n· Yalnız düz metin kolonlar (tasarım gereği ya da hiç şifrelenmemiş): ${plainOnly.length}`);
    for (const x of plainOnly) console.log(fmt(x));
  } else {
    console.log(`\n· Yalnız düz metin kolonlar: ${plainOnly.length} (listelemek için --tum)`);
  }
  const plainInMixed = mixed.reduce((s, x) => s + x.plain, 0);
  console.log(`\nTOPLAM: karışık kolonlarda ${plainInMixed} düz satır (geriye dönük şifreleme adayı).`);
}

main().catch((e) => { console.error("❌", e instanceof Error ? e.message : e); process.exitCode = 1; }).finally(() => db.$disconnect());
