// EKLEMELİ at-rest şifreleme backfill — E2EE Faz 1 / increment 1+2 ([[hasta-verisi-uctan-uca-sifreleme]] §6.1).
// Mevcut DÜZ METİN klinik kolonlarını uygulama-katmanı envelope ile şifreler (lib/crypto.ts encryptField).
// Kapsanan (inc.1): CaseDocument.content · Signal.data · Consultation.notes · Case.dischargeReport/dischargeStructured.
//   (inc.2): Case.symptoms/reasoning/extra · CheckIn.note/photo · SecondOpinion.content/structured · SecondOpinionDocument.fileRef.
//   (inc.2c): Case.patientName · Case.patientIdentifier (kimlik). İkinci Görüş/User.name kapsam dışı.
//
// İDEMPOTENT: zaten şifreli (enc:v1:) / boş ("") / null satırlar ATLANIR → tekrar çalıştırmak güvenli.
// HİÇBİR ŞEY SİLMEZ. Cursor sayfalama (büyük base64 belgeleri RAM'i doldurmaz).
//
// ⚠️ ÇALIŞTIRMADAN ÖNCE: DATA_ENCRYPTION_KEK, BAĞLANDIĞIN DB'nin ortam anahtarı olmalı. Ray B2'den
//   (2026-07-16) beri yerel .env = DEV branch + dev KEK'i → yerel koşu dev'i şifreler (serbest);
//   üretim koşusu yalnız PROD_* değerleri AÇIKÇA verilerek + onayla (eski "yerel=üretim aynı DB"
//   uyarısı Ray B2 ile geçersizleşti).
// ⚠️ KEK KAYBI = VERİ KAYBI. Anahtarı escrow/yedekle. Bu betik canlı veriyi geri-döndürülemez şifreler.
//
// KULLANIM (2026-08-03'ten beri DRY-RUN VARSAYILAN — hiçbir şey yazmaz):
//   npx tsx scripts/encrypt-existing.ts              → kaç satır etkilenecek, YAZMADAN gösterir
//   npx tsx scripts/encrypt-existing.ts --apply      → gerçekten şifreler (geri dönüşü YOK)
//   ek bayrak: --allow-unproven-kek → yalnız hiç şifreli satırı olmayan (bakir) DB'de gerekir
import "dotenv/config"; // .env'i process.env'e yükle (DATA_ENCRYPTION_KEK + DATABASE_URL) — Prisma da yükler; bu garanti.
import { PrismaClient } from "@prisma/client";
import { encryptField, isEncrypted, decryptField } from "../src/lib/crypto";

const db = new PrismaClient();

// ── EMNİYET (2026-08-03) ────────────────────────────────────────────────────────────────────────
// Bu betik veriyi GERİ DÖNÜLEMEZ biçimde şifreler ve en tehlikeli hata sessizdir: YANLIŞ ORTAMIN
// KEK'iyle koşmak. Dev KEK'i prod DB'ye uygulanırsa kayıtlar prod'un elinde OLMAYAN bir anahtarla
// şifrelenir → veri fiilen kaybolur (yedekten dönmek dışında çaresi yoktur).
// İki kapı eklendi (rotate-kek.ts deseni):
//   1. DRY-RUN VARSAYILAN — yazmak için açıkça `--apply` gerekir.
//   2. KEK↔DB EŞLEŞME KANITI — yazmadan önce, bu DB'de ZATEN şifreli bir satır mevcut KEK ile
//      çözülür. Çözülüyorsa anahtar bu veritabanına aittir. Çözülmüyorsa YANLIŞ KEK → durur.
const APPLY = process.argv.includes("--apply");
const ALLOW_UNPROVEN_KEK = process.argv.includes("--allow-unproven-kek");

/**
 * KEK'in bağlı veritabanına ait olduğunu KANITLA. Şifreli örnek satır bulunup çözülebiliyorsa
 * anahtar doğrudur. Hiç şifreli satır yoksa kanıt üretilemez (bakir DB) → açık bayrak istenir.
 */
async function assertKekMatchesDatabase(): Promise<void> {
  const probes: { label: string; find: () => Promise<string | null> }[] = [
    { label: "Case.symptoms", find: () => db.case.findFirst({ where: { symptoms: { startsWith: "enc:v1:" } }, select: { symptoms: true } }).then((r) => r?.symptoms ?? null) },
    { label: "Case.patientName", find: () => db.case.findFirst({ where: { patientName: { startsWith: "enc:v1:" } }, select: { patientName: true } }).then((r) => r?.patientName ?? null) },
    { label: "CaseDocument.content", find: () => db.caseDocument.findFirst({ where: { content: { startsWith: "enc:v1:" } }, select: { content: true } }).then((r) => r?.content ?? null) },
    { label: "SoCase.diagnosisSummary", find: () => db.secondOpinionCase.findFirst({ where: { diagnosisSummary: { startsWith: "enc:v1:" } }, select: { diagnosisSummary: true } }).then((r) => r?.diagnosisSummary ?? null) },
  ];

  for (const p of probes) {
    const sample = await p.find();
    if (!sample) continue;
    try {
      decryptField(sample); // içerik BASILMAZ — yalnız çözülebilirliği kanıtlanır
      console.log(`🔑 KEK↔DB eşleşmesi KANITLANDI (${p.label} çözüldü).`);
      return;
    } catch {
      console.error("🛑 DURDURULDU — bu veritabanındaki şifreli veri mevcut DATA_ENCRYPTION_KEK ile ÇÖZÜLEMİYOR.");
      console.error(`   Kanıt satırı: ${p.label}. Neredeyse kesinlikle YANLIŞ ORTAMIN anahtarı yüklü.`);
      console.error("   Yazmaya devam edilseydi veri, bu DB'nin açamayacağı bir anahtarla şifrelenecekti.");
      console.error("   Yap: DATABASE_URL ile DATA_ENCRYPTION_KEK'in AYNI ortama ait olduğunu doğrula.");
      process.exit(1);
    }
  }

  // Hiç şifreli satır yok → kanıt üretilemiyor.
  if (!ALLOW_UNPROVEN_KEK) {
    console.error("🛑 DURDURULDU — bu veritabanında hiç şifreli satır yok, KEK↔DB eşleşmesi KANITLANAMIYOR.");
    console.error("   Bakir/yeni bir DB ise beklenen durumdur. Anahtarın doğru ortama ait olduğundan");
    console.error("   EMİNSEN: --allow-unproven-kek bayrağıyla tekrar çalıştır.");
    process.exit(1);
  }
  console.log("⚠️ KEK↔DB eşleşmesi kanıtlanamadı (şifreli satır yok) — --allow-unproven-kek ile geçildi.");
}

const needsEnc = (v: string | null): v is string => v != null && v !== "" && !isEncrypted(v);

// Tek-kolon, string-id tablolar için genel cursor-sayfalamalı backfill.
async function backfill<ID extends string | number>(
  label: string,
  batch: number,
  page: (cursor: ID | null) => Promise<{ id: ID; value: string | null }[]>,
  save: (id: ID, value: string) => Promise<unknown>,
): Promise<number> {
  let cursor: ID | null = null;
  let scanned = 0;
  let changed = 0;
  for (;;) {
    const rows = await page(cursor);
    if (rows.length === 0) break;
    for (const r of rows) {
      scanned++;
      if (!needsEnc(r.value)) continue;
      if (APPLY) await save(r.id, encryptField(r.value)); // DRY-RUN'da yalnız sayılır
      changed++;
    }
    cursor = rows[rows.length - 1].id;
    if (rows.length < batch) break;
  }
  const verb = APPLY ? "şifrelendi" : "şifrelenecek";
  console.log(`  ${label.padEnd(26)} ${String(scanned).padStart(6)} tarandı · ${String(changed).padStart(6)} ${verb}`);
  return changed;
}

async function main() {
  if (!process.env.DATA_ENCRYPTION_KEK) {
    console.error("✋ DATA_ENCRYPTION_KEK tanımsız. Bu betik canlı klinik veriyi şifreler; anahtarsız çalıştırmak anlamsız.");
    console.error("   Üret:  openssl rand -base64 32");
    console.error("   .env'e DATA_ENCRYPTION_KEK olarak ekle — BAĞLANDIĞIN DB'nin ortam anahtarı olmalı.");
    process.exit(1);
  }

  console.log(`🔐 E2EE Faz 1 backfill — mod: ${APPLY ? "APPLY (YAZAR)" : "DRY-RUN (yazmaz)"}`);
  console.log("   (idempotent; boş/şifreli satırlar atlanır)\n");
  await assertKekMatchesDatabase(); // yazmadan ÖNCE ortam kanıtı
  console.log("");
  let total = 0;

  // CaseDocument.content — büyük base64 → küçük batch
  total += await backfill<string>(
    "CaseDocument.content", 50,
    (cur) =>
      db.caseDocument
        .findMany({ where: { content: { not: null } }, select: { id: true, content: true }, orderBy: { id: "asc" }, take: 50, ...(cur ? { skip: 1, cursor: { id: cur } } : {}) })
        .then((rows) => rows.map((r) => ({ id: r.id, value: r.content }))),
    (id, value) => db.caseDocument.update({ where: { id }, data: { content: value } }),
  );

  // Signal.data — transkript (PHI) + offer/answer/ice/bye; çok satır olabilir → büyük batch
  total += await backfill<number>(
    "Signal.data", 500,
    (cur) =>
      db.signal
        .findMany({ select: { id: true, data: true }, orderBy: { id: "asc" }, take: 500, ...(cur ? { skip: 1, cursor: { id: cur } } : {}) })
        .then((rows) => rows.map((r) => ({ id: r.id, value: r.data }))),
    (id, value) => db.signal.update({ where: { id }, data: { data: value } }),
  );

  // Consultation.notes — SOAP
  total += await backfill<string>(
    "Consultation.notes", 500,
    (cur) =>
      db.consultation
        .findMany({ select: { id: true, notes: true }, orderBy: { id: "asc" }, take: 500, ...(cur ? { skip: 1, cursor: { id: cur } } : {}) })
        .then((rows) => rows.map((r) => ({ id: r.id, value: r.notes }))),
    (id, value) => db.consultation.update({ where: { id }, data: { notes: value } }),
  );

  // SecondOpinionDocument.fileRef — SO belge base64 (büyük → küçük batch)
  total += await backfill<string>(
    "SecondOpinionDocument.fileRef", 50,
    (cur) =>
      db.secondOpinionDocument
        .findMany({ where: { fileRef: { not: null } }, select: { id: true, fileRef: true }, orderBy: { id: "asc" }, take: 50, ...(cur ? { skip: 1, cursor: { id: cur } } : {}) })
        .then((rows) => rows.map((r) => ({ id: r.id, value: r.fileRef }))),
    (id, value) => db.secondOpinionDocument.update({ where: { id }, data: { fileRef: value } }),
  );

  // SecondOpinionCase.diagnosisSummary — hastanın tanı özeti (özel nitelikli sağlık verisi).
  // 2026-08-03 dış denetimi P1: aynı modeldeki patientPhone şifreliyken bu alan düz metin kalmıştı.
  // Kod artık yazarken şifreliyor; bu adım DENETİM ÖNCESİ satırları kapatır (idempotent).
  total += await backfill<string>(
    "SoCase.diagnosisSummary", 200,
    (cur) =>
      db.secondOpinionCase
        .findMany({ select: { id: true, diagnosisSummary: true }, orderBy: { id: "asc" }, take: 200, ...(cur ? { skip: 1, cursor: { id: cur } } : {}) })
        .then((rows) => rows.map((r) => ({ id: r.id, value: r.diagnosisSummary }))),
    (id, value) => db.secondOpinionCase.update({ where: { id }, data: { diagnosisSummary: value } }),
  );

  // Case — klinik metin (symptoms/reasoning/extra) + epikriz (dischargeReport/dischargeStructured); çok kolon, tek satır
  {
    let cursor = ""; // id { gt } sayfalama (cuid leksikografik sıralı) → koşullu cursor-spread'siz, temiz tip çıkarımı
    let scanned = 0;
    let changed = 0;
    for (;;) {
      const rows = await db.case.findMany({
        where: { id: { gt: cursor } },
        select: { id: true, patientName: true, patientIdentifier: true, symptoms: true, reasoning: true, extra: true, dischargeReport: true, dischargeStructured: true },
        orderBy: { id: "asc" }, take: 200,
      });
      if (rows.length === 0) break;
      for (const r of rows) {
        scanned++;
        const data: { patientName?: string; patientIdentifier?: string; symptoms?: string; reasoning?: string; extra?: string; dischargeReport?: string; dischargeStructured?: string } = {};
        if (needsEnc(r.patientName)) data.patientName = encryptField(r.patientName);
        if (needsEnc(r.patientIdentifier)) data.patientIdentifier = encryptField(r.patientIdentifier);
        if (needsEnc(r.symptoms)) data.symptoms = encryptField(r.symptoms);
        if (needsEnc(r.reasoning)) data.reasoning = encryptField(r.reasoning);
        if (needsEnc(r.extra)) data.extra = encryptField(r.extra);
        if (needsEnc(r.dischargeReport)) data.dischargeReport = encryptField(r.dischargeReport);
        if (needsEnc(r.dischargeStructured)) data.dischargeStructured = encryptField(r.dischargeStructured);
        if (Object.keys(data).length) {
          if (APPLY) await db.case.update({ where: { id: r.id }, data }); // DRY-RUN'da yalnız sayılır
          changed++;
        }
      }
      cursor = rows[rows.length - 1].id;
      if (rows.length < 200) break;
    }
    console.log(`  ${"Case (kimlik+klinik+epikriz)".padEnd(26)} ${String(scanned).padStart(6)} tarandı · ${String(changed).padStart(6)} ${APPLY ? "şifrelendi" : "şifrelenecek"}`);
    total += changed;
  }

  // CheckIn — post-op not + foto (iki kolon)
  {
    let cursor = "";
    let scanned = 0;
    let changed = 0;
    for (;;) {
      const rows = await db.checkIn.findMany({
        where: { id: { gt: cursor } },
        select: { id: true, note: true, photo: true },
        orderBy: { id: "asc" }, take: 200,
      });
      if (rows.length === 0) break;
      for (const r of rows) {
        scanned++;
        const data: { note?: string; photo?: string } = {};
        if (needsEnc(r.note)) data.note = encryptField(r.note);
        if (needsEnc(r.photo)) data.photo = encryptField(r.photo);
        if (Object.keys(data).length) {
          if (APPLY) await db.checkIn.update({ where: { id: r.id }, data }); // DRY-RUN'da yalnız sayılır
          changed++;
        }
      }
      cursor = rows[rows.length - 1].id;
      if (rows.length < 200) break;
    }
    console.log(`  ${"CheckIn.note/photo".padEnd(26)} ${String(scanned).padStart(6)} tarandı · ${String(changed).padStart(6)} ${APPLY ? "şifrelendi" : "şifrelenecek"}`);
    total += changed;
  }

  // SecondOpinion — yazılı görüş (content + structured)
  {
    let cursor = "";
    let scanned = 0;
    let changed = 0;
    for (;;) {
      const rows = await db.secondOpinion.findMany({
        where: { id: { gt: cursor } },
        select: { id: true, content: true, structured: true },
        orderBy: { id: "asc" }, take: 200,
      });
      if (rows.length === 0) break;
      for (const r of rows) {
        scanned++;
        const data: { content?: string; structured?: string } = {};
        if (needsEnc(r.content)) data.content = encryptField(r.content);
        if (needsEnc(r.structured)) data.structured = encryptField(r.structured);
        if (Object.keys(data).length) {
          if (APPLY) await db.secondOpinion.update({ where: { id: r.id }, data }); // DRY-RUN'da yalnız sayılır
          changed++;
        }
      }
      cursor = rows[rows.length - 1].id;
      if (rows.length < 200) break;
    }
    console.log(`  ${"SecondOpinion.content".padEnd(26)} ${String(scanned).padStart(6)} tarandı · ${String(changed).padStart(6)} ${APPLY ? "şifrelendi" : "şifrelenecek"}`);
    total += changed;
  }

  if (APPLY) {
    console.log(`\n✅ Backfill tamam — toplam ${total} kolon-değeri şifrelendi. (Tekrar çalıştırılırsa 0 olmalı.)`);
  } else {
    console.log(`\n🔍 DRY-RUN bitti — ${total} kolon-değeri şifrelenecekti. HİÇBİR ŞEY YAZILMADI.`);
    if (total > 0) console.log("   Gerçekten uygulamak için: --apply (geri dönüşü YOKTUR)");
  }
}

main()
  .catch((e) => {
    console.error("❌ Backfill hatası:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
