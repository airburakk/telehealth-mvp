// Kongre veritabanı seed'i (v6.62) — kalıcı araç.
//
// KAYNAK: `prisma/seed-data/congresses.json` — 30 branşın ulusal + uluslararası kongreleri,
// resmî sitelerinden iki turda doğrulanarak derlendi (vault: output/kongre-veritabani-2026-08-03.md).
// Otomatik agregatör YOK (bilinçli: ölçüldü, hepsi ya bot korumalı ya JS-render ya ToS engelli) →
// veri küratörlü, tazeleme ayrı döngüde (`scripts/refresh-congresses.ts` raporu).
//
// İDEMPOTENT: (source="curated", externalId=<slug>) benzersiz → yeniden koşuda güncelleme yapar,
// kopya yaratmaz. Elle girilen kayıtlara (source=null) DOKUNMAZ.
//
// KİMLİK (v6.68): externalId YALNIZ addan üretilir (scripts/congress-id.ts) — branş kimliğe
// GİRMEZ. v6.62-67'de `branş:ad` biçimindeydi; aynı kongre iki branştan iki AYRI satır oldu
// (prod: AATS × 2) ve aşağıdaki "branşları birleştir" dalı hiç tetiklenmedi. Eski biçimli
// veri üzerinde bu seed ÇALIŞMAZ (aşağıdaki bekçi) — önce göç:
//   npx tsx scripts/fix-congress-duplicates.ts [--prod] --yaz
//
// GÜVENLİK: RG/OHSAD besleme aracıyla aynı korkuluk deseni —
//   • Varsayılan DRY-RUN (yazma için --yaz)
//   • Prod YALNIZ --prod + ayrı PROD_DATABASE_URL env'i
//   • --prod'suz DATABASE_URL prod parmak izine uyuyorsa DURUR
// Yazılan tek tablo MedicalCongress — PHI yok (kamuya açık kongre bilgisi).
//
// Kullanım:
//   npx tsx scripts/seed-congresses.ts               → DEV dry-run
//   npx tsx scripts/seed-congresses.ts --yaz         → DEV'e yaz
//   npx tsx scripts/seed-congresses.ts --prod --yaz  → PROD'a yaz
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { congressExternalId } from "./congress-id";

const args = process.argv.slice(2);
const DRY = !args.includes("--yaz");
const PROD = args.includes("--prod");

interface Row {
  branchSlug: string;
  name: string;
  edition?: string | null;
  organizer?: string | null;
  scope: string;
  frequency?: string | null;
  nextStart?: string | null;
  nextEnd?: string | null;
  city?: string | null;
  country?: string | null;
  officialUrl?: string | null;
  abstractDeadline?: string | null;
  earlyBirdDeadline?: string | null;
  registrationNotes?: string | null;
  sourceUrls?: string[];
  confidence?: string;
  verifiedAt?: string | null;
}

function d(s?: string | null): Date | null {
  return s ? new Date(`${s}T00:00:00Z`) : null;
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

  // v6.68 bekçisi: eski `branş:ad` biçimli kimlik varken seed koşarsa findUnique yeni
  // (branşsız) kimlikle hiç eşleşmez ve HER kongre yeniden yaratılırdı (mükerrer patlaması).
  const eskiBicim = await db.medicalCongress.count({
    where: { source: "curated", externalId: { contains: ":" } },
  });
  if (eskiBicim > 0) {
    console.error(`⛔ ${eskiBicim} kayıt eski biçimli (branş önekli) externalId taşıyor — önce göç script'ini çalıştırın:`);
    console.error(`   npx tsx scripts/fix-congress-duplicates.ts ${PROD ? "--prod " : ""}--yaz`);
    process.exit(1);
  }

  const raw = readFileSync(join(process.cwd(), "prisma", "seed-data", "congresses.json"), "utf-8");
  const rows = JSON.parse(raw) as Row[];
  console.log(`\n📚 Kaynak: ${rows.length} kongre kaydı`);

  // Tarihi OLMAYAN kayıtlar da yazılır (edisyon duyurulmamış ama kongre gerçek) — ancak
  // startDate zorunlu olduğu için bunlar ATLANIR ve raporlanır: takvim "tarihi belirsiz" satır
  // göstermez, doktoru yanıltmaz. Tarih duyurulunca tazeleme turu getirir.
  const withDate = rows.filter((r) => r.nextStart);
  const noDate = rows.filter((r) => !r.nextStart);

  let created = 0, updated = 0, skipped = 0;
  const seen = new Set<string>(); // dry-run: aynı koşuda aynı kimliğe düşen 2. satır "güncelleme"dir
  for (const r of withDate) {
    const externalId = congressExternalId(r.name);
    const data = {
      title: `${r.edition ? `${r.edition} ` : ""}${r.name}`.trim(),
      organizer: r.organizer ?? null,
      city: r.city ?? null,
      country: r.country ?? "TR",
      startDate: d(r.nextStart) as Date,
      endDate: d(r.nextEnd),
      abstractDeadline: d(r.abstractDeadline),
      earlyBirdDeadline: d(r.earlyBirdDeadline),
      url: r.officialUrl ?? null,
      branchSlugs: JSON.stringify([r.branchSlug]),
      scope: r.scope === "uluslararasi" ? "uluslararasi" : "ulusal",
      edition: r.edition ?? null,
      frequency: r.frequency ?? null,
      registrationNotes: r.registrationNotes ?? null,
      sourceUrls: JSON.stringify(r.sourceUrls ?? []),
      confidence: r.confidence === "kismi" ? "kismi" : "dogrulandi",
      verifiedAt: d(r.verifiedAt ?? "2026-08-03"),
    };

    const existing = await db.medicalCongress.findUnique({
      where: { source_externalId: { source: "curated", externalId } },
      select: { id: true, branchSlugs: true },
    });

    if (DRY) {
      existing || seen.has(externalId) ? updated++ : created++;
      seen.add(externalId);
      continue;
    }
    if (existing) {
      // Aynı kongre birden çok branşta olabilir (ör. AATS = kvc + göğüs cerrahisi) → branşları
      // BİRLEŞTİR, üzerine yazma (üzerine yazmak kongreyi öbür branştan kaybettirirdi).
      // Diğer veri alanları son işlenen satırdan gelir — çok-branşlı kongrelerin JSON satırları
      // bu yüzden BİREBİR AYNI tutulur (congresses.json'daki multiBranchNote).
      const merged = [...new Set([...(JSON.parse(existing.branchSlugs) as string[]), r.branchSlug])];
      await db.medicalCongress.update({
        where: { id: existing.id },
        data: { ...data, branchSlugs: JSON.stringify(merged) },
      });
      updated++;
    } else {
      await db.medicalCongress.create({ data: { source: "curated", externalId, ...data } });
      created++;
    }
  }
  skipped = noDate.length;

  console.log(`\n${DRY ? "🔍 DRY-RUN" : "✅ Yazıldı"} — yeni ${created} · güncellenen ${updated} · tarihsiz (atlandı) ${skipped}`);
  if (noDate.length) {
    console.log("\n⏭️  Tarihi henüz ilan edilmemiş kongreler (tazeleme turu bekliyor):");
    for (const r of noDate) console.log(`   · [${r.branchSlug}] ${r.edition ?? ""} ${r.name}`.trimEnd());
  }
  const total = await db.medicalCongress.count();
  const curated = await db.medicalCongress.count({ where: { source: "curated" } });
  console.log(`\nHedef DB: toplam ${total} kongre (küratörlü ${curated} · elle girilen ${total - curated})`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
