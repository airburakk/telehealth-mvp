"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dicomParser from "dicom-parser";
import { X, Upload, ZoomIn, ZoomOut, Maximize2, Contrast, RotateCcw, FileImage, Loader2, Image as ImageIcon } from "lucide-react";

// Transfer sözdizimleri. Sıkıştırmasız (Little Endian) doğrudan; RLE inline (PackBits);
// JPEG Baseline tarayıcıyla (createImageBitmap); JPEG Lossless jpeg-lossless-decoder-js ile;
// JPEG 2000 (OpenJPEG) ve JPEG-LS (CharLS) WASM codec'leriyle çözülür (public/wasm'den yüklenir).
// Yalnız JPEG Genişletilmiş 12-bit (.51) desteklenmiyor (ayrı libjpeg gerektirir).
const TS_UNCOMPRESSED = new Set(["1.2.840.10008.1.2", "1.2.840.10008.1.2.1", "1.2.840.10008.1.2.2"]);
const TS_RLE = "1.2.840.10008.1.2.5";
const TS_JPEG_BASELINE = "1.2.840.10008.1.2.4.50";
const TS_JPEG_LOSSLESS = new Set(["1.2.840.10008.1.2.4.57", "1.2.840.10008.1.2.4.70"]);
const TS_JPEGLS = new Set(["1.2.840.10008.1.2.4.80", "1.2.840.10008.1.2.4.81"]); // CharLS (WASM)
const TS_J2K = new Set(["1.2.840.10008.1.2.4.90", "1.2.840.10008.1.2.4.91"]);    // OpenJPEG (WASM)
const TS_UNSUPPORTED: Record<string, string> = {
  "1.2.840.10008.1.2.4.51": "JPEG Genişletilmiş (12-bit)",
};

interface ParsedFile {
  name: string;
  byteArray: Uint8Array;
  dataSet: dicomParser.DataSet;
  rows: number;
  cols: number;
  samples: number;
  photometric: string;
  bits: number;
  signed: boolean;
  frames: number;
  slope: number;
  intercept: number;
  wc: number;
  ww: number;
  pixelOffset: number;
  ts: string;
  encapsulated: boolean;
  decoded?: Float32Array[]; // sıkıştırılmışta önceden çözülmüş kareler (rescale uygulanmış değerler)
  meta: { modality: string; patient: string; desc: string };
}
interface Slice { fileIdx: number; frame: number }

function tagFloat(ds: dicomParser.DataSet, tag: string, dflt: number): number {
  try { const v = ds.floatString(tag); return v == null || Number.isNaN(v) ? dflt : v; } catch { return dflt; }
}

function parseFile(name: string, buf: ArrayBuffer): ParsedFile {
  const byteArray = new Uint8Array(buf);
  const ds = dicomParser.parseDicom(byteArray);
  const ts = (ds.string("x00020010") || "1.2.840.10008.1.2").trim();
  const encapsulated = !TS_UNCOMPRESSED.has(ts);
  const supported = !encapsulated || ts === TS_RLE || ts === TS_JPEG_BASELINE ||
    TS_JPEG_LOSSLESS.has(ts) || TS_JPEGLS.has(ts) || TS_J2K.has(ts);
  if (!supported) {
    const nm = TS_UNSUPPORTED[ts] || `bu sıkıştırma (${ts})`;
    throw new Error(`${nm} için ek codec (WASM) gerekiyor — bu sürümde desteklenmiyor. Desteklenen: sıkıştırmasız, RLE, JPEG Baseline, JPEG Lossless.`);
  }
  const px = ds.elements["x7fe00010"];
  if (!px) throw new Error("Piksel verisi bulunamadı.");
  const bits = ds.uint16("x00280100") || 16;
  if (bits !== 8 && bits !== 16) throw new Error(`Desteklenmeyen bit derinliği: ${bits}.`);
  const rows = ds.uint16("x00280010") || 0;
  const cols = ds.uint16("x00280011") || 0;
  if (!rows || !cols) throw new Error("Görüntü boyutu okunamadı.");
  const samples = ds.uint16("x00280002") || 1;
  const nf = ds.intString("x00280008");
  const frames = typeof nf === "number" && nf > 0 ? nf : 1;
  return {
    name, byteArray, dataSet: ds, rows, cols, samples,
    photometric: (ds.string("x00280004") || "MONOCHROME2").trim(),
    bits, signed: (ds.uint16("x00280103") || 0) === 1, frames,
    slope: tagFloat(ds, "x00281053", 1), intercept: tagFloat(ds, "x00281052", 0),
    wc: tagFloat(ds, "x00281050", NaN), ww: tagFloat(ds, "x00281051", NaN),
    pixelOffset: encapsulated ? -1 : px.dataOffset,
    ts, encapsulated,
    meta: {
      modality: (ds.string("x00080060") || "—").trim(),
      patient: (ds.string("x00100010") || "—").trim().replace(/\^/g, " "),
      desc: (ds.string("x0008103e") || ds.string("x00081030") || "").trim(),
    },
  };
}

// Bir karenin piksellerini (rescale uygulanmış değer) döndürür.
// Sıkıştırılmış dosyalarda kareler yükleme anında önceden çözülür (f.decoded).
function frameValues(f: ParsedFile, frame: number): Float32Array {
  if (f.decoded) return f.decoded[frame] ?? f.decoded[0] ?? new Float32Array(f.rows * f.cols);
  const count = f.rows * f.cols * f.samples;
  const bytesPer = f.bits / 8;
  const start = f.byteArray.byteOffset + f.pixelOffset + frame * count * bytesPer;
  const buf = f.byteArray.buffer.slice(start, start + count * bytesPer);
  let raw: Uint8Array | Uint16Array | Int16Array;
  if (f.bits === 8) raw = new Uint8Array(buf);
  else raw = f.signed ? new Int16Array(buf) : new Uint16Array(buf);
  const out = new Float32Array(f.rows * f.cols * (f.samples === 3 ? 3 : 1));
  for (let i = 0; i < out.length; i++) out[i] = raw[i] * f.slope + f.intercept;
  return out;
}

// --- Sıkıştırılmış kare çözücüler (yükleme anında çağrılır → f.decoded) ---

// DICOM RLE (Apple PackBits) tek byte düzlemini açar
function unpackBits(src: Uint8Array, start: number, end: number, out: Uint8Array): void {
  let o = 0, i = start;
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

// RLE Lossless karesi: 16-bit mono (byte düzlemi MSB→LSB) · 8-bit mono · 8-bit RGB (3 segment)
function decodeRLE(frame: Uint8Array, f: ParsedFile): Float32Array {
  const dv = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  const nSeg = dv.getUint32(0, true);
  const px = f.rows * f.cols;
  const bytesPer = f.bits === 8 ? 1 : 2;
  const comps = f.samples === 3 ? 3 : 1;
  const planes: Uint8Array[] = [];
  for (let s = 0; s < nSeg; s++) {
    const start = dv.getUint32(4 + s * 4, true);
    const next = s + 1 < nSeg ? dv.getUint32(4 + (s + 1) * 4, true) : frame.byteLength;
    const plane = new Uint8Array(px);
    unpackBits(frame, start, next, plane);
    planes.push(plane);
  }
  const out = new Float32Array(px * comps);
  for (let c = 0; c < comps; c++) {
    for (let p = 0; p < px; p++) {
      let val = 0;
      for (let b = 0; b < bytesPer; b++) { const seg = c * bytesPer + b; val = (val << 8) | (planes[seg]?.[p] ?? 0); }
      if (comps === 1) {
        if (f.signed && bytesPer === 2 && val >= 32768) val -= 65536;
        out[p] = val * f.slope + f.intercept;
      } else out[p * 3 + c] = val; // RGB 0-255
    }
  }
  return out;
}

// JPEG Baseline (8-bit): tarayıcının native JPEG çözücüsü (createImageBitmap) — bağımlılıksız
async function decodeBaseline(frame: Uint8Array, f: ParsedFile): Promise<{ data: Float32Array; samples: number }> {
  const jpegBytes = new Uint8Array(frame.byteLength); // taze ArrayBuffer → Blob tip uyumu
  jpegBytes.set(frame);
  const bmp = await createImageBitmap(new Blob([jpegBytes], { type: "image/jpeg" }));
  const w = bmp.width, h = bmp.height; // close() boyutu sıfırlar → önce yakala
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const cx = c.getContext("2d", { willReadFrequently: true })!;
  cx.drawImage(bmp, 0, 0); bmp.close?.();
  const rgba = cx.getImageData(0, 0, w, h).data;
  const px = f.rows * f.cols;
  const color = f.samples === 3;
  const out = new Float32Array(color ? px * 3 : px);
  for (let p = 0; p < px; p++) {
    if (color) { out[p * 3] = rgba[p * 4]; out[p * 3 + 1] = rgba[p * 4 + 1]; out[p * 3 + 2] = rgba[p * 4 + 2]; }
    else out[p] = rgba[p * 4] * f.slope + f.intercept; // mono: R kanalı
  }
  return { data: out, samples: color ? 3 : 1 };
}

// JPEG Lossless (.57/.70): jpeg-lossless-decoder-js — dinamik import (yalnız gerekince yüklenir)
async function decodeLossless(frame: Uint8Array, f: ParsedFile): Promise<Float32Array> {
  const { Decoder } = await import("jpeg-lossless-decoder-js");
  const bytesPer = f.bits === 8 ? 1 : 2;
  const raw = new Decoder().decode(frame.buffer as ArrayBuffer, frame.byteOffset, frame.byteLength, bytesPer);
  const px = f.rows * f.cols;
  const out = new Float32Array(px);
  for (let p = 0; p < px; p++) {
    let v = raw[p] ?? 0;
    if (f.signed && bytesPer === 2 && v >= 32768) v -= 65536;
    out[p] = v * f.slope + f.intercept;
  }
  return out;
}

// --- WASM codec'ler: JPEG 2000 (OpenJPEG) ve JPEG-LS (CharLS) ---
// Glue dinamik import edilir, .wasm public/wasm'den (locateFile) yüklenir; modül singleton cache'lenir.
type CSFrameInfo = { width: number; height: number; bitsPerSample: number; componentCount: number; isSigned: boolean };
type CSDecoder = {
  getEncodedBuffer(size: number): Uint8Array;
  getDecodedBuffer(): Uint8Array;
  getFrameInfo(): CSFrameInfo;
  decode(): void;
  delete?(): void;
};
type CSModule = { J2KDecoder?: new () => CSDecoder; JpegLSDecoder?: new () => CSDecoder };
type CSFactory = (o: { locateFile: (p: string) => string }) => Promise<CSModule>;
let _ojModule: Promise<CSModule> | null = null;
let _charlsModule: Promise<CSModule> | null = null;
function ojModule(): Promise<CSModule> {
  if (!_ojModule) _ojModule = import("@cornerstonejs/codec-openjpeg/wasmjs").then((m) => {
    const factory = (m.default as unknown as CSFactory) ?? (m as unknown as CSFactory);
    return factory({ locateFile: (p) => "/wasm/" + p });
  });
  return _ojModule;
}
function charlsModule(): Promise<CSModule> {
  if (!_charlsModule) _charlsModule = import("@cornerstonejs/codec-charls/wasmjs").then((m) => {
    const factory = (m.default as unknown as CSFactory) ?? (m as unknown as CSFactory);
    return factory({ locateFile: (p) => "/wasm/" + p });
  });
  return _charlsModule;
}

// WASM decoder çıktısını (ham byte) frameInfo'ya göre Float32'ye çevir (rescale uygulanmış)
function csSamples(bytes: Uint8Array, fi: CSFrameInfo, f: ParsedFile): { data: Float32Array; samples: number } {
  const pxCount = f.rows * f.cols;
  const comps = fi.componentCount === 3 ? 3 : 1;
  const copy = bytes.slice(); // wasm heap'ten kopyala (decoder yeniden kullanılınca üzerine yazılır)
  const samp: Uint8Array | Uint16Array | Int16Array =
    fi.bitsPerSample <= 8 ? copy : fi.isSigned ? new Int16Array(copy.buffer) : new Uint16Array(copy.buffer);
  const out = new Float32Array(pxCount * comps);
  if (comps === 1) for (let p = 0; p < pxCount; p++) out[p] = (samp[p] ?? 0) * f.slope + f.intercept;
  else for (let i = 0; i < pxCount * 3; i++) out[i] = samp[i] ?? 0; // RGB 0-255
  return { data: out, samples: comps };
}

async function decodeWithCS(frame: Uint8Array, f: ParsedFile, dec: CSDecoder) {
  const enc = dec.getEncodedBuffer(frame.length);
  enc.set(frame);
  dec.decode();
  const res = csSamples(dec.getDecodedBuffer(), dec.getFrameInfo(), f);
  dec.delete?.();
  return res;
}

async function decodeJ2K(frame: Uint8Array, f: ParsedFile) {
  const m = await ojModule();
  if (!m.J2KDecoder) throw new Error("JPEG 2000 codec yüklenemedi.");
  return decodeWithCS(frame, f, new m.J2KDecoder());
}
async function decodeJPEGLS(frame: Uint8Array, f: ParsedFile) {
  const m = await charlsModule();
  if (!m.JpegLSDecoder) throw new Error("JPEG-LS codec yüklenemedi.");
  return decodeWithCS(frame, f, new m.JpegLSDecoder());
}

// Sıkıştırılmış dosyanın TÜM karelerini çöz → f.decoded; RGB'ye dönüştüyse f.samples'ı güncelle
async function decodeAllFrames(f: ParsedFile): Promise<void> {
  const pe = f.dataSet.elements["x7fe00010"];
  if (!pe) throw new Error("Piksel verisi bulunamadı.");
  const out: Float32Array[] = [];
  let samples = f.samples;
  for (let fr = 0; fr < f.frames; fr++) {
    let enc: Uint8Array;
    try {
      enc = dicomParser.readEncapsulatedImageFrame(f.dataSet, pe, fr);
    } catch {
      const bot = dicomParser.createJPEGBasicOffsetTable(f.dataSet, pe);
      enc = dicomParser.readEncapsulatedImageFrame(f.dataSet, pe, fr, bot);
    }
    if (f.ts === TS_RLE) out.push(decodeRLE(enc, f));
    else if (f.ts === TS_JPEG_BASELINE) { const r = await decodeBaseline(enc, f); out.push(r.data); samples = r.samples; }
    else if (TS_J2K.has(f.ts)) { const r = await decodeJ2K(enc, f); out.push(r.data); samples = r.samples; }
    else if (TS_JPEGLS.has(f.ts)) { const r = await decodeJPEGLS(enc, f); out.push(r.data); samples = r.samples; }
    else out.push(await decodeLossless(enc, f));
  }
  f.decoded = out;
  f.samples = samples;
}

export default function DicomViewer({ open, onClose, src }: { open: boolean; onClose: () => void; src?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const filesRef = useRef<ParsedFile[]>([]);
  const slicesRef = useRef<Slice[]>([]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [total, setTotal] = useState(0);
  const [idx, setIdx] = useState(0);
  const [wc, setWc] = useState(40);
  const [ww, setWw] = useState(400);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [invert, setInvert] = useState(false);
  const [meta, setMeta] = useState<ParsedFile["meta"] | null>(null);

  const drag = useRef<{ mode: "wl" | "pan"; x: number; y: number; wc: number; ww: number; px: number; py: number } | null>(null);

  const curFile = () => {
    const s = slicesRef.current[idx];
    return s ? filesRef.current[s.fileIdx] : null;
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const s = slicesRef.current[idx];
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // canvas backing boyutunu kapsayıcıya eşitle (her çizimde — viewport sonradan boyut kazansa da doğru)
    const parent = canvas.parentElement;
    if (parent) {
      const r = parent.getBoundingClientRect();
      const w = Math.max(320, Math.floor(r.width)), h = Math.max(320, Math.floor(r.height));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    }
    const cw = canvas.width, ch = canvas.height;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, cw, ch);
    if (!s) return;
    const f = filesRef.current[s.fileIdx];
    const vals = frameValues(f, s.frame);
    const off = document.createElement("canvas");
    off.width = f.cols; off.height = f.rows;
    const octx = off.getContext("2d")!;
    const img = octx.createImageData(f.cols, f.rows);
    const low = wc - ww / 2, range = ww || 1;
    const mono1 = f.photometric === "MONOCHROME1";
    if (f.samples === 3) {
      for (let i = 0, j = 0; i < f.rows * f.cols; i++, j += 4) {
        img.data[j] = vals[i * 3]; img.data[j + 1] = vals[i * 3 + 1]; img.data[j + 2] = vals[i * 3 + 2]; img.data[j + 3] = 255;
      }
    } else {
      for (let i = 0, j = 0; i < vals.length; i++, j += 4) {
        let g = ((vals[i] - low) / range) * 255;
        g = g < 0 ? 0 : g > 255 ? 255 : g;
        if (mono1 !== invert) g = 255 - g;
        img.data[j] = img.data[j + 1] = img.data[j + 2] = g; img.data[j + 3] = 255;
      }
    }
    octx.putImageData(img, 0, 0);
    const fit = Math.min(cw / f.cols, ch / f.rows);
    const sc = fit * zoom;
    const dw = f.cols * sc, dh = f.rows * sc;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, (cw - dw) / 2 + pan.x, (ch - dh) / 2 + pan.y, dw, dh);
  }, [idx, wc, ww, zoom, pan, invert]);

  // her zaman güncel draw'a erişim (ResizeObserver kapanışını sabit tutmak için)
  const drawRef = useRef(draw);
  useEffect(() => { drawRef.current = draw; }, [draw]);

  // viewport boyut kazanınca / değişince yeniden çiz (draw kendi backing boyutunu eşitler)
  useEffect(() => {
    if (!open) return;
    const onResize = () => drawRef.current();
    window.addEventListener("resize", onResize);
    const id = setTimeout(() => drawRef.current(), 60);
    let ro: ResizeObserver | undefined;
    const parent = canvasRef.current?.parentElement;
    if (parent && typeof ResizeObserver !== "undefined") { ro = new ResizeObserver(onResize); ro.observe(parent); }
    return () => { window.removeEventListener("resize", onResize); clearTimeout(id); ro?.disconnect(); };
  }, [open]);

  useEffect(() => { draw(); }, [draw]);

  async function loadBuffers(items: { name: string; buf: ArrayBuffer }[]) {
    setLoading(true); setErr("");
    try {
      const parsed: ParsedFile[] = [];
      const slices: Slice[] = [];
      for (const it of items) {
        const f = parseFile(it.name, it.buf);
        if (f.encapsulated) await decodeAllFrames(f); // RLE/JPEG kareleri önceden çöz
        const fi = parsed.push(f) - 1;
        for (let fr = 0; fr < f.frames; fr++) slices.push({ fileIdx: fi, frame: fr });
      }
      if (!slices.length) throw new Error("Geçerli DICOM bulunamadı.");
      filesRef.current = parsed;
      slicesRef.current = slices;
      const f0 = parsed[0];
      setTotal(slices.length);
      setIdx(0);
      setZoom(1); setPan({ x: 0, y: 0 }); setInvert(false);
      setMeta(f0.meta);
      // W/L: etiketten; yoksa ilk kareden min/max
      if (!Number.isNaN(f0.wc) && !Number.isNaN(f0.ww)) { setWc(f0.wc); setWw(f0.ww); }
      else {
        const v = frameValues(f0, 0); let mn = Infinity, mx = -Infinity;
        for (let i = 0; i < v.length; i++) { if (v[i] < mn) mn = v[i]; if (v[i] > mx) mx = v[i]; }
        setWc((mn + mx) / 2); setWw(Math.max(1, mx - mn));
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "DICOM okunamadı.");
      filesRef.current = []; slicesRef.current = []; setTotal(0); setMeta(null);
    } finally { setLoading(false); }
  }

  async function onFiles(fileList: FileList | null) {
    if (!fileList || !fileList.length) return;
    const items = await Promise.all([...fileList].map(async (f) => ({ name: f.name, buf: await f.arrayBuffer() })));
    loadBuffers(items);
  }
  async function loadUrl(url: string, name = "dicom") {
    setLoading(true); setErr("");
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error("DICOM yüklenemedi.");
      await loadBuffers([{ name, buf: await r.arrayBuffer() }]);
    } catch (e) { setErr(e instanceof Error ? e.message : "Yüklenemedi."); setLoading(false); }
  }
  function loadSample() { loadUrl("/sample-dicom.dcm", "sample-dicom.dcm"); }

  // src verildiğinde (vaka kokpitinden) modal açılınca otomatik yükle
  const loadedSrc = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!open) { loadedSrc.current = undefined; return; }
    if (src && loadedSrc.current !== src) {
      loadedSrc.current = src;
      loadUrl(src, src.split("/").pop() || "dicom");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, src]);

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    if (total > 1 && !e.ctrlKey) setIdx((i) => Math.min(total - 1, Math.max(0, i + (e.deltaY > 0 ? 1 : -1))));
    else setZoom((z) => Math.min(8, Math.max(0.2, z * (e.deltaY > 0 ? 0.9 : 1.1))));
  }
  function onDown(e: React.MouseEvent) {
    drag.current = { mode: e.shiftKey || e.button === 1 ? "pan" : "wl", x: e.clientX, y: e.clientY, wc, ww, px: pan.x, py: pan.y };
  }
  function onMove(e: React.MouseEvent) {
    const d = drag.current; if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (d.mode === "pan") setPan({ x: d.px + dx, y: d.py + dy });
    else { setWw(Math.max(1, Math.round(d.ww + dx * 2))); setWc(Math.round(d.wc + dy * 2)); }
  }
  function onUp() { drag.current = null; }
  function reset() {
    const f = curFile(); setZoom(1); setPan({ x: 0, y: 0 });
    if (f && !Number.isNaN(f.wc) && !Number.isNaN(f.ww)) { setWc(f.wc); setWw(f.ww); }
  }

  if (!open) return null;
  const hasImg = total > 0;

  return createPortal(
    <div className="theme-dark fixed inset-0 z-50 flex flex-col bg-black/95 text-[var(--c-ink)]">
      {/* Üst bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--c-hairline)] px-4 py-2.5 text-[var(--c-ink)]">
        <span className="flex items-center gap-1.5 text-sm font-semibold"><FileImage size={16} className="text-teal-400" /> Radyoloji (DICOM) Görüntüleyici</span>
        <label className="ml-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--c-ink)]/10 px-3 py-1.5 text-xs font-medium hover:bg-[var(--c-ink)]/20">
          <Upload size={14} /> DICOM aç (.dcm)
          <input type="file" accept=".dcm,application/dicom" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
        </label>
        <button onClick={loadSample} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium hover:bg-teal-500"><ImageIcon size={14} /> Örnek DICOM</button>
        {hasImg && (
          <>
            <span className="mx-1 h-5 w-px bg-[var(--c-ink)]/15" />
            <button onClick={() => setZoom((z) => Math.min(8, z * 1.2))} className="rounded p-1.5 hover:bg-[var(--c-ink)]/10" title="Yakınlaştır"><ZoomIn size={16} /></button>
            <button onClick={() => setZoom((z) => Math.max(0.2, z / 1.2))} className="rounded p-1.5 hover:bg-[var(--c-ink)]/10" title="Uzaklaştır"><ZoomOut size={16} /></button>
            <button onClick={reset} className="rounded p-1.5 hover:bg-[var(--c-ink)]/10" title="Sığdır / sıfırla"><Maximize2 size={16} /></button>
            <button onClick={() => setInvert((v) => !v)} className={`rounded p-1.5 hover:bg-[var(--c-ink)]/10 ${invert ? "text-teal-400" : ""}`} title="Renk tersle"><Contrast size={16} /></button>
            <button onClick={reset} className="rounded p-1.5 hover:bg-[var(--c-ink)]/10" title="W/L sıfırla"><RotateCcw size={16} /></button>
          </>
        )}
        <button onClick={onClose} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-[var(--c-ink)]/10 px-3 py-1.5 text-xs font-medium hover:bg-[var(--c-ink)]/20"><X size={15} /> Kapat</button>
      </div>

      {/* Görüntü alanı */}
      <div className="relative flex-1 overflow-hidden">
        <canvas
          ref={canvasRef}
          onWheel={onWheel} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
          className="h-full w-full cursor-crosshair select-none"
        />
        {/* Sol-üst meta */}
        {hasImg && meta && (
          <div className="pointer-events-none absolute left-3 top-3 space-y-0.5 text-[11px] leading-tight text-teal-300/90">
            <div>{meta.patient}</div>
            <div>{meta.modality}{meta.desc ? ` · ${meta.desc}` : ""}</div>
          </div>
        )}
        {/* Sağ-üst teknik */}
        {hasImg && (
          <div className="pointer-events-none absolute right-3 top-3 space-y-0.5 text-right text-[11px] leading-tight text-teal-300/90">
            <div>Kesit {idx + 1}/{total}</div>
            <div>W {Math.round(ww)} · L {Math.round(wc)}</div>
            <div>Zoom %{Math.round(zoom * 100)}</div>
          </div>
        )}
        {/* Alt ipucu */}
        {hasImg && (
          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--c-ink)]/10 px-3 py-1 text-[11px] text-[var(--c-ink-2)]">
            Sürükle: pencere/seviye · Shift+sürükle: kaydır · Tekerlek: {total > 1 ? "kesit" : "zoom"} · Ctrl+tekerlek: zoom
          </div>
        )}

        {loading && <div className="absolute inset-0 grid place-items-center text-[var(--c-ink)]"><Loader2 className="animate-spin" /></div>}
        {!hasImg && !loading && (
          <div className="absolute inset-0 grid place-items-center px-6 text-center">
            <div className="max-w-md">
              <FileImage size={40} className="mx-auto text-[var(--c-ink-3)]" />
              <h3 className="mt-3 text-lg font-semibold text-[var(--c-ink)]">DICOM görüntüsü açın</h3>
              <p className="mt-1 text-sm text-[var(--c-ink-2)]">Hastanın radyoloji (.dcm) dosyasını açın ya da örneklerle deneyin. Sıkıştırmasız, <b className="text-teal-400">RLE</b>, <b className="text-teal-400">JPEG Baseline</b>, <b className="text-teal-400">JPEG Lossless</b>, <b className="text-teal-400">JPEG 2000</b> ve <b className="text-teal-400">JPEG-LS</b> desteklenir. Pencere/seviye, yakınlaştırma, kaydırma ve kesit gezinme mevcuttur.</p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-xs">
                <span className="text-[var(--c-ink-3)]">Örnekler:</span>
                <button onClick={loadSample} className="rounded-md bg-[var(--c-ink)]/10 px-2.5 py-1 font-medium text-[var(--c-ink)] hover:bg-[var(--c-ink)]/20">Sıkıştırmasız</button>
                <button onClick={() => loadUrl("/dicom/test-rle.dcm", "test-rle.dcm")} className="rounded-md bg-[var(--c-ink)]/10 px-2.5 py-1 font-medium text-[var(--c-ink)] hover:bg-[var(--c-ink)]/20">RLE</button>
                <button onClick={() => loadUrl("/dicom/test-jpeg-lossless.dcm", "test-jpeg-lossless.dcm")} className="rounded-md bg-[var(--c-ink)]/10 px-2.5 py-1 font-medium text-[var(--c-ink)] hover:bg-[var(--c-ink)]/20">JPEG Lossless</button>
                <button onClick={() => loadUrl("/dicom/test-jpeg-baseline.dcm", "test-jpeg-baseline.dcm")} className="rounded-md bg-[var(--c-ink)]/10 px-2.5 py-1 font-medium text-[var(--c-ink)] hover:bg-[var(--c-ink)]/20">JPEG Baseline</button>
                <button onClick={() => loadUrl("/dicom/test-jpeg2000.dcm", "test-jpeg2000.dcm")} className="rounded-md bg-[var(--c-ink)]/10 px-2.5 py-1 font-medium text-[var(--c-ink)] hover:bg-[var(--c-ink)]/20">JPEG 2000</button>
                <button onClick={() => loadUrl("/dicom/test-jpegls.dcm", "test-jpegls.dcm")} className="rounded-md bg-[var(--c-ink)]/10 px-2.5 py-1 font-medium text-[var(--c-ink)] hover:bg-[var(--c-ink)]/20">JPEG-LS</button>
              </div>
              {err && <p className="mt-3 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">{err}</p>}
            </div>
          </div>
        )}
        {err && hasImg && <div className="absolute bottom-12 left-1/2 -translate-x-1/2 rounded-lg bg-red-500/20 px-3 py-1.5 text-sm text-red-200">{err}</div>}
      </div>

      {/* Alt: kesit kaydırıcı */}
      {hasImg && total > 1 && (
        <div className="flex items-center gap-3 border-t border-[var(--c-hairline)] px-4 py-2 text-[var(--c-ink)]">
          <span className="text-xs text-[var(--c-ink-2)]">Kesit</span>
          <input type="range" min={0} max={total - 1} value={idx} onChange={(e) => setIdx(Number(e.target.value))} className="flex-1" style={{ accentColor: "var(--c-accent)" }} />
          <span className="w-14 text-right text-xs tabular-nums">{idx + 1}/{total}</span>
        </div>
      )}
    </div>,
    document.body
  );
}
