// Birim testleri — burned-in (piksele işlenmiş) PHI temizliği (v6.37).
// lib/dicom-pixels (decode/mask/yeniden yazma/önizleme) + lib/dicom-burnin (otomatik kurallar) +
// lib/dicom-deidentify.deidentifyDicomFull (piksel + etiket katmanlarının birleşimi).
//
// Fixture'lar GERÇEK dosyalardır: public/dicom/test-burnin-*.dcm (scripts/make-burnin-dicoms.py ile
// üretilir; yazı pikselleri MAXV=4000 değerinde basılıdır → "maske sonrası parlak piksel kalmadı"
// ölçülebilir). Sıkıştırılmış codec varyantları da (RLE/JPEG/JPEG-LS/J2K) aynı motordan geçirilir.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import dcmjs from "dcmjs";
import { decodePixels, maskFrames, writeUncompressed, renderPreviewPng, TS_EXPLICIT_LE } from "@/lib/dicom-pixels";
import { analyzeBurnIn, normalizeRects } from "@/lib/dicom-burnin";
import { deidentifyDicomFull } from "@/lib/dicom-deidentify";

const DIR = join(process.cwd(), "public", "dicom");
const MAXV = 4000; // make-burnin-dicoms.py yazı parlaklığı
const BAND_PX = 26; // US arayüz şeridi (px) — fixture ile aynı

function read(name: string): ArrayBuffer {
  const b = readFileSync(join(DIR, name));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
}
function toAb(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
}

/** Belirli piksel penceresindeki en parlak değer (maske kanıtı için). */
function maxIn(frame: ArrayLike<number>, cols: number, x0: number, y0: number, x1: number, y1: number): number {
  let m = -Infinity;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m = Math.max(m, frame[y * cols + x]);
  return m;
}

describe("decodePixels — tüm desteklenen transfer syntax'lar", () => {
  const files = [
    ["toraks-bt.dcm", "sıkıştırmasız LE"],
    ["test-rle.dcm", "RLE"],
    ["test-jpeg-baseline.dcm", "JPEG Baseline (jpeg-js)"],
    ["test-jpeg-lossless.dcm", "JPEG Lossless"],
    ["test-jpegls.dcm", "JPEG-LS (CharLS WASM)"],
    ["test-jpeg2000.dcm", "JPEG 2000 (OpenJPEG WASM)"],
  ] as const;

  for (const [file, label] of files) {
    it(`${label}: kareler sunucuda çözülür`, async () => {
      const dec = await decodePixels(read(file));
      expect(dec.info.rows).toBeGreaterThan(0);
      expect(dec.frames.length).toBe(dec.info.frames);
      expect(dec.frames[0].length).toBe(dec.info.rows * dec.info.cols * (dec.info.samples === 3 ? 3 : 1));
    });
  }
});

describe("analyzeBurnIn — otomatik kurallar", () => {
  it("US + SequenceOfUltrasoundRegions: görüntü alanı dışı maskelenir", () => {
    const a = analyzeBurnIn(read("test-burnin-us-regions.dcm"));
    expect(a.modality).toBe("US");
    expect(a.declaredBurnedIn).toBe(true);
    expect(a.autoRects.length).toBeGreaterThan(0);
    // Üst şerit (0 → BAND_PX) tamamen kapsanmalı.
    const top = a.autoRects.find((r) => r.y === 0 && r.w === 1);
    expect(top).toBeDefined();
    expect(top!.h * a.rows).toBeGreaterThanOrEqual(BAND_PX);
  });

  it("US sekanssız: üst bilgi şeridi kuralı devreye girer", () => {
    const a = analyzeBurnIn(read("test-burnin-us-plain.dcm"));
    expect(a.autoRects.length).toBe(1);
    expect(a.autoRects[0].h * a.rows).toBeGreaterThanOrEqual(BAND_PX);
  });

  it("CT köşe yazısı: otomatik kural YOKTUR (yanlış-pozitif üretmez) — insan kutusu şart", () => {
    const a = analyzeBurnIn(read("test-burnin-ct-corner.dcm"));
    expect(a.modality).toBe("CT");
    expect(a.autoRects).toHaveLength(0);
    expect(a.declaredBurnedIn).toBe(true); // etiket bildiriyor → arayüz uyarısı buradan çıkar
    expect(a.notes.join(" ")).toMatch(/kendi etiketinde bildiriyor/);
  });

  it("bozuk girdi analiz katmanını çökertmez", () => {
    const a = analyzeBurnIn(new Uint8Array([1, 2, 3, 4]).buffer);
    expect(a.autoRects).toHaveLength(0);
    expect(a.rows).toBe(0);
  });
});

describe("normalizeRects — istemciden gelen kutular", () => {
  it("aralık dışı değerleri kırpar, çöpü eler", () => {
    const r = normalizeRects([
      { x: -1, y: 0.5, w: 5, h: 0.2 }, // kırpılır
      { x: 0.9, y: 0.9, w: 0.0001, h: 0.5 }, // çok ince → elenir
      { x: "a", y: 1, w: 1, h: 1 }, // sayı değil → elenir
      null,
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]).toEqual({ x: 0, y: 0.5, w: 1, h: 0.2 });
  });

  it("kutu sayısını sınırlar", () => {
    const many = Array.from({ length: 100 }, () => ({ x: 0, y: 0, w: 0.5, h: 0.5 }));
    expect(normalizeRects(many).length).toBeLessThanOrEqual(40);
  });
});

describe("deidentifyDicomFull — piksel + etiket birlikte", () => {
  it("US: otomatik kural burned-in yazıyı GERÇEKTEN siler (tüm karelerde)", async () => {
    const input = read("test-burnin-us-regions.dcm");
    const before = await decodePixels(input);
    expect(maxIn(before.frames[0], before.info.cols, 0, 0, before.info.cols, BAND_PX)).toBe(MAXV);

    const res = await deidentifyDicomFull(input);
    expect(res.masksApplied).toBeGreaterThan(0);
    expect(res.recompressed).toBe(true);

    const after = await decodePixels(toAb(res.bytes));
    expect(after.frames.length).toBe(before.frames.length);
    for (const f of after.frames) {
      expect(maxIn(f, after.info.cols, 0, 0, after.info.cols, BAND_PX)).toBe(0);
    }
    // Şerit ALTINDAKİ klinik alan korunur (maske taşmadı).
    expect(maxIn(after.frames[0], after.info.cols, 0, BAND_PX + 4, after.info.cols, after.info.rows)).toBeGreaterThan(0);
  });

  it("US sekanssız: üst bant kuralı yazıyı siler", async () => {
    const res = await deidentifyDicomFull(read("test-burnin-us-plain.dcm"));
    const after = await decodePixels(toAb(res.bytes));
    expect(maxIn(after.frames[0], after.info.cols, 0, 0, after.info.cols, BAND_PX)).toBe(0);
  });

  it("CT köşe yazısı: kutu VERİLMEZSE yazı DURUR (sessiz sahte güvenlik yok)", async () => {
    const res = await deidentifyDicomFull(read("test-burnin-ct-corner.dcm"));
    expect(res.masksApplied).toBe(0);
    expect(res.recompressed).toBe(false);
    const after = await decodePixels(toAb(res.bytes));
    expect(maxIn(after.frames[0], after.info.cols, 140, 225, 256, 256)).toBe(MAXV);
  });

  it("CT köşe yazısı: kullanıcı kutusu verilince silinir", async () => {
    const res = await deidentifyDicomFull(read("test-burnin-ct-corner.dcm"), new Map(), {
      userRects: [{ x: 0.5, y: 0.85, w: 0.5, h: 0.15 }],
    });
    expect(res.masksApplied).toBe(1);
    const after = await decodePixels(toAb(res.bytes));
    for (const f of after.frames) {
      expect(maxIn(f, after.info.cols, 140, 225, 256, 256)).toBe(0);
    }
  });

  it("maskelenen dosya geçerli DICOM kalır: TS sıkıştırmasız, PHI etiketleri sıyrık, beyan yazılı", async () => {
    const res = await deidentifyDicomFull(read("test-burnin-us-regions.dcm"));
    const ds = dcmjs.data.DicomMessage.readFile(toAb(res.bytes));
    expect(ds.meta["00020010"]?.Value?.[0]).toBe(TS_EXPLICIT_LE);
    expect(ds.dict["00120062"]?.Value?.[0]).toBe("YES"); // PatientIdentityRemoved
    expect(String(ds.dict["00120063"]?.Value?.[0])).toMatch(/pixel masks/);
    expect(String(ds.dict["00100020"]?.Value?.[0] ?? "")).toBe(""); // PatientID içeriği boş
    const pn = ds.dict["00100010"]?.Value?.[0] as { Alphabetic?: string };
    expect(pn.Alphabetic ?? pn).toBe("ANONIM");
  });

  it("maske uygulanmayan dosyada beyan 'uygulanmadi' der (dürüst metin)", async () => {
    const res = await deidentifyDicomFull(read("test-burnin-ct-corner.dcm"));
    const ds = dcmjs.data.DicomMessage.readFile(toAb(res.bytes));
    expect(String(ds.dict["00120063"]?.Value?.[0])).toMatch(/no pixel mask/);
  });

  it("sıkıştırılmış (JPEG-LS) dosyada maskeleme: çıktı sıkıştırmasız ve maske gerçekten uygulanmış", async () => {
    const input = read("test-jpegls.dcm");
    const res = await deidentifyDicomFull(input, new Map(), { userRects: [{ x: 0, y: 0, w: 1, h: 0.2 }] });
    expect(res.recompressed).toBe(true);
    const after = await decodePixels(toAb(res.bytes));
    expect(after.info.ts).toBe(TS_EXPLICIT_LE);
    expect(maxIn(after.frames[0], after.info.cols, 0, 0, after.info.cols, Math.floor(after.info.rows * 0.2))).toBe(0);
    // Maskesiz alan korunmuş (tüm görüntü silinmedi).
    expect(maxIn(after.frames[0], after.info.cols, 0, Math.ceil(after.info.rows * 0.25), after.info.cols, after.info.rows)).toBeGreaterThan(0);
  });

  it("çözülemeyen dosya + kutu = FAIL-CLOSED (hiç çıktı üretilmez)", async () => {
    await expect(
      deidentifyDicomFull(new Uint8Array(64).buffer, new Map(), { userRects: [{ x: 0, y: 0, w: 1, h: 0.2 }] }),
    ).rejects.toThrow();
  });
});

describe("renderPreviewPng — editör önizlemesi", () => {
  it("geçerli PNG üretir ve uzun kenarı sınırlar", async () => {
    const dec = await decodePixels(read("test-burnin-us-regions.dcm"));
    const p = renderPreviewPng(dec, 0, 128);
    expect(Math.max(p.width, p.height)).toBeLessThanOrEqual(128);
    expect([...p.png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(String.fromCharCode(...p.png.subarray(12, 16))).toBe("IHDR");
  });

  it("maskeleme öncesi/sonrası önizleme farklıdır (kutu görsel olarak da uygulanır)", async () => {
    const dec = await decodePixels(read("test-burnin-us-regions.dcm"));
    const a = renderPreviewPng(dec, 0, 128).png;
    maskFrames(dec, [{ x: 0, y: 0, w: 1, h: 0.2 }]);
    const b = renderPreviewPng(dec, 0, 128).png;
    expect(Buffer.compare(Buffer.from(a), Buffer.from(b))).not.toBe(0);
  });
});

describe("writeUncompressed — çok kareli bütünlük", () => {
  it("kare sayısı ve boyutlar korunur", async () => {
    const input = read("test-burnin-us-plain.dcm");
    const dec = await decodePixels(input);
    maskFrames(dec, [{ x: 0, y: 0, w: 1, h: 0.1 }]);
    const out = await decodePixels(toAb(writeUncompressed(input, dec)));
    expect(out.info.frames).toBe(dec.info.frames);
    expect(out.info.rows).toBe(dec.info.rows);
    expect(out.info.cols).toBe(dec.info.cols);
  });
});
