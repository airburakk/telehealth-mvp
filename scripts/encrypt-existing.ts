// EKLEMELİ at-rest şifreleme backfill — E2EE Faz 1 / increment 1 ([[hasta-verisi-uctan-uca-sifreleme]] §6.1).
// Mevcut DÜZ METİN klinik kolonlarını uygulama-katmanı envelope ile şifreler (lib/crypto.ts encryptField).
// Kapsanan kolonlar: CaseDocument.content (belge) · Signal.data (transkript+sinyal) · Consultation.notes (SOAP)
//   · Case.dischargeReport + Case.dischargeStructured (epikriz).
//
// İDEMPOTENT: zaten şifreli (enc:v1:) / boş ("") / null satırlar ATLANIR → tekrar çalıştırmak güvenli.
// HİÇBİR ŞEY SİLMEZ. Cursor sayfalama (büyük base64 belgeleri RAM'i doldurmaz).
//
// ⚠️ ÇALIŞTIRMADAN ÖNCE: DATA_ENCRYPTION_KEK .env'de ÜRETİMLE AYNI değer olmalı (yerel+üretim AYNI Neon DB!).
// ⚠️ KEK KAYBI = VERİ KAYBI. Anahtarı escrow/yedekle. Bu betik canlı veriyi geri-döndürülemez şifreler.
//
// Çalıştır: npx tsx scripts/encrypt-existing.ts
import { PrismaClient } from "@prisma/client";
import { encryptField, isEncrypted } from "../src/lib/crypto";

const db = new PrismaClient();

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
      await save(r.id, encryptField(r.value));
      changed++;
    }
    cursor = rows[rows.length - 1].id;
    if (rows.length < batch) break;
  }
  console.log(`  ${label.padEnd(26)} ${String(scanned).padStart(6)} tarandı · ${String(changed).padStart(6)} şifrelendi`);
  return changed;
}

async function main() {
  if (!process.env.DATA_ENCRYPTION_KEK) {
    console.error("✋ DATA_ENCRYPTION_KEK tanımsız. Bu betik canlı klinik veriyi şifreler; anahtarsız çalıştırmak anlamsız.");
    console.error("   Üret:  openssl rand -base64 32");
    console.error("   .env'e DATA_ENCRYPTION_KEK olarak ekle — ÜRETİMDEKİ (Vercel) ile AYNI değer olmalı (aynı Neon DB!).");
    process.exit(1);
  }

  console.log("🔐 E2EE Faz 1 backfill — increment 1 kolonları (idempotent; boş/şifreli satırlar atlanır)\n");
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

  // Case.dischargeReport + dischargeStructured — epikriz (iki kolon, tek satır)
  {
    let cursor = ""; // id { gt } sayfalama (cuid leksikografik sıralı) → koşullu cursor-spread'siz, temiz tip çıkarımı
    let scanned = 0;
    let changed = 0;
    for (;;) {
      const rows = await db.case.findMany({
        where: { id: { gt: cursor }, OR: [{ dischargeReport: { not: null } }, { dischargeStructured: { not: null } }] },
        select: { id: true, dischargeReport: true, dischargeStructured: true },
        orderBy: { id: "asc" }, take: 200,
      });
      if (rows.length === 0) break;
      for (const r of rows) {
        scanned++;
        const data: { dischargeReport?: string; dischargeStructured?: string } = {};
        if (needsEnc(r.dischargeReport)) data.dischargeReport = encryptField(r.dischargeReport);
        if (needsEnc(r.dischargeStructured)) data.dischargeStructured = encryptField(r.dischargeStructured);
        if (Object.keys(data).length) {
          await db.case.update({ where: { id: r.id }, data });
          changed++;
        }
      }
      cursor = rows[rows.length - 1].id;
      if (rows.length < 200) break;
    }
    console.log(`  ${"Case.discharge*".padEnd(26)} ${String(scanned).padStart(6)} tarandı · ${String(changed).padStart(6)} şifrelendi`);
    total += changed;
  }

  console.log(`\n✅ Backfill tamam — toplam ${total} kolon-değeri şifrelendi. (Tekrar çalıştırılırsa 0 olmalı.)`);
}

main()
  .catch((e) => {
    console.error("❌ Backfill hatası:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
