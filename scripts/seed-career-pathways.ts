// Kariyer & denklik rehberi seed'i (v6.89) — kalıcı araç.
//
// KAYNAK: `prisma/seed-data/career-pathways.json` — resmî otorite sayfalarından derlenip
// doğrulanmış süreçler (vault: output/kariyer-denklik-veritabani-2026-08-12.md).
// Otomatik toplayıcı YOK (2026-08-12'de ölçüldü: gmc-uk.org HTTP 403,
// anerkennung-in-deutschland.de 404 → resmî siteler makine erişimine kapalı) → veri küratörlü,
// MedicalCongress ile aynı desen.
//
// ⚠️ İÇERİK DÜRÜSTLÜĞÜ BEKÇİLERİ (bu betiğin asıl işi veri yazmak değil, YANLIŞ VERİYİ ENGELLEMEK):
//   • officialUrl zorunlu ve https:// olmalı — kaynağı olmayan kayıt YAZILMAZ
//   • verifiedAt zorunlu ve GELECEK tarih olamaz
//   • typicalMonths/costNote yalnız resmî kaynakta yazan değer için doldurulur; JSON'da null ise
//     null kalır (tahmini süre = hekimin yanlış planlaması)
//   • scope yalnız "yurtdisi" | "turkiye"; confidence yalnız "dogrulandi" | "kismi"
// Bekçi düşerse betik DURUR (fail-closed) — yarım/şüpheli veri tabloya girmez.
//
// İDEMPOTENT: slug benzersiz → yeniden koşuda günceller, kopya yaratmaz.
//
// GÜVENLİK: seed-congresses.ts / ingest-tr-sources.ts ile aynı korkuluk deseni —
//   • Varsayılan DRY-RUN (yazma için --yaz)
//   • Prod YALNIZ --prod + ayrı PROD_DATABASE_URL env'i
//   • --prod'suz DATABASE_URL prod parmak izine uyuyorsa DURUR
// Yazılan tek tablo CareerPathway — PHI yok (kamuya açık idari süreç bilgisi).
//
// Kullanım:
//   npx tsx scripts/seed-career-pathways.ts               → DEV dry-run
//   npx tsx scripts/seed-career-pathways.ts --yaz         → DEV'e yaz
//   npx tsx scripts/seed-career-pathways.ts --prod        → PROD dry-run
//   npx tsx scripts/seed-career-pathways.ts --prod --yaz  → PROD'a yaz
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const DRY = !args.includes("--yaz");
const PROD = args.includes("--prod");

const SCOPES = ["yurtdisi", "turkiye"];
const CONFIDENCES = ["dogrulandi", "kismi"];

interface Row {
  slug: string;
  scope: string;
  country: string;
  order?: number;
  title: string;
  authority: string;
  summary: string;
  steps: { order: number; title: string; detail: string }[];
  documents: string[];
  languageReq?: string | null;
  examReq?: string | null;
  typicalMonths?: string | null;
  costNote?: string | null;
  officialUrl: string;
  sourceUrls?: string[];
  confidence?: string;
  verifiedAt: string;
  warning?: string | null;
}

/** Fail-closed doğrulama — bir kayıt bile düşerse hiçbir şey yazılmaz. */
function validate(rows: Row[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  const bugun = new Date();
  bugun.setHours(23, 59, 59, 999);

  for (const r of rows) {
    const ad = r.slug || "(slug YOK)";
    if (!r.slug) errors.push(`${ad}: slug boş`);
    if (seen.has(r.slug)) errors.push(`${ad}: slug TEKRAR ediyor`);
    seen.add(r.slug);

    if (!SCOPES.includes(r.scope)) errors.push(`${ad}: scope "${r.scope}" geçersiz (${SCOPES.join("|")})`);
    if (r.confidence && !CONFIDENCES.includes(r.confidence)) {
      errors.push(`${ad}: confidence "${r.confidence}" geçersiz (${CONFIDENCES.join("|")})`);
    }
    for (const alan of ["country", "title", "authority", "summary"] as const) {
      if (!r[alan]?.trim()) errors.push(`${ad}: ${alan} boş`);
    }
    // Kaynağı olmayan kayıt yazılmaz — modülün temel kuralı.
    if (!r.officialUrl?.startsWith("https://")) {
      errors.push(`${ad}: officialUrl yok ya da https:// değil ("${r.officialUrl ?? ""}")`);
    }
    const v = new Date(r.verifiedAt);
    if (Number.isNaN(v.getTime())) errors.push(`${ad}: verifiedAt çözümlenemedi ("${r.verifiedAt}")`);
    else if (v > bugun) errors.push(`${ad}: verifiedAt GELECEK tarih (${r.verifiedAt}) — doğrulama geçmişte olmalı`);

    if (!Array.isArray(r.steps) || !r.steps.length) errors.push(`${ad}: steps boş — adımsız süreç kartı yayınlanmaz`);
    if (!Array.isArray(r.documents)) errors.push(`${ad}: documents dizi değil`);
  }
  return errors;
}

async function main() {
  if (PROD) {
    const prodUrl = process.env.PROD_DATABASE_URL;
    if (!prodUrl) {
      console.error("⛔ --prod istendi ama PROD_DATABASE_URL tanımlı değil. Bilinçli prod akışı bu env'i ŞART koşar.");
      process.exit(1);
    }
    process.env.DATABASE_URL = prodUrl;
    if (process.env.AURA_DB_GUARD === "block") process.env.AURA_DB_GUARD = "warn";
    console.log(`🎯 HEDEF: ÜRETİM ${DRY ? "(dry-run — yazma YOK)" : "(YAZILACAK)"}`);
  } else {
    const fp = process.env.PROD_DB_FINGERPRINT;
    if (fp && (process.env.DATABASE_URL ?? "").includes(fp)) {
      console.error("⛔ DATABASE_URL üretime işaret ediyor ama --prod verilmedi; kazara yazımı önlemek için durduruldu.");
      process.exit(1);
    }
    console.log(`🎯 HEDEF: DEV ${DRY ? "(dry-run)" : "(yazılacak)"}`);
  }

  const rows = JSON.parse(
    readFileSync(join(process.cwd(), "prisma", "seed-data", "career-pathways.json"), "utf8"),
  ) as Row[];
  console.log(`\n📋 Kaynak dosyada ${rows.length} süreç`);

  const errors = validate(rows);
  if (errors.length) {
    console.error(`\n⛔ DOĞRULAMA DÜŞTÜ (${errors.length}) — hiçbir şey yazılmadı:`);
    for (const e of errors) console.error(`   • ${e}`);
    process.exit(1);
  }
  console.log("✅ Doğrulama geçti (officialUrl · verifiedAt · scope · confidence · steps)");

  // Dinamik import ŞART: src/lib/db, DATABASE_URL/AURA_DB_GUARD'ı MODÜL YÜKLENİRKEN okur.
  const { db } = await import("../src/lib/db");

  let yeni = 0, guncel = 0;
  for (const r of rows) {
    const data = {
      scope: r.scope,
      country: r.country,
      order: r.order ?? 0,
      title: r.title,
      authority: r.authority,
      summary: r.summary,
      steps: JSON.stringify(r.steps),
      documents: JSON.stringify(r.documents ?? []),
      languageReq: r.languageReq ?? null,
      examReq: r.examReq ?? null,
      typicalMonths: r.typicalMonths ?? null,
      costNote: r.costNote ?? null,
      officialUrl: r.officialUrl,
      sourceUrls: JSON.stringify(r.sourceUrls ?? []),
      confidence: r.confidence ?? "dogrulandi",
      verifiedAt: new Date(r.verifiedAt),
      warning: r.warning ?? null,
    };
    const mevcut = await db.careerPathway.findUnique({ where: { slug: r.slug }, select: { id: true } });
    if (mevcut) {
      guncel++;
      if (!DRY) await db.careerPathway.update({ where: { slug: r.slug }, data });
    } else {
      yeni++;
      if (!DRY) await db.careerPathway.create({ data: { slug: r.slug, ...data } });
    }
    const bayrak = r.confidence === "kismi" ? "⚠️ kısmi" : "✅ tam  ";
    console.log(`  ${bayrak} ${mevcut ? (DRY ? "güncellenirdi" : "güncellendi ") : (DRY ? "eklenirdi    " : "eklendi      ")} ${r.slug.padEnd(22)} ${r.title.slice(0, 46)}`);
  }

  console.log(`\n── ÖZET ── yeni: ${yeni} · güncellenen: ${guncel} ${DRY ? "(dry-run — YAZILMADI)" : "(yazıldı)"}`);
  if (!DRY) {
    const toplam = await db.careerPathway.count();
    const kismi = await db.careerPathway.count({ where: { confidence: "kismi" } });
    console.log(`   TEYİT — tabloda ${toplam} süreç (${kismi} tanesi "kısmi" = teyit bekliyor, UI'da ibareyle çıkar)`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
