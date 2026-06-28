// M5 — Mevcut demo hekimlere zorunlu mesleki belge (Tıp Diploması + MMSS) + MMSS metadata + aktivasyon
// damgası ekler (additive, idempotent). YALNIZCA eksik olanı doldurur; HİÇBİR ŞEY SİLMEZ → re-run = 0.
// Belge içeriği at-rest şifreli (encryptField). Teminat limiti deterministik 3 kademe (düşük/orta/yüksek)
// → M3 Katman 3 malpraktis ek-priminin her iki kolu (ek prim >0 ve =0) canlıda görünür.
// Çalıştır: npx tsx scripts/backfill-doctor-docs.ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { encryptField } from "../src/lib/crypto";

const db = new PrismaClient();

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}

// MMSS teminat kademeleri (₺) — gerçekçi aralık. Canlı kur ~40 → ≈ $6.25K / $18.75K / $50K.
// Düşük → çoğu operasyonda boşluk var (ek prim > 0); yüksek → boşluk yok (ek prim = 0).
const LIMITS_TRY = [250_000, 750_000, 2_000_000];
const INSURERS = ["Allianz", "Axa Sigorta", "Quick Sigorta", "Anadolu Sigorta", "Mapfre"];

// Demo belge içeriği (gerçek dosya değil) — küçük data URI.
function demoDoc(kind: string, name: string): string {
  const text = `${kind} — Dr. ${name}\nDemo belge (gerçek dosya değildir).`;
  return `data:application/pdf;base64,${Buffer.from(text, "utf8").toString("base64")}`;
}

async function main() {
  const doctors = await db.doctor.findMany({
    select: { id: true, name: true, mmssInsurer: true, mmssPolicyNo: true, mmssCoverageLimit: true, activatedAt: true, documents: { select: { type: true } } },
  });
  console.log(`Hekim sayısı: ${doctors.length}`);
  let docsAdded = 0, mmssSet = 0, activated = 0;

  for (const d of doctors) {
    const types = new Set(d.documents.map((x) => x.type));

    if (!types.has("DIPLOMA")) {
      await db.doctorDocument.create({
        data: { doctorId: d.id, type: "DIPLOMA", label: "Tıp Diploması (demo).pdf", mimeType: "application/pdf", content: encryptField(demoDoc("Tıp Diploması", d.name)) },
      });
      docsAdded++;
    }
    if (!types.has("MMSS")) {
      await db.doctorDocument.create({
        data: { doctorId: d.id, type: "MMSS", label: "MMSS Poliçesi (demo).pdf", mimeType: "application/pdf", content: encryptField(demoDoc("MMSS Poliçesi", d.name)) },
      });
      docsAdded++;
    }

    if (!d.mmssCoverageLimit) {
      const limit = LIMITS_TRY[hash(d.id) % LIMITS_TRY.length];
      await db.doctor.update({
        where: { id: d.id },
        data: {
          mmssInsurer: d.mmssInsurer ?? INSURERS[hash(d.id + "ins") % INSURERS.length],
          mmssPolicyNo: d.mmssPolicyNo ?? encryptField(`MMSS-${100000 + (hash(d.id) % 900000)}`),
          mmssCoverageLimit: limit,
          mmssCoverageCurrency: "TRY",
          mmssValidUntil: new Date(Date.now() + 365 * 24 * 3600 * 1000),
        },
      });
      mmssSet++;
    }

    // Bu noktada diploma + MMSS + teminat limiti garanti → aktivasyon damgası (yoksa).
    if (!d.activatedAt) {
      await db.doctor.update({ where: { id: d.id }, data: { activatedAt: new Date() } });
      activated++;
    }
  }

  console.log(`Belge eklenen: ${docsAdded} · MMSS metadata set: ${mmssSet} · aktive edilen: ${activated}. (re-run → 0)`);
}

main().then(() => db.$disconnect()).catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
