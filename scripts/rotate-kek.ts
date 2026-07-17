// KEK ROTASYONU — at-rest envelope sarımlarını eski KEK'ten yeni KEK'e taşır (gate 4, 2026-07-17).
// İçerik HİÇ ÇÖZÜLMEZ: yalnız DEK sarımı değişir (lib/crypto rewrapEnvelope; iv/tag/ct aynen kalır).
//
// Kapsam (encrypt-existing.ts envanteriyle birebir — yeni şifreli kolon eklenirse İKİSİNE de ekle):
//   CaseDocument.content · Signal.data · Consultation.notes · SecondOpinionDocument.fileRef ·
//   Case.{patientName,patientIdentifier,symptoms,reasoning,extra,dischargeReport,dischargeStructured} ·
//   CheckIn.{note,photo} · SecondOpinion.{content,structured}
//
// Satır sınıflandırması (hiçbir değer köröğüne yazılmaz):
//   enc:v1: + eski KEK açıyor  → REWRAP (yalnız --apply ile yazılır)
//   enc:v1: + yeni KEK açıyor  → ALREADY (önceki yarım koşudan — idempotent devam)
//   enc:v1: + ikisi de açmıyor → FOREIGN (başka ortamın anahtarı / bozuk) → DOKUNMA + sonda exit 1
//   blob:v1:                   → BLOB (yalnız --blobs ile işlenir; sayısı her koşuda raporlanır)
//   düz/boş/null               → PLAIN (kapsam dışı — kademeli geçiş satırları)
//
// KULLANIM (dry-run varsayılan; hiçbir şey yazmaz):
//   $env:ROTATE_NEW_KEK = "<base64 32B>"; npx tsx scripts/rotate-kek.ts
//   ... --apply          → DB alanlarını yeniden sarar
//   ... --apply --blobs  → blob:v1: belgeleri de döndürür (indir→rewrap→yeni blob→ref güncelle→eskiyi sil)
//   ROTATE_OLD_KEK verilmezse mevcut DATA_ENCRYPTION_KEK eski anahtar sayılır.
//
// ⚠️ ÜRETİM KORUMASI: DATABASE_URL, PROD_DB_FINGERPRINT'i içeriyorsa ALLOW_PROD_KEK_ROTATION=1
//   olmadan ÇALIŞMAZ (scriptler kendi PrismaClient'ını kurar → db.ts guard'ı buradan geçmez;
//   koruma bilinçli olarak script içinde tekrarlanır). Prod rotasyonu runbook'u: vault
//   wiki/yonetisim/sir-envanteri.md §3 (özet: uygulamayı yeni KEK'e geçirmeden script bitmeli;
//   pencere boyunca eski KEK'le yazan instance'lar kalabilir → script SONDA ikinci tur ister).
// ⚠️ --blobs + ortak tedarikçi token'ı: Blob store ortamlar arası ORTAK olabilir (Ray B2 açık notu)
//   → dev provasında --blobs KULLANMA (dev seed'inde blob ref yoktur; sayaç 0 doğrular).
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { isEncrypted, kekFromBase64, rewrapEnvelope } from "../src/lib/crypto";
import { isBlobRef } from "../src/lib/storage";

const APPLY = process.argv.includes("--apply");
const DO_BLOBS = process.argv.includes("--blobs");

const oldRaw = process.env.ROTATE_OLD_KEK || process.env.DATA_ENCRYPTION_KEK;
const newRaw = process.env.ROTATE_NEW_KEK;
if (!oldRaw || !newRaw) {
  console.error("✋ ROTATE_NEW_KEK zorunlu (base64 32B); eski anahtar = ROTATE_OLD_KEK veya DATA_ENCRYPTION_KEK.");
  process.exit(1);
}
const OLD_KEK = kekFromBase64(oldRaw);
const NEW_KEK = kekFromBase64(newRaw);
if (OLD_KEK.equals(NEW_KEK)) {
  console.error("✋ Eski ve yeni KEK aynı — rotasyon anlamsız.");
  process.exit(1);
}

// Üretim korkuluğu (db.ts guard'ının script eşleniği).
const fp = process.env.PROD_DB_FINGERPRINT;
if (fp && (process.env.DATABASE_URL ?? "").includes(fp) && process.env.ALLOW_PROD_KEK_ROTATION !== "1") {
  console.error("⛔ DATABASE_URL üretim parmak izini içeriyor. Prod KEK rotasyonu yalnız runbook'la ve");
  console.error("   ALLOW_PROD_KEK_ROTATION=1 AÇIKÇA verilerek koşulur (vault sir-envanteri §3).");
  process.exit(1);
}

const db = new PrismaClient();

type Cls = "rewrap" | "already" | "foreign" | "blob" | "plain";
const totals: Record<Cls, number> = { rewrap: 0, already: 0, foreign: 0, blob: 0, plain: 0 };
const foreignSamples: string[] = [];

function classify(value: string | null, where: string): { cls: Cls; next?: string } {
  if (value == null || value === "") return { cls: "plain" };
  if (isBlobRef(value)) return { cls: "blob" };
  if (!isEncrypted(value)) return { cls: "plain" };
  try {
    return { cls: "rewrap", next: rewrapEnvelope(value, OLD_KEK, NEW_KEK) };
  } catch {
    try {
      rewrapEnvelope(value, NEW_KEK, NEW_KEK); // yeni KEK açabiliyor mu? (no-op rewrap = açılış testi)
      return { cls: "already" };
    } catch {
      if (foreignSamples.length < 5) foreignSamples.push(where);
      return { cls: "foreign" };
    }
  }
}

// Tek-kolon cursor-yürüyüşü (encrypt-existing.ts deseni).
async function walk<ID extends string | number>(
  label: string,
  batch: number,
  page: (cursor: ID | null) => Promise<{ id: ID; value: string | null }[]>,
  save: (id: ID, value: string) => Promise<unknown>,
): Promise<void> {
  let cursor: ID | null = null;
  const local: Record<Cls, number> = { rewrap: 0, already: 0, foreign: 0, blob: 0, plain: 0 };
  for (;;) {
    const rows = await page(cursor);
    if (rows.length === 0) break;
    for (const r of rows) {
      const c = classify(r.value, `${label}#${r.id}`);
      local[c.cls]++;
      totals[c.cls]++;
      if (c.cls === "rewrap" && APPLY) await save(r.id, c.next!);
      if (c.cls === "blob" && APPLY && DO_BLOBS) await rotateBlob(label, r.id, r.value!, save);
    }
    cursor = rows[rows.length - 1].id;
    if (rows.length < batch) break;
  }
  console.log(
    `  ${label.padEnd(30)} rewrap:${String(local.rewrap).padStart(5)}  already:${String(local.already).padStart(4)}  ` +
    `blob:${String(local.blob).padStart(4)}  plain:${String(local.plain).padStart(5)}  foreign:${String(local.foreign).padStart(3)}`,
  );
}

// Blob rotasyonu: ciphertext string'i indir → rewrap → YENİ blob'a koy → ref'i güncelle → eskiyi sil.
// (put addRandomSuffix ile yeni URL üretir; ad-versiyonlama ilkesiyle uyumlu — eski URL cache'i ölür.)
async function rotateBlob<ID extends string | number>(
  label: string,
  id: ID,
  ref: string,
  save: (id: ID, value: string) => Promise<unknown>,
): Promise<void> {
  const url = ref.slice("blob:v1:".length);
  const { put, del } = await import("@vercel/blob");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` } });
  if (!res.ok) throw new Error(`${label}#${id}: blob indirilemedi (${res.status})`);
  const cipher = await res.text();
  if (!isEncrypted(cipher)) throw new Error(`${label}#${id}: blob içeriği envelope değil — dokunulmadı`);
  const rewrapped = rewrapEnvelope(cipher, OLD_KEK, NEW_KEK);
  const putRes = await put(`rotate/${String(id)}`, rewrapped, {
    access: process.env.BLOB_ACCESS === "public" ? "public" : "private",
    contentType: "application/octet-stream",
    addRandomSuffix: true,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  await save(id, `blob:v1:${putRes.url}`);
  await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN }).catch(() => {
    console.warn(`  ⚠ ${label}#${id}: eski blob silinemedi (ref güncellendi; artık erişilmez ama depoda kaldı)`);
  });
}

async function main() {
  console.log(`🔁 KEK rotasyonu — mod: ${APPLY ? "APPLY (yazar)" : "DRY-RUN (yazmaz)"}${DO_BLOBS ? " + blobs" : ""}\n`);

  await walk<string>("CaseDocument.content", 50,
    (cur) => db.caseDocument.findMany({ where: { content: { not: null } }, select: { id: true, content: true }, orderBy: { id: "asc" }, take: 50, ...(cur ? { skip: 1, cursor: { id: cur } } : {}) }).then((r) => r.map((x) => ({ id: x.id, value: x.content }))),
    (id, value) => db.caseDocument.update({ where: { id }, data: { content: value } }));

  await walk<number>("Signal.data", 500,
    (cur) => db.signal.findMany({ select: { id: true, data: true }, orderBy: { id: "asc" }, take: 500, ...(cur ? { skip: 1, cursor: { id: cur } } : {}) }).then((r) => r.map((x) => ({ id: x.id, value: x.data }))),
    (id, value) => db.signal.update({ where: { id }, data: { data: value } }));

  await walk<string>("Consultation.notes", 500,
    (cur) => db.consultation.findMany({ select: { id: true, notes: true }, orderBy: { id: "asc" }, take: 500, ...(cur ? { skip: 1, cursor: { id: cur } } : {}) }).then((r) => r.map((x) => ({ id: x.id, value: x.notes }))),
    (id, value) => db.consultation.update({ where: { id }, data: { notes: value } }));

  await walk<string>("SecondOpinionDocument.fileRef", 50,
    (cur) => db.secondOpinionDocument.findMany({ where: { fileRef: { not: null } }, select: { id: true, fileRef: true }, orderBy: { id: "asc" }, take: 50, ...(cur ? { skip: 1, cursor: { id: cur } } : {}) }).then((r) => r.map((x) => ({ id: x.id, value: x.fileRef }))),
    (id, value) => db.secondOpinionDocument.update({ where: { id }, data: { fileRef: value } }));

  // Çok kolonlu tablolar: tablo başına TEK tarama (encrypt-existing deseni; hesaplanmış [col]
  // select'i Prisma tip çıkarımını bozuyor → kolonlar açık yazılır, sınıflandırma kolon-etiketli).
  {
    let cursor = "";
    for (;;) {
      const rows = await db.case.findMany({
        where: { id: { gt: cursor } },
        select: { id: true, patientName: true, patientIdentifier: true, symptoms: true, reasoning: true, extra: true, dischargeReport: true, dischargeStructured: true },
        orderBy: { id: "asc" }, take: 200,
      });
      if (rows.length === 0) break;
      for (const r of rows) {
        const data: Record<string, string> = {};
        for (const [col, val] of Object.entries(r)) {
          if (col === "id") continue;
          const c = classify(val, `Case.${col}#${r.id}`);
          totals[c.cls]++;
          if (c.cls === "rewrap" && APPLY) data[col] = c.next!;
        }
        if (Object.keys(data).length) await db.case.update({ where: { id: r.id }, data });
      }
      cursor = rows[rows.length - 1].id;
      if (rows.length < 200) break;
    }
    console.log("  Case (7 kolon, tek tarama)    tamam");
  }
  {
    let cursor = "";
    for (;;) {
      const rows = await db.checkIn.findMany({
        where: { id: { gt: cursor } },
        select: { id: true, note: true, photo: true },
        orderBy: { id: "asc" }, take: 200,
      });
      if (rows.length === 0) break;
      for (const r of rows) {
        const data: Record<string, string> = {};
        for (const [col, val] of Object.entries(r)) {
          if (col === "id") continue;
          const c = classify(val, `CheckIn.${col}#${r.id}`);
          totals[c.cls]++;
          if (c.cls === "rewrap" && APPLY) data[col] = c.next!;
        }
        if (Object.keys(data).length) await db.checkIn.update({ where: { id: r.id }, data });
      }
      cursor = rows[rows.length - 1].id;
      if (rows.length < 200) break;
    }
    console.log("  CheckIn (2 kolon, tek tarama) tamam");
  }
  {
    let cursor = "";
    for (;;) {
      const rows = await db.secondOpinion.findMany({
        where: { id: { gt: cursor } },
        select: { id: true, content: true, structured: true },
        orderBy: { id: "asc" }, take: 200,
      });
      if (rows.length === 0) break;
      for (const r of rows) {
        const data: Record<string, string> = {};
        for (const [col, val] of Object.entries(r)) {
          if (col === "id") continue;
          const c = classify(val, `SecondOpinion.${col}#${r.id}`);
          totals[c.cls]++;
          if (c.cls === "rewrap" && APPLY) data[col] = c.next!;
        }
        if (Object.keys(data).length) await db.secondOpinion.update({ where: { id: r.id }, data });
      }
      cursor = rows[rows.length - 1].id;
      if (rows.length < 200) break;
    }
    console.log("  SecondOpinion (2 kolon)       tamam");
  }

  console.log(`\nTOPLAM  rewrap:${totals.rewrap}  already:${totals.already}  blob:${totals.blob}  plain:${totals.plain}  foreign:${totals.foreign}`);
  if (totals.blob > 0 && !DO_BLOBS) console.log(`ℹ ${totals.blob} blob ref'i işlenmedi (--blobs bayrağı yok) — prod rotasyonunda unutma.`);
  if (totals.foreign > 0) {
    console.error(`\n⛔ ${totals.foreign} FOREIGN satır (ne eski ne yeni KEK açıyor) — DOKUNULMADI. Örnekler: ${foreignSamples.join(" · ")}`);
    console.error("   Olası neden: başka ortamın anahtarıyla yazılmış satır / bozuk veri. Araştırmadan rotasyonu bitmiş sayma.");
    process.exitCode = 1;
  }
  if (!APPLY && totals.rewrap > 0) console.log("\nDRY-RUN bitti — yazmak için --apply.");
  if (APPLY) console.log("\n✅ APPLY bitti. Uygulama env'ini (DATA_ENCRYPTION_KEK) YENİ anahtara geçirmeyi ve pencere sırasında");
  if (APPLY) console.log("   eski KEK'le yazılmış olabilecek satırlar için scripti BİR KEZ DAHA (already ağırlıklı) koşmayı unutma.");
}

main()
  .catch((e) => { console.error("❌ Rotasyon hatası:", e); process.exit(1); })
  .finally(() => db.$disconnect());
