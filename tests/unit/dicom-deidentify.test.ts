// Birim testleri — lib/dicom-deidentify.ts (DICOM PHI tag-strip, v6.32). Gerçek demo .dcm
// dosyalarıyla koşar (public/dicom — sıkıştırmasız BT/MR + 5 sıkıştırılmış codec varyantı):
// strip SONRASI yasak etiketler dolu OLAMAZ + çıktı yeniden parse edilebilir + piksel verisi korunur.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import dcmjs from "dcmjs";
import { deidentifyDicom } from "@/lib/dicom-deidentify";

const DICOM_DIR = join(process.cwd(), "public", "dicom");
const FILES = readdirSync(DICOM_DIR).filter((f) => f.endsWith(".dcm"));

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

function readDemo(name: string): ArrayBuffer {
  return toArrayBuffer(readFileSync(join(DICOM_DIR, name)));
}

function firstVal(el: { Value?: unknown[] } | undefined): string {
  const v = el?.Value?.[0];
  if (v == null) return "";
  if (typeof v === "object" && v !== null && "Alphabetic" in (v as Record<string, unknown>)) {
    return String((v as Record<string, unknown>).Alphabetic ?? "");
  }
  return String(v);
}

// Strip sonrası bu etiketler ya YOK ya BOŞ olmalı (PatientName hariç — "ANONIM").
const MUST_BE_EMPTY = [
  "00100020", "00100030", "00101040", "00102154", // hasta ID / doğum / adres / telefon
  "00080090", "00081050", "00081070", // hekim/operatör adları
  "00080080", "00080081", "00081010", // kurum/istasyon
  "00080050", "00200010", "00181000", // accession / study id / cihaz seri
  "00080020", "00080030", // çekim tarih/saat
];

describe("deidentifyDicom — demo dosyaları", () => {
  it("tüm demo .dcm dosyaları bulunur (regresyon nöbeti)", () => {
    expect(FILES.length).toBeGreaterThanOrEqual(10);
  });

  for (const file of FILES) {
    it(`${file}: PHI etiketleri sıyrılır, çıktı geçerli DICOM kalır, piksel korunur`, () => {
      const input = readDemo(file);
      const before = dcmjs.data.DicomMessage.readFile(input);
      const pixelBefore = before.dict["7FE00010"]?.Value?.length ?? 0;

      const { bytes, summary } = deidentifyDicom(input);
      expect(bytes.byteLength).toBeGreaterThan(0);

      // Çıktı yeniden parse edilebilir (round-trip) — bozuk dosya üretmiyoruz.
      const after = dcmjs.data.DicomMessage.readFile(toArrayBuffer(Buffer.from(bytes)));

      // Hasta adı: kaynakta varsa artık ANONIM.
      if (before.dict["00100010"]) expect(firstVal(after.dict["00100010"])).toBe("ANONIM");

      // Yasak etiketler dolu olamaz.
      for (const tag of MUST_BE_EMPTY) {
        const el = after.dict[tag];
        if (el) expect(firstVal(el), `${file} ${tag} dolu kaldı`).toBe("");
      }

      // Private tag kalmadı (tek grup numarası).
      const privates = Object.keys(after.dict).filter((t) => parseInt(t.slice(0, 4), 16) % 2 === 1);
      expect(privates).toEqual([]);

      // UID'ler kaynaktakiyle AYNI OLAMAZ (kurum izi) — kaynakta doluysa.
      for (const tag of ["0020000D", "0020000E", "00080018"]) {
        const oldV = firstVal(before.dict[tag]);
        if (oldV) expect(firstVal(after.dict[tag])).not.toBe(oldV);
      }

      // Piksel verisi fragman sayısı korunur (içeriğe dokunmuyoruz; sıkıştırılmışlar opak kalır).
      const pixelAfter = after.dict["7FE00010"]?.Value?.length ?? 0;
      expect(pixelAfter).toBe(pixelBefore);

      // Klinik değer kalır: kaynakta PatientSex varsa çıktı da taşır.
      if (firstVal(before.dict["00100040"])) {
        expect(firstVal(after.dict["00100040"])).toBe(firstVal(before.dict["00100040"]));
      }

      expect(summary.uidsRegenerated).toBeGreaterThan(0);
    });
  }

  it("aynı uidMap ile eski→yeni UID eşlemesi deterministiktir (seri bütünlüğü)", () => {
    const input = readDemo(FILES[0]);
    const map = new Map<string, string>();
    const a = deidentifyDicom(input, map);
    const b = deidentifyDicom(readDemo(FILES[0]), map);
    const dictA = dcmjs.data.DicomMessage.readFile(toArrayBuffer(Buffer.from(a.bytes))).dict;
    const dictB = dcmjs.data.DicomMessage.readFile(toArrayBuffer(Buffer.from(b.bytes))).dict;
    expect(firstVal(dictA["0020000D"])).toBe(firstVal(dictB["0020000D"])); // aynı Study UID
  });

  it("bozuk girdi → throw (fail-closed: sıyrılamayan dosya saklanmaz)", () => {
    const junk = new TextEncoder().encode("bu bir dicom degil").buffer as ArrayBuffer;
    expect(() => deidentifyDicom(junk)).toThrow();
  });
});
