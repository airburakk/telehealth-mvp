// GERİYE DÖNÜK at-rest şifreleme (backfill) — ŞEMA-GÜDÜMLÜ (2026-09-29; E2EE Faz 1 §6.1'in devamı).
// Düz metin kalmış klinik/kişisel satırları uygulama-katmanı envelope ile şifreler (lib/crypto encryptField).
//
// KAPSAM — envanter YOK: information_schema'daki tüm metin kolonları taranır (lib/kek-rotation discoverTextColumns) ve
//   (a) KARIŞIK kolonlar (hem enc:v1: hem düz satır) OTOMATİK hedeftir: uygulama bu kolonu şifreli yazıyor, düz satırlar
//       şifreleme eklenmeden ÖNCE yazılmış demektir (okuyucular zaten decryptField'den geçer → şifrelemek güvenlidir);
//   (b) `--kolon Tablo.kolon` ile AÇIK hedefler eklenir (yalnız-düz kolonlar; ör. kod yeni şifrelemeye başladı, eski satır var).
//       Yalnız-düz bir kolonu açık hedef yapmadan ÖNCE okuyucuların decryptField kullandığını KODDA doğrula — aksi hâlde arayüz
//       "enc:v1:…" gösterir. Karar desteği: scripts/probe-encryption-coverage.ts (🟠 ipucu bölümü).
// 2026-07-17'deki 13 kolonluk elle envanter, sonradan şifrelenen ~27 kolonu görmüyordu (v6.273 bulgusu) — o yüzden kaldırıldı.
//
// İDEMPOTENT: enc:v1: / blob:v1: / purged:v1: / boş / null satırlar ATLANIR. HİÇBİR ŞEY SİLMEZ. id-cursor sayfalama.
//
// EMNİYET (2026-08-03 kapıları KORUNDU):
//   1. DRY-RUN VARSAYILAN — yazmak için açıkça `--apply`.
//   2. KEK↔DB EŞLEŞME KANITI — yazmadan önce bu DB'de ZATEN şifreli bir satır mevcut KEK ile çözülür (içerik basılmaz).
//      Çözülmüyorsa YANLIŞ ORTAMIN anahtarı → durur. Hiç şifreli satır yoksa (bakir DB) `--allow-unproven-kek` şart.
//   Yanlış KEK ile şifrelemek = veri kaybı (bu DB'nin açamayacağı anahtar).
//
// KULLANIM:
//   npx tsx scripts/encrypt-existing.ts                          → dev (DATABASE_URL + DATA_ENCRYPTION_KEK) DRY-RUN, karışık kolonlar
//   npx tsx scripts/encrypt-existing.ts --kolon Complaint.subject --kolon Complaint.description   → + açık hedefler
//   npx tsx scripts/encrypt-existing.ts --apply [...]            → gerçekten şifreler (geri dönüşü YOK)
//   npx tsx scripts/encrypt-existing.ts --prod [...]             → ÜRETİM: PROD_DATABASE_URL + PROD_DATA_ENCRYPTION_KEK (AÇIKÇA; fallback YOK)
//   --yalniz-hedef → karışık kolonların otomatik seçimini kapatır (yalnız --kolon hedefleri)
// 🔌 scripts/find-kek.ts --run bu modülü AYNI süreçte import eder (DATABASE_URL + DATA_ENCRYPTION_KEK'i o kurar) → bayraklar
//    argv'den okunur, varsayılan istemci `new PrismaClient()`dir; bu sözleşme korunur.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { encryptField, decryptField } from "../src/lib/crypto";
import { discoverTextColumns, quoteIdent } from "../src/lib/kek-rotation";

const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const ALLOW_UNPROVEN_KEK = argv.includes("--allow-unproven-kek");
const PROD = argv.includes("--prod");
const ONLY_TARGETS = argv.includes("--yalniz-hedef");
const EXPLICIT = argv.flatMap((a, i) => (a === "--kolon" && argv[i + 1] ? [argv[i + 1]] : []));

if (PROD) {
  if (!process.env.PROD_DATABASE_URL || !process.env.PROD_DATA_ENCRYPTION_KEK) {
    console.error("✋ --prod için PROD_DATABASE_URL ve PROD_DATA_ENCRYPTION_KEK tanımlı olmalı (DATABASE_URL fallback'i bilinçli YOK).");
    process.exit(1);
  }
  process.env.DATA_ENCRYPTION_KEK = process.env.PROD_DATA_ENCRYPTION_KEK; // encryptField/decryptField env'den okur
}
const db = PROD ? new PrismaClient({ datasourceUrl: process.env.PROD_DATABASE_URL }) : new PrismaClient();

const endpointOf = (u: string | undefined) => { const m = /@([^/]+)\//.exec(u ?? ""); return m ? m[1].split(".")[0] : "(çözülemedi)"; };
const PLAIN_WHERE = (c: string) => `${c} IS NOT NULL AND ${c} <> '' AND ${c} NOT LIKE 'enc:v1:%' AND ${c} NOT LIKE 'blob:v1:%' AND ${c} NOT LIKE 'purged:v1:%'`;

interface Counts { enc: number; plain: number }

async function main() {
  if (!process.env.DATA_ENCRYPTION_KEK) {
    console.error("✋ DATA_ENCRYPTION_KEK tanımsız. Bu betik canlı veriyi şifreler; anahtarsız çalıştırmak anlamsız (openssl rand -base64 32).");
    process.exit(1);
  }
  console.log(`🔐 E2EE backfill (şema-güdümlü) — hedef: ${PROD ? "ÜRETİM" : "env"} (${endpointOf(PROD ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL)}) · mod: ${APPLY ? "APPLY (YAZAR)" : "DRY-RUN (yazmaz)"}`);

  const { columns, idTypes } = await discoverTextColumns(db);
  const known = new Set(columns.map((c) => `${c.table}.${c.column}`));
  for (const t of EXPLICIT) if (!known.has(t)) { console.error(`✋ --kolon ${t}: katalogda böyle bir metin kolonu yok.`); process.exit(1); }

  // Tarama: karışık kolonlar + KEK kanıtı için ilk şifreli örnek
  const counts = new Map<string, Counts>();
  let proofSample: { where: string; value: string } | null = null;
  for (const { table, column } of columns) {
    const t = quoteIdent(table), c = quoteIdent(column);
    const [r] = await db.$queryRawUnsafe<Counts[]>(
      `SELECT count(*) FILTER (WHERE ${c} LIKE 'enc:v1:%')::int AS enc, count(*) FILTER (WHERE ${PLAIN_WHERE(c)})::int AS plain FROM ${t}`,
    );
    counts.set(`${table}.${column}`, r);
    if (!proofSample && r.enc > 0) {
      const [s] = await db.$queryRawUnsafe<{ v: string }[]>(`SELECT ${c} AS v FROM ${t} WHERE ${c} LIKE 'enc:v1:%' LIMIT 1`);
      if (s) proofSample = { where: `${table}.${column}`, value: s.v };
    }
  }
  const mixed = [...counts.entries()].filter(([, r]) => r.enc > 0 && r.plain > 0).map(([k]) => k);
  const targets = [...new Set([...(ONLY_TARGETS ? [] : mixed), ...EXPLICIT])].filter((k) => (counts.get(k)?.plain ?? 0) > 0);

  // KEK↔DB kanıtı (içerik BASILMAZ)
  if (proofSample) {
    try {
      decryptField(proofSample.value);
      console.log(`🔑 KEK↔DB eşleşmesi KANITLANDI (${proofSample.where} çözüldü).`);
    } catch {
      console.error("🛑 DURDURULDU — bu veritabanındaki şifreli veri mevcut DATA_ENCRYPTION_KEK ile ÇÖZÜLEMİYOR.");
      console.error(`   Kanıt satırı: ${proofSample.where}. Neredeyse kesinlikle YANLIŞ ORTAMIN anahtarı yüklü; yazılsaydı veri kaybolurdu.`);
      process.exit(1);
    }
  } else if (!ALLOW_UNPROVEN_KEK) {
    console.error("🛑 DURDURULDU — bu veritabanında hiç şifreli satır yok, KEK↔DB eşleşmesi KANITLANAMIYOR (bakir DB ise --allow-unproven-kek).");
    process.exit(1);
  } else {
    console.log("⚠️ KEK↔DB eşleşmesi kanıtlanamadı (şifreli satır yok) — --allow-unproven-kek ile geçildi.");
  }

  console.log(`\nHedef kolonlar (${targets.length}): karışık otomatik ${ONLY_TARGETS ? 0 : mixed.length} · açık ${EXPLICIT.length}`);
  if (targets.length === 0) { console.log("✓ Şifrelenecek düz satır yok."); return; }

  let total = 0;
  for (const key of targets) {
    const [table, column] = key.split(".");
    if (!idTypes.has(table)) { console.log(`  ⛔ ${key}: tabloda tekil id yok — atlandı`); continue; }
    const t = quoteIdent(table), c = quoteIdent(column);
    const batch = /content|filedata|fileref|photo|evidence/i.test(column) ? 20 : 300;
    let cursor: string | number | null = null; let changed = 0;
    for (;;) {
      const rows: { id: string | number; v: string }[] = cursor === null
        ? await db.$queryRawUnsafe(`SELECT "id", ${c} AS v FROM ${t} WHERE ${PLAIN_WHERE(c)} ORDER BY "id" LIMIT ${batch}`)
        : await db.$queryRawUnsafe(`SELECT "id", ${c} AS v FROM ${t} WHERE ${PLAIN_WHERE(c)} AND "id" > $1 ORDER BY "id" LIMIT ${batch}`, cursor);
      if (rows.length === 0) break;
      for (const r of rows) {
        if (APPLY) await db.$executeRawUnsafe(`UPDATE ${t} SET ${c} = $1 WHERE "id" = $2`, encryptField(r.v), r.id);
        changed++;
      }
      cursor = rows[rows.length - 1].id;
      if (rows.length < batch) break;
    }
    total += changed;
    console.log(`  ${key.padEnd(44)} ${String(changed).padStart(6)} ${APPLY ? "şifrelendi" : "şifrelenecek"}`);
  }
  if (APPLY) console.log(`\n✅ Backfill tamam — ${total} satır şifrelendi. (Tekrar çalıştırılırsa 0 olmalı.)`);
  else { console.log(`\n🔍 DRY-RUN bitti — ${total} satır şifrelenecekti. HİÇBİR ŞEY YAZILMADI.`); if (total > 0) console.log("   Uygulamak için: --apply (geri dönüşü YOKTUR)"); }
}

main()
  .catch((e) => { console.error("❌ Backfill hatası:", e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => db.$disconnect());
