// DICOM piksel katmanı (v6.37) — burned-in (görüntünün İÇİNE işlenmiş) PHI temizliğinin motoru.
//
// NEDEN SUNUCUDA: tag-strip (lib/dicom-deidentify) kimlik ETİKETLERİNİ temizler ama cihazın piksellere
// bastığı ad/kurum/tarih yazısına dokunamaz. Maskeleme piksel düzeyinde decode gerektirir; codec'lerin
// TEK kopyası burada yaşar (tarayıcı yalnız PNG önizleme üstünde kutu çizer — client'a güven YOK,
// maskeyi daima sunucu uygular).
//
// KAPSAM: sıkıştırmasız (LE/BE implicit+explicit) · RLE · JPEG Baseline (jpeg-js) · JPEG Lossless
// (jpeg-lossless-decoder-js) · JPEG-LS (CharLS WASM) · JPEG 2000 (OpenJPEG WASM). Node'da hepsi
// doğrulandı (2026-07-28 probu). Desteklenmeyen tek transfer syntax: JPEG Genişletilmiş 12-bit (.51).
//
// ⚠️ MASKELENEN dosya DAİMA SIKIŞTIRMASIZ (Explicit VR LE) yazılır — yeniden sıkıştırma (encode)
// yapılmaz: kayıplı re-encode klinik veriyi bozar, kayıpsız encode'un doğrulama maliyeti yüksek.
// Boyut artışı yalnız HAVUZ kopyasındadır; vakadaki asıl dosya hiç dokunulmadan kalır.
// ⚠️ Kutu YOKSA bu modül hiç çalışmaz — dosya orijinal haliyle (sıkıştırılmış) geçer.
import dicomParser from "dicom-parser";
import dcmjs from "dcmjs";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// ── Transfer syntax'lar ──
const TS_IMPLICIT_LE = "1.2.840.10008.1.2";
export const TS_EXPLICIT_LE = "1.2.840.10008.1.2.1";
const TS_EXPLICIT_BE = "1.2.840.10008.1.2.2";
const TS_UNCOMPRESSED = new Set([TS_IMPLICIT_LE, TS_EXPLICIT_LE, TS_EXPLICIT_BE]);
const TS_RLE = "1.2.840.10008.1.2.5";
const TS_JPEG_BASELINE = "1.2.840.10008.1.2.4.50";
const TS_JPEG_LOSSLESS = new Set(["1.2.840.10008.1.2.4.57", "1.2.840.10008.1.2.4.70"]);
const TS_JPEGLS = new Set(["1.2.840.10008.1.2.4.80", "1.2.840.10008.1.2.4.81"]);
const TS_J2K = new Set(["1.2.840.10008.1.2.4.90", "1.2.840.10008.1.2.4.91"]);

// Kaynak tüketimi korkulukları: sıkıştırılmış küçük dosya açılınca çok büyüyebilir (kare × satır × sütun).
const MAX_PIXELS_TOTAL = 400_000_000; // ~400 MP toplam örnek (16-bit'te ~800 MB'ın üstüne çıkmaz)
const MAX_FRAMES = 600;

/** Normalize (0..1) dikdörtgen — görüntü boyutundan bağımsız; UI de bu birimde çalışır. */
export interface Rect { x: number; y: number; w: number; h: number }

export interface PixelInfo {
  rows: number;
  cols: number;
  samples: number; // 1 = mono, 3 = RGB
  bits: number; // 8 | 16
  signed: boolean;
  frames: number;
  photometric: string;
  ts: string;
  modality: string;
  /** Çözme sonrası photometric/samples değiştiyse (ör. YBR JPEG → RGB) yeniden yazarken kullanılır. */
  decodedPhotometric: string;
}

export interface DecodedPixels {
  info: PixelInfo;
  /** Kare başına HAM örnekler (rescale UYGULANMAZ — yeniden yazılacak veri budur). */
  frames: (Uint8Array | Uint16Array | Int16Array)[];
  /** Pencere değerleri (yalnız önizleme render'ı için). */
  wc: number;
  ww: number;
}

export class DicomPixelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DicomPixelError";
  }
}

function tagFloat(ds: dicomParser.DataSet, tag: string, dflt: number): number {
  try {
    const v = ds.floatString(tag);
    return v == null || Number.isNaN(v) ? dflt : v;
  } catch {
    return dflt;
  }
}

// ── WASM codec'ler (CharLS / OpenJPEG) — Node'da .wasm node_modules'ten yüklenir, modül cache'lenir ──
type CSFrameInfo = { width: number; height: number; bitsPerSample: number; componentCount: number; isSigned: boolean };
type CSDecoder = {
  getEncodedBuffer(size: number): Uint8Array;
  getDecodedBuffer(): Uint8Array;
  getFrameInfo(): CSFrameInfo;
  decode(): void;
  delete?(): void;
};
type CSModule = { J2KDecoder?: new () => CSDecoder; JpegLSDecoder?: new () => CSDecoder };
type CSFactory = (o: { wasmBinary?: Uint8Array; locateFile?: (p: string) => string }) => Promise<CSModule>;

// .wasm ikilisi Emscripten'e DOĞRUDAN verilir (wasmBinary) — locateFile/fetch yoluna hiç girilmez.
// Serverless'ta dosya yerleşimi ortama göre değiştiği için adaylar sırayla denenir; node_modules
// kopyaları next.config.ts `outputFileTracingIncludes` ile function bundle'ına dahil edilir.
function readWasm(pkg: string, file: string): Uint8Array {
  const candidates: string[] = [];
  try {
    candidates.push(require.resolve(`${pkg}/wasm`));
  } catch {
    /* paket exports haritası bu ortamda çözülemedi — aşağıdaki yollar denenir */
  }
  candidates.push(
    path.join(process.cwd(), "node_modules", ...pkg.split("/"), "dist", file),
    path.join(process.cwd(), "public", "wasm", file), // tarayıcı kopyası (yedek)
  );
  for (const c of candidates) {
    try {
      return new Uint8Array(fs.readFileSync(c));
    } catch {
      continue;
    }
  }
  throw new DicomPixelError(`Codec WASM bulunamadı (${file}).`);
}

// ⚠️ import() specifier'ı SABİT olmalı — template literal Turbopack'te "module not found" verir
// (2026-07-28 build'i bu şekilde kırıldı). Her codec için ayrı statik dal.
const CODECS = {
  charls: { pkg: "@cornerstonejs/codec-charls", wasm: "charlswasm.wasm" },
  openjpeg: { pkg: "@cornerstonejs/codec-openjpeg", wasm: "openjpegwasm.wasm" },
} as const;

const _codecCache = new Map<string, Promise<CSModule>>();
function codecModule(kind: keyof typeof CODECS): Promise<CSModule> {
  const hit = _codecCache.get(kind);
  if (hit) return hit;
  const { pkg, wasm } = CODECS[kind];
  const glue = kind === "charls"
    ? import("@cornerstonejs/codec-charls/wasmjs")
    : import("@cornerstonejs/codec-openjpeg/wasmjs");
  const p = glue.then((m) => {
    const factory = (m.default as unknown as CSFactory) ?? (m as unknown as CSFactory);
    return factory({ wasmBinary: readWasm(pkg, wasm) });
  });
  _codecCache.set(kind, p);
  return p;
}

// ── Çözücüler ──

// DICOM RLE (PackBits) tek byte düzlemi
function unpackBits(src: Uint8Array, start: number, end: number, out: Uint8Array): void {
  let o = 0;
  let i = start;
  while (i < end && o < out.length) {
    const n = (src[i++] << 24) >> 24; // işaretli int8
    if (n >= 0) {
      for (let k = 0; k <= n && i < end && o < out.length; k++) out[o++] = src[i++];
    } else if (n !== -128) {
      const v = src[i++];
      for (let k = 0; k < 1 - n && o < out.length; k++) out[o++] = v;
    }
  }
}

/** RLE karesi → ham örnekler (16-bit mono: byte düzlemi MSB→LSB · 8-bit mono · 8-bit RGB 3 segment). */
function decodeRLE(frame: Uint8Array, info: PixelInfo): Uint8Array | Uint16Array | Int16Array {
  const dv = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  const nSeg = dv.getUint32(0, true);
  const px = info.rows * info.cols;
  const bytesPer = info.bits === 8 ? 1 : 2;
  const comps = info.samples === 3 ? 3 : 1;
  const planes: Uint8Array[] = [];
  for (let s = 0; s < nSeg; s++) {
    const start = dv.getUint32(4 + s * 4, true);
    const next = s + 1 < nSeg ? dv.getUint32(4 + (s + 1) * 4, true) : frame.byteLength;
    const plane = new Uint8Array(px);
    unpackBits(frame, start, next, plane);
    planes.push(plane);
  }
  const out = allocSamples(px * comps, info);
  for (let c = 0; c < comps; c++) {
    for (let p = 0; p < px; p++) {
      let val = 0;
      for (let b = 0; b < bytesPer; b++) {
        const seg = c * bytesPer + b;
        val = (val << 8) | (planes[seg]?.[p] ?? 0);
      }
      if (comps === 1) {
        if (info.signed && bytesPer === 2 && val >= 32768) val -= 65536;
        out[p] = val;
      } else out[p * 3 + c] = val;
    }
  }
  return out;
}

function allocSamples(len: number, info: PixelInfo): Uint8Array | Uint16Array | Int16Array {
  if (info.bits === 8) return new Uint8Array(len);
  return info.signed ? new Int16Array(len) : new Uint16Array(len);
}

/** JPEG Baseline (8-bit) — jpeg-js (saf JS; Node'da createImageBitmap yok). */
async function decodeBaseline(frame: Uint8Array, info: PixelInfo): Promise<{ data: Uint8Array; samples: number }> {
  const jpeg = (await import("jpeg-js")).default;
  const img = jpeg.decode(frame, { useTArray: true }) as { width: number; height: number; data: Uint8Array };
  const px = info.rows * info.cols;
  const color = info.samples === 3;
  const out = new Uint8Array(color ? px * 3 : px);
  for (let p = 0; p < px; p++) {
    if (color) {
      out[p * 3] = img.data[p * 4];
      out[p * 3 + 1] = img.data[p * 4 + 1];
      out[p * 3 + 2] = img.data[p * 4 + 2];
    } else out[p] = img.data[p * 4]; // mono: R kanalı (jpeg-js RGBA döndürür)
  }
  return { data: out, samples: color ? 3 : 1 };
}

/** JPEG Lossless (.57/.70) — jpeg-lossless-decoder-js */
async function decodeLossless(frame: Uint8Array, info: PixelInfo): Promise<Uint8Array | Uint16Array | Int16Array> {
  const { Decoder } = await import("jpeg-lossless-decoder-js");
  const bytesPer = info.bits === 8 ? 1 : 2;
  const raw = new Decoder().decode(frame.buffer as ArrayBuffer, frame.byteOffset, frame.byteLength, bytesPer) as
    | Uint8Array
    | Uint16Array;
  const px = info.rows * info.cols;
  const out = allocSamples(px, info);
  for (let p = 0; p < px; p++) {
    let v = raw[p] ?? 0;
    if (info.signed && bytesPer === 2 && v >= 32768) v -= 65536;
    out[p] = v;
  }
  return out;
}

/** WASM codec çıktısı (ham byte) → tipli örnek dizisi */
function csSamples(bytes: Uint8Array, fi: CSFrameInfo, info: PixelInfo): { data: Uint8Array | Uint16Array | Int16Array; samples: number } {
  const px = info.rows * info.cols;
  const comps = fi.componentCount === 3 ? 3 : 1;
  const copy = bytes.slice(); // wasm heap'ten kopyala (decoder yeniden kullanılınca üzerine yazılır)
  const src: Uint8Array | Uint16Array | Int16Array =
    fi.bitsPerSample <= 8 ? copy : fi.isSigned ? new Int16Array(copy.buffer) : new Uint16Array(copy.buffer);
  const out = allocSamples(px * comps, info);
  for (let i = 0; i < out.length; i++) out[i] = src[i] ?? 0;
  return { data: out, samples: comps };
}

async function decodeWithCS(frame: Uint8Array, info: PixelInfo, dec: CSDecoder) {
  const enc = dec.getEncodedBuffer(frame.length);
  enc.set(frame);
  dec.decode();
  const res = csSamples(dec.getDecodedBuffer(), dec.getFrameInfo(), info);
  dec.delete?.();
  return res;
}

/**
 * DICOM dosyasının TÜM karelerini ham örnek dizilerine çözer.
 * Desteklenmeyen sıkıştırma / bozuk dosya → DicomPixelError (çağıran fail-closed davranır).
 */
export async function decodePixels(input: ArrayBuffer): Promise<DecodedPixels> {
  const byteArray = new Uint8Array(input);
  let ds: dicomParser.DataSet;
  try {
    ds = dicomParser.parseDicom(byteArray);
  } catch (e) {
    throw new DicomPixelError(`DICOM ayrıştırılamadı: ${e instanceof Error ? e.message : e}`);
  }
  const ts = (ds.string("x00020010") || TS_IMPLICIT_LE).trim();
  const encapsulated = !TS_UNCOMPRESSED.has(ts);
  const supported =
    !encapsulated || ts === TS_RLE || ts === TS_JPEG_BASELINE || TS_JPEG_LOSSLESS.has(ts) || TS_JPEGLS.has(ts) || TS_J2K.has(ts);
  if (!supported) throw new DicomPixelError(`Bu sıkıştırma (${ts}) piksel temizliği için desteklenmiyor.`);

  const px = ds.elements["x7fe00010"];
  if (!px) throw new DicomPixelError("Piksel verisi bulunamadı.");
  const bits = ds.uint16("x00280100") || 16;
  if (bits !== 8 && bits !== 16) throw new DicomPixelError(`Desteklenmeyen bit derinliği: ${bits}.`);
  const rows = ds.uint16("x00280010") || 0;
  const cols = ds.uint16("x00280011") || 0;
  if (!rows || !cols) throw new DicomPixelError("Görüntü boyutu okunamadı.");
  const nf = ds.intString("x00280008");
  const frames = typeof nf === "number" && nf > 0 ? nf : 1;
  if (frames > MAX_FRAMES) throw new DicomPixelError(`Kare sayısı çok yüksek (${frames}).`);
  if (rows * cols * frames > MAX_PIXELS_TOTAL) throw new DicomPixelError("Görüntü hacmi çok büyük.");

  const photometric = (ds.string("x00280004") || "MONOCHROME2").trim();
  const info: PixelInfo = {
    rows,
    cols,
    samples: ds.uint16("x00280002") || 1,
    bits,
    signed: (ds.uint16("x00280103") || 0) === 1,
    frames,
    photometric,
    decodedPhotometric: photometric,
    ts,
    modality: (ds.string("x00080060") || "").trim(),
  };

  const out: (Uint8Array | Uint16Array | Int16Array)[] = [];
  if (!encapsulated) {
    // Sıkıştırmasız: piksel bloğu doğrudan okunur. (Big Endian explicit → byte takası gerekir.)
    const count = rows * cols * info.samples;
    const bytesPer = bits / 8;
    for (let fr = 0; fr < frames; fr++) {
      const start = byteArray.byteOffset + px.dataOffset + fr * count * bytesPer;
      const end = start + count * bytesPer;
      if (end > byteArray.buffer.byteLength) throw new DicomPixelError("Piksel verisi eksik (dosya kırpılmış).");
      const buf = byteArray.buffer.slice(start, end);
      if (bits === 8) out.push(new Uint8Array(buf));
      else {
        if (ts === TS_EXPLICIT_BE) {
          const b = new Uint8Array(buf);
          for (let i = 0; i + 1 < b.length; i += 2) {
            const t = b[i];
            b[i] = b[i + 1];
            b[i + 1] = t;
          }
        }
        out.push(info.signed ? new Int16Array(buf) : new Uint16Array(buf));
      }
    }
  } else {
    for (let fr = 0; fr < frames; fr++) {
      let enc: Uint8Array;
      try {
        enc = dicomParser.readEncapsulatedImageFrame(ds, px, fr);
      } catch {
        const bot = dicomParser.createJPEGBasicOffsetTable(ds, px);
        enc = dicomParser.readEncapsulatedImageFrame(ds, px, fr, bot);
      }
      if (ts === TS_RLE) out.push(decodeRLE(enc, info));
      else if (ts === TS_JPEG_BASELINE) {
        const r = await decodeBaseline(enc, info);
        out.push(r.data);
        if (r.samples !== info.samples) {
          info.samples = r.samples;
          info.decodedPhotometric = r.samples === 3 ? "RGB" : "MONOCHROME2";
        } else if (info.photometric.startsWith("YBR")) {
          info.decodedPhotometric = r.samples === 3 ? "RGB" : "MONOCHROME2";
        }
      } else if (TS_JPEGLS.has(ts)) {
        const m = await codecModule("charls");
        if (!m.JpegLSDecoder) throw new DicomPixelError("JPEG-LS codec yüklenemedi.");
        const r = await decodeWithCS(enc, info, new m.JpegLSDecoder());
        out.push(r.data);
        info.samples = r.samples;
      } else if (TS_J2K.has(ts)) {
        const m = await codecModule("openjpeg");
        if (!m.J2KDecoder) throw new DicomPixelError("JPEG 2000 codec yüklenemedi.");
        const r = await decodeWithCS(enc, info, new m.J2KDecoder());
        out.push(r.data);
        info.samples = r.samples;
        if (info.photometric.startsWith("YBR")) info.decodedPhotometric = r.samples === 3 ? "RGB" : "MONOCHROME2";
      } else {
        out.push(await decodeLossless(enc, info));
      }
    }
  }

  return { info, frames: out, wc: tagFloat(ds, "x00281050", NaN), ww: tagFloat(ds, "x00281051", NaN) };
}

// ── Tarayıcı-güvenli sunum (CSP enforce, 2026-07-29) ──

/**
 * JPEG-LS dosyalarını tarayıcıya SIKIŞTIRMASIZ verir.
 *
 * NEDEN: JPEG-LS'i tarayıcıda çözen CharLS/WASM glue'su embind üzerinden `Function(...)` çağırır
 * (prod bundle'da doğrulandı) → CSP'de `'unsafe-eval'` gerektirir. XSS yüzeyini açmamak için bu
 * codec tarayıcıdan çıkarıldı: sunucu çözer, sıkıştırmasız Part-10 olarak sunar, DicomViewer
 * sıkıştırmasız yolu kullanır. JPEG 2000 (OpenJPEG) DOKUNULMADI — o glue kod üretmiyor
 * (`Function("return this")` yalnız globalThis polyfill'i, modern tarayıcıda kısa devre).
 *
 * Fail-open (bilinçli): çözülemezse ORİJİNAL bayt döner — bu bir gizlilik değil FORMAT dönüşümüdür;
 * de-identification kararları (fail-closed) lib/dicom-deidentify'da yaşar ve buradan bağımsızdır.
 */
export async function toViewerSafeDicom(
  input: ArrayBuffer,
): Promise<{ bytes: Uint8Array<ArrayBuffer>; converted: boolean }> {
  let ts = "";
  try {
    ts = (dicomParser.parseDicom(new Uint8Array(input), { untilTag: "x00020010" }).string("x00020010") || "").trim();
  } catch {
    return { bytes: new Uint8Array(input), converted: false };
  }
  if (!TS_JPEGLS.has(ts)) return { bytes: new Uint8Array(input), converted: false };
  try {
    const dec = await decodePixels(input);
    return { bytes: writeUncompressed(input, dec), converted: true };
  } catch (e) {
    console.warn("[dicom] JPEG-LS sunucu dönüşümü başarısız, orijinal sunuluyor:", e instanceof Error ? e.message : e);
    return { bytes: new Uint8Array(input), converted: false };
  }
}

// ── Maskeleme ──

/** Normalize kutuyu piksel sınırlarına çevirir (taşma kırpılır, en az 1 px). */
function toPixelRect(r: Rect, rows: number, cols: number) {
  const x0 = Math.max(0, Math.min(cols - 1, Math.floor(r.x * cols)));
  const y0 = Math.max(0, Math.min(rows - 1, Math.floor(r.y * rows)));
  const x1 = Math.max(x0 + 1, Math.min(cols, Math.ceil((r.x + r.w) * cols)));
  const y1 = Math.max(y0 + 1, Math.min(rows, Math.ceil((r.y + r.h) * rows)));
  return { x0, y0, x1, y1 };
}

/**
 * Verilen kutuları TÜM karelerde doldurur (yerinde). Dolgu değeri "görsel siyah"tır:
 * MONOCHROME1'de beyaz=0 olduğu için maksimum, diğerlerinde 0.
 * Döner: gerçekten maskelenen piksel sayısı (0 = hiçbir şey değişmedi → çağıran yeniden yazmaz).
 */
export function maskFrames(dec: DecodedPixels, rects: Rect[]): number {
  if (!rects.length) return 0;
  const { rows, cols, samples, bits, signed, photometric } = dec.info;
  const comps = samples === 3 ? 3 : 1;
  const maxVal = bits === 8 ? 255 : signed ? 32767 : 65535;
  const fill = photometric === "MONOCHROME1" && comps === 1 ? maxVal : 0;
  let touched = 0;
  for (const r of rects) {
    const { x0, y0, x1, y1 } = toPixelRect(r, rows, cols);
    for (const frame of dec.frames) {
      for (let y = y0; y < y1; y++) {
        const base = y * cols;
        for (let x = x0; x < x1; x++) {
          const p = (base + x) * comps;
          for (let c = 0; c < comps; c++) frame[p + c] = fill;
        }
      }
    }
    touched += (x1 - x0) * (y1 - y0) * dec.frames.length;
  }
  return touched;
}

// ── Sıkıştırmasız yeniden yazma ──

/** Kare dizilerini tek bitişik byte bloğuna serileştirir (Little Endian). */
function framesToBytes(dec: DecodedPixels): ArrayBuffer {
  const bytesPer = dec.info.bits === 8 ? 1 : 2;
  const per = dec.frames[0].length * bytesPer;
  const total = per * dec.frames.length;
  // DICOM: OB/OW değer uzunluğu ÇİFT olmalı — tek ise sonuna 0 eklenir.
  const buf = new ArrayBuffer(total + (total % 2));
  const view = new Uint8Array(buf);
  let off = 0;
  for (const f of dec.frames) {
    const src = new Uint8Array(f.buffer, f.byteOffset, f.length * bytesPer);
    view.set(src, off);
    off += src.length;
  }
  return buf;
}

/**
 * Maskelenmiş kareleri, ORİJİNAL etiketleri koruyarak sıkıştırmasız (Explicit VR LE) yeniden yazar.
 * Yalnız piksel/transfer-syntax ile ilgili etiketler güncellenir; PHI temizliği çağıran katmanın işidir.
 */
export function writeUncompressed(input: ArrayBuffer, dec: DecodedPixels): Uint8Array<ArrayBuffer> {
  const data = dcmjs.data.DicomMessage.readFile(input, { ignoreErrors: false });
  const dict = data.dict as Record<string, { vr: string; Value?: unknown[] }>;

  data.meta["00020010"] = { vr: "UI", Value: [TS_EXPLICIT_LE] }; // TransferSyntaxUID
  dict["7FE00010"] = { vr: dec.info.bits === 8 ? "OB" : "OW", Value: [framesToBytes(dec)] };

  // Çözme sırasında renk uzayı değiştiyse (YBR JPEG → RGB) başlık gerçeğe hizalanır.
  if (dec.info.decodedPhotometric !== dec.info.photometric) {
    dict["00280004"] = { vr: "CS", Value: [dec.info.decodedPhotometric] };
  }
  if (dec.info.samples === 3) {
    dict["00280002"] = { vr: "US", Value: [3] };
    dict["00280006"] = { vr: "US", Value: [0] }; // PlanarConfiguration: interleaved
  }
  // Sıkıştırılmıştan gelen kareler artık düz blok — parçalı (fragment) kalıntı etiketleri anlamsız.
  delete dict["7FE00001"]; // ExtendedOffsetTable
  delete dict["7FE00002"]; // ExtendedOffsetTableLengths

  return new Uint8Array(data.write());
}

// ── PNG önizleme (editörde kutu çizmek için; PHI İÇERİR → yalnız auth'lu uçtan servis edilir) ──

function crc32(buf: Uint8Array): number {
  let c: number;
  const table = crc32.table ?? (crc32.table = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })());
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}
crc32.table = undefined as Int32Array | undefined;

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** 8-bit gri (veya RGB) piksel bloğunu PNG'ye çevirir — bağımlılıksız (node:zlib). */
function encodePng(pixels: Uint8Array, w: number, h: number, channels: 1 | 3): Uint8Array {
  const stride = w * channels;
  const raw = new Uint8Array((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filtre: None
    raw.set(pixels.subarray(y * stride, y * stride + stride), y * (stride + 1) + 1);
  }
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w);
  dv.setUint32(4, h);
  ihdr[8] = 8; // bit derinliği
  ihdr[9] = channels === 3 ? 2 : 0; // renk tipi: 2=RGB, 0=gri
  const idat = zlib.deflateSync(raw, { level: 6 });
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const chunks = [sig, pngChunk("IHDR", ihdr), pngChunk("IDAT", new Uint8Array(idat)), pngChunk("IEND", new Uint8Array(0))];
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

export interface PreviewResult {
  png: Uint8Array;
  width: number;
  height: number;
}

/**
 * Bir kareyi (varsayılan: ilk) pencerelenmiş 8-bit PNG önizlemeye çevirir; uzun kenar maxSide'a küçültülür.
 * Kutu koordinatları normalize olduğu için küçültme editörü etkilemez.
 */
export function renderPreviewPng(dec: DecodedPixels, frameIndex = 0, maxSide = 1024): PreviewResult {
  const { rows, cols, samples, bits, photometric } = dec.info;
  const comps = samples === 3 ? 3 : 1;
  const src = dec.frames[Math.min(frameIndex, dec.frames.length - 1)];
  const scale = Math.min(1, maxSide / Math.max(rows, cols));
  const w = Math.max(1, Math.round(cols * scale));
  const h = Math.max(1, Math.round(rows * scale));

  // Pencere: tag varsa onu kullan, yoksa gerçek min-max (yazı tespitinde kontrast önemli).
  let lo: number;
  let hi: number;
  if (Number.isFinite(dec.wc) && Number.isFinite(dec.ww) && dec.ww > 0 && comps === 1) {
    lo = dec.wc - dec.ww / 2;
    hi = dec.wc + dec.ww / 2;
  } else if (comps === 1) {
    lo = Infinity;
    hi = -Infinity;
    for (let i = 0; i < src.length; i++) {
      const v = src[i];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    if (!(hi > lo)) hi = lo + 1;
  } else {
    lo = 0;
    hi = bits === 8 ? 255 : 65535;
  }
  const span = hi - lo || 1;
  const invert = photometric === "MONOCHROME1" && comps === 1;

  const out = new Uint8Array(w * h * comps);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(rows - 1, Math.floor(y / scale));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(cols - 1, Math.floor(x / scale));
      const sp = (sy * cols + sx) * comps;
      const dp = (y * w + x) * comps;
      for (let c = 0; c < comps; c++) {
        let v = ((src[sp + c] - lo) / span) * 255;
        if (invert) v = 255 - v;
        out[dp + c] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
    }
  }
  return { png: encodePng(out, w, h, comps === 3 ? 3 : 1), width: w, height: h };
}
