// T11 backfill — mevcut INLINE belge satırlarını (base64/enc: in-DB) object storage'a (Vercel Blob) taşır.
// Her satır: inline'ı çöz (loadDocument) → Blob'a şifreli yükle (storeDocument) → kolonu "blob:v1:<url>" ref'iyle güncelle.
//
// Kapsanan 4 alan: CaseDocument.content · DoctorDocument.content · ConsultationRequestDocument.fileData ·
//                  SecondOpinionDocument.fileRef.
//
// İDEMPOTENT: zaten "blob:v1:" olan satırlar ATLANIR → tekrar çalıştırmak güvenli. HİÇBİR ŞEY SİLMEZ
//   (eski inline değer Blob'a kopyalanır, sonra kolon ref'le güncellenir; DB'deki base64 ref ile değişir).
// Cursor sayfalama (büyük base64 RAM'i doldurmaz). Hata veren satır atlanır + raporlanır (akış durmaz).
//
// ⚠️ ÖN-KOŞUL (ikisi de .env'de ÜRETİMLE AYNI olmalı — yerel+üretim AYNI Neon DB!):
//     BLOB_READ_WRITE_TOKEN  (Vercel Blob store token'ı)  ·  DATA_ENCRYPTION_KEK  (at-rest KEK).
// ⚠️ Bu betik CANLI veriyi değiştirir → yalnız kullanıcı onayıyla çalıştır.
//
// Çalıştır:  npx tsx scripts/migrate-docs-to-blob.ts --dry-run   (önce kuru çalışma)
//            npx tsx scripts/migrate-docs-to-blob.ts             (gerçek taşıma)
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { loadDocument, storeDocument, isBlobRef, blobStorageEnabled } from "../src/lib/storage";

const db = new PrismaClient();
const DRY = process.argv.includes("--dry-run");
const PAGE = 25; // büyük base64 → küçük sayfa

interface Row {
  id: string;
  value: string | null;
}

async function migrate(
  label: string,
  keyPrefix: string,
  page: (cursor: string | null) => Promise<Row[]>,
  save: (id: string, ref: string) => Promise<unknown>,
): Promise<void> {
  let cursor: string | null = null;
  let scanned = 0,
    migrated = 0,
    skipped = 0,
    failed = 0;
  for (;;) {
    const rows: Row[] = await page(cursor);
    if (!rows.length) break;
    for (const r of rows) {
      scanned++;
      if (!r.value || isBlobRef(r.value)) {
        skipped++;
        continue;
      }
      try {
        const dataUri = await loadDocument(r.value, { encrypt: true }); // inline çöz
        if (!dataUri) {
          skipped++;
          continue;
        }
        const ref = await storeDocument(dataUri, { encrypt: true, keyPrefix }); // Blob'a şifreli yükle
        if (!ref || !isBlobRef(ref)) {
          // Blob aktif değilse storeDocument inline döner → taşıma anlamsız; uyar ve dur.
          throw new Error("storeDocument Blob ref döndürmedi (BLOB_READ_WRITE_TOKEN aktif mi?).");
        }
        if (!DRY) await save(r.id, ref);
        migrated++;
      } catch (e) {
        failed++;
        console.warn(`  [${label}] ${r.id} taşınamadı:`, e instanceof Error ? e.message : e);
      }
    }
    cursor = rows[rows.length - 1].id;
    if (rows.length < PAGE) break;
  }
  console.log(`${label}: tarandı ${scanned} · taşındı ${migrated} · atlandı ${skipped} · hata ${failed}`);
}

async function main() {
  if (!blobStorageEnabled()) {
    console.error("✖ BLOB_READ_WRITE_TOKEN tanımsız — Blob aktif değil. Taşıma yapılamaz (önce Vercel Blob store + token).");
    process.exit(1);
  }
  if (!process.env.DATA_ENCRYPTION_KEK) {
    console.error("✖ DATA_ENCRYPTION_KEK tanımsız — şifreli alanlar çözülemez. Üretimle AYNI KEK gerekir.");
    process.exit(1);
  }
  console.log(DRY ? "— KURU ÇALIŞMA (yazma yok) —" : "— GERÇEK TAŞIMA (canlı veri güncellenir) —");

  await migrate(
    "CaseDocument.content",
    "case-doc",
    (c) =>
      db.caseDocument.findMany({
        where: { content: { not: null } },
        select: { id: true, content: true },
        orderBy: { id: "asc" },
        take: PAGE,
        ...(c ? { skip: 1, cursor: { id: c } } : {}),
      }).then((rs) => rs.map((r) => ({ id: r.id, value: r.content }))),
    (id, ref) => db.caseDocument.update({ where: { id }, data: { content: ref } }),
  );

  await migrate(
    "DoctorDocument.content",
    "doctor-doc",
    (c) =>
      db.doctorDocument.findMany({
        select: { id: true, content: true },
        orderBy: { id: "asc" },
        take: PAGE,
        ...(c ? { skip: 1, cursor: { id: c } } : {}),
      }).then((rs) => rs.map((r) => ({ id: r.id, value: r.content }))),
    (id, ref) => db.doctorDocument.update({ where: { id }, data: { content: ref } }),
  );

  await migrate(
    "ConsultationRequestDocument.fileData",
    "consult-doc",
    (c) =>
      db.consultationRequestDocument.findMany({
        select: { id: true, fileData: true },
        orderBy: { id: "asc" },
        take: PAGE,
        ...(c ? { skip: 1, cursor: { id: c } } : {}),
      }).then((rs) => rs.map((r) => ({ id: r.id, value: r.fileData }))),
    (id, ref) => db.consultationRequestDocument.update({ where: { id }, data: { fileData: ref } }),
  );

  await migrate(
    "SecondOpinionDocument.fileRef",
    "so-doc",
    (c) =>
      db.secondOpinionDocument.findMany({
        where: { fileRef: { not: null } },
        select: { id: true, fileRef: true },
        orderBy: { id: "asc" },
        take: PAGE,
        ...(c ? { skip: 1, cursor: { id: c } } : {}),
      }).then((rs) => rs.map((r) => ({ id: r.id, value: r.fileRef }))),
    (id, ref) => db.secondOpinionDocument.update({ where: { id }, data: { fileRef: ref } }),
  );

  console.log(DRY ? "\nKuru çalışma bitti (hiçbir şey yazılmadı)." : "\nTaşıma tamamlandı.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
