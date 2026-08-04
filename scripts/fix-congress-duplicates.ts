// Kongre mükerrer düzeltmesi + kimlik göçü (v6.68) — idempotent, kalıcı güvenlik ağı.
//
// SORUN: v6.62-67 seed'i externalId'yi `branş:ad` üretiyordu → aynı kongre iki branştan
// İKİ AYRI satır oldu (kanıt: prod kapak taramasında "107. AATS 107th Annual Meeting" × 2)
// ve seed'in "branşları birleştir" dalı hiç tetiklenmedi. v6.68'de kimlik branşsız
// (yalnız ad — scripts/congress-id.ts). Bu script mevcut veriyi yeni kimliğe taşır:
//   1) Aynı ada inen kümeler TEK satıra iner: branchSlugs ∪ · sourceUrls ∪ ·
//      coverImage KORUNUR (kapaklı satır hayatta kalır; ikisi de kapaklıysa kalanınki).
//   2) CongressFollow (doktor takibi) kalan satıra taşınır — şemada FK/relation YOK,
//      taşınmazsa takipler sessizce yetim kalır ve kongre alarmları ölürdü. Aynı doktor
//      iki kopyayı da takip ediyorsa tek kayıt kalır, sentAlerts ∪ (alarm tekrarlanmaz).
//   3) Tekil satırların kimliğinden branş öneki atılır (eski → yeni biçim).
//   Aynı ada inen satırlar FARKLI kongre görünüyorsa (url VE tarih uyuşmuyor) o kümeye
//   DOKUNULMAZ, yüksek sesle raporlanır (ad çakışması güvencesi).
//
// İDEMPOTENT: ':' içermeyen kimlik zaten yeni biçimdir → ikinci koşu 0 işlem raporlar.
// SIRA: önce bu script (--yaz), sonra seed — seed eski biçimli veri üzerinde koşmayı
// v6.68 bekçisiyle REDDEDER (yeni kimlikle eşleşme olmaz, her kongre yeniden yaratılırdı).
//
// GÜVENLİK: seed-congresses.ts ile aynı korkuluk deseni —
//   • Varsayılan DRY-RUN (yazma için --yaz)
//   • Prod YALNIZ --prod + ayrı PROD_DATABASE_URL env'i
//   • --prod'suz DATABASE_URL prod parmak izine uyuyorsa DURUR
// Dokunulan tablolar: MedicalCongress (yalnız source="curated") + CongressFollow — PHI yok.
//
// Kullanım:
//   npx tsx scripts/fix-congress-duplicates.ts               → DEV dry-run
//   npx tsx scripts/fix-congress-duplicates.ts --yaz         → DEV'e uygula
//   npx tsx scripts/fix-congress-duplicates.ts --prod --yaz  → PROD'a uygula
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Prisma } from "@prisma/client";
import { congressExternalId } from "./congress-id";

const args = process.argv.slice(2);
const DRY = !args.includes("--yaz");
const PROD = args.includes("--prod");

/** v6.62-67 kimlik algoritması — YALNIZ eski→yeni eşleme için (yeni kod congress-id.ts kullanır). */
function eskiExternalId(branchSlug: string, name: string): string {
  const base = `${branchSlug}:${name}`
    .toLocaleLowerCase("tr-TR")
    .replace(/[ıİ]/g, "i").replace(/[şŞ]/g, "s").replace(/[ğĞ]/g, "g")
    .replace(/[üÜ]/g, "u").replace(/[öÖ]/g, "o").replace(/[çÇ]/g, "c")
    .replace(/[^a-z0-9:]+/g, "-")
    .replace(/^-|-$/g, "");
  return base.slice(0, 180);
}

/** JSON string[] alanların birleşimi (bozuk/boş değerler sessizce atlanır, sıra korunur). */
function birlesim(...jsonDizileri: string[]): string[] {
  return [...new Set(jsonDizileri.flatMap((s) => {
    try {
      const v = JSON.parse(s);
      return Array.isArray(v) ? (v as string[]) : [];
    } catch {
      return [];
    }
  }))];
}

async function main() {
  if (PROD) {
    const prodUrl = process.env.PROD_DATABASE_URL;
    if (!prodUrl) {
      console.error("⛔ --prod istendi ama PROD_DATABASE_URL tanımlı değil.");
      process.exit(1);
    }
    process.env.DATABASE_URL = prodUrl;
    if (process.env.AURA_DB_GUARD === "block") process.env.AURA_DB_GUARD = "warn";
    console.log(`🎯 HEDEF: ÜRETİM ${DRY ? "(dry-run)" : "(YAZILACAK)"}`);
  } else {
    const fp = process.env.PROD_DB_FINGERPRINT;
    if (fp && (process.env.DATABASE_URL ?? "").includes(fp)) {
      console.error("⛔ DATABASE_URL üretime işaret ediyor ama --prod verilmedi; durduruldu.");
      process.exit(1);
    }
    console.log(`🎯 HEDEF: DEV ${DRY ? "(dry-run)" : "(yazılacak)"}`);
  }

  // Dinamik import: db.ts env'i modül yüklenirken okur (yukarıdaki ayarlar önce bitmeli).
  const { db } = await import("../src/lib/db");

  // Eski→yeni kimlik haritası JSON'dan: mevcut satırlar bu dosyadan seed'lendi → birebir
  // eşleme. Haritada olmayanlar (adı sonradan değişmiş JSON'dan gelenler) için yedek yol:
  // ':' sonrası dilim yeniden normalize edilir — ad 180 kesmesine uğramadıysa sonuç aynıdır
  // (bugünkü en uzun ad-slug 83 karakter, kesme teorik).
  const jsonHarita = new Map<string, string>();
  try {
    const raw = readFileSync(join(process.cwd(), "prisma", "seed-data", "congresses.json"), "utf-8");
    const rows = JSON.parse(raw) as { branchSlug: string; name: string }[];
    for (const r of rows) jsonHarita.set(eskiExternalId(r.branchSlug, r.name), congressExternalId(r.name));
  } catch {
    console.log("ℹ️  congresses.json okunamadı — yalnız ':' sonrası dilimden göç edilecek.");
  }

  const yeniKimlik = (externalId: string): string =>
    externalId.includes(":")
      ? (jsonHarita.get(externalId) ?? congressExternalId(externalId.slice(externalId.indexOf(":") + 1)))
      : externalId;

  const curated = await db.medicalCongress.findMany({
    where: { source: "curated", externalId: { not: null } },
    select: {
      id: true, externalId: true, title: true, url: true, startDate: true,
      branchSlugs: true, sourceUrls: true, coverImage: true, createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
  console.log(`\n📚 Küratörlü kayıt: ${curated.length}`);

  const gruplar = new Map<string, typeof curated>();
  for (const row of curated) {
    const hedef = yeniKimlik(row.externalId as string);
    const g = gruplar.get(hedef);
    g ? g.push(row) : gruplar.set(hedef, [row]);
  }

  let dokunulmayan = 0, kimlikDuzeltilen = 0, birlesenGrup = 0, silinenKopya = 0, tasinanTakip = 0, cakisma = 0;

  for (const [hedef, grup] of gruplar) {
    if (grup.length === 1) {
      const r = grup[0];
      if (r.externalId === hedef) {
        dokunulmayan++;
        continue;
      }
      console.log(`✏️  Kimlik: ${r.externalId} → ${hedef}`);
      if (!DRY) await db.medicalCongress.update({ where: { id: r.id }, data: { externalId: hedef } });
      kimlikDuzeltilen++;
      continue;
    }

    // Aynı ada inen ≥2 satır — gerçekten aynı kongre mi? İkisi de uyuşmuyorsa dokunma.
    const urller = new Set(grup.map((r) => r.url).filter(Boolean));
    const tarihler = new Set(grup.map((r) => r.startDate.toISOString()));
    if (urller.size > 1 && tarihler.size > 1) {
      cakisma++;
      console.error(`\n⚠️  ÇAKIŞMA — "${hedef}" adına inen ${grup.length} satır farklı kongre görünüyor (url VE tarih uyuşmuyor); DOKUNULMADI:`);
      for (const r of grup) {
        console.error(`     · ${r.externalId} — ${r.title} — ${r.url ?? "url yok"} — ${r.startDate.toISOString().slice(0, 10)}`);
      }
      continue;
    }

    // Kalan satır: kapaklı olan (kapak emeği korunur) → eşitlikte en eski (kararlı seçim).
    const sirali = [...grup].sort((a, b) =>
      (b.coverImage ? 1 : 0) - (a.coverImage ? 1 : 0) || a.createdAt.getTime() - b.createdAt.getTime());
    const kalan = sirali[0];
    const kopyalar = sirali.slice(1);
    const kopyaIdler = kopyalar.map((r) => r.id);

    const branslar = birlesim(...grup.map((r) => r.branchSlugs));
    const kaynaklar = birlesim(...grup.map((r) => r.sourceUrls));
    const kapak = kalan.coverImage ?? kopyalar.find((r) => r.coverImage)?.coverImage ?? null;
    const atilanKapak = kopyalar.filter((r) => r.coverImage && r.coverImage !== kapak).length;

    birlesenGrup++;
    silinenKopya += kopyalar.length;
    console.log(`\n🔗 Birleşim: "${kalan.title}" → ${hedef}`);
    console.log(`   kalan:     ${kalan.externalId}${kalan.coverImage ? " (kapaklı)" : ""}`);
    for (const k of kopyalar) console.log(`   silinecek: ${k.externalId}${k.coverImage ? " (kapaklı)" : ""}`);
    console.log(`   branşlar: [${branslar.join(", ")}] · kaynak URL ${kaynaklar.length} · kapak ${kapak ? "korunuyor" : "yok"}`);
    if (atilanKapak) console.log(`   ⚠️ ${atilanKapak} kopyanın FARKLI kapağı atılıyor (kalan satırınki korunur)`);

    // Takip taşıma: doktor bazında grupla — kalan satıra TEK takip düşer, sentAlerts ∪
    // ((doctorId, congressId) benzersiz; kalan satırdaki mevcut takip varsa o tutulur).
    const takipler = await db.congressFollow.findMany({ where: { congressId: { in: grup.map((r) => r.id) } } });
    const doktorTakipleri = new Map<string, typeof takipler>();
    for (const t of takipler) {
      const g = doktorTakipleri.get(t.doctorId);
      g ? g.push(t) : doktorTakipleri.set(t.doctorId, [t]);
    }

    const takipIslemleri: Prisma.PrismaPromise<unknown>[] = [];
    let grupTakip = 0;
    for (const tGrup of doktorTakipleri.values()) {
      if (tGrup.length === 1 && tGrup[0].congressId === kalan.id) continue; // zaten yerinde
      const alarmlar = birlesim(...tGrup.map((t) => t.sentAlerts));
      const tutulan = tGrup.find((t) => t.congressId === kalan.id) ?? tGrup[0];
      takipIslemleri.push(db.congressFollow.update({
        where: { id: tutulan.id },
        data: { congressId: kalan.id, sentAlerts: JSON.stringify(alarmlar) },
      }));
      for (const t of tGrup) {
        if (t.id !== tutulan.id) takipIslemleri.push(db.congressFollow.delete({ where: { id: t.id } }));
      }
      grupTakip += tGrup.filter((t) => t.congressId !== kalan.id).length;
    }
    tasinanTakip += grupTakip;
    if (grupTakip) console.log(`   takip: ${grupTakip} kayıt kalan satıra taşınıyor/birleşiyor`);

    if (DRY) continue;

    // Sıra ÖNEMLİ: önce kopyalar silinir — yarım kalmış önceki koşuda hedef kimlik bir
    // kopyada kalmış olabilir; (source, externalId) benzersizliği ancak böyle çakışmaz.
    await db.$transaction([
      ...takipIslemleri,
      db.medicalCongress.deleteMany({ where: { id: { in: kopyaIdler } } }),
      db.medicalCongress.update({
        where: { id: kalan.id },
        data: {
          externalId: hedef,
          branchSlugs: JSON.stringify(branslar),
          sourceUrls: JSON.stringify(kaynaklar),
          coverImage: kapak,
        },
      }),
    ]);
  }

  console.log(
    `\n${DRY ? "🔍 DRY-RUN (yazılmadı; uygulamak için --yaz)" : "✅ Uygulandı"} — ` +
    `dokunulmayan ${dokunulmayan} · kimlik düzeltilen ${kimlikDuzeltilen} · ` +
    `birleşen grup ${birlesenGrup} (silinen kopya ${silinenKopya} · taşınan takip ${tasinanTakip})` +
    (cakisma ? ` · ⚠️ ÇAKIŞMA ${cakisma} (dokunulmadı — elle incele)` : ""),
  );
  const kalanEski = DRY
    ? curated.filter((r) => (r.externalId as string).includes(":")).length
    : await db.medicalCongress.count({ where: { source: "curated", externalId: { contains: ":" } } });
  console.log(`Eski biçimli kimlik ${DRY ? "(mevcut)" : "(kalan)"}: ${kalanEski}${!DRY && kalanEski === 0 ? " → seed artık koşabilir" : ""}`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
