// Burned-in PHI — otomatik maske kuralları (v6.37).
//
// TASARIM İLKESİ: yalnız YANLIŞ-POZİTİF RİSKİ ~SIFIR olan, standarda dayalı kurallar otomatik uygulanır.
// Görüntü içeriğinden yazı "tahmin etmek" (OCR/heuristik) BİLİNÇLİ OLARAK YOK — klinik alanı yanlışlıkla
// karartmak, PHI kaçırmaktan farklı ama gerçek bir zarardır. Kalanı insan gözü kapatır: yükleyen kişi
// önizleme üstünde kendi kutularını çizer (DicomRedactEditor) ve beyanı imzalar.
//
// ⚠️ Bu modül "otomatik temizlik garantisi" DEĞİLDİR — vitrin/arayüz metinlerinde asla öyle sunulmaz
// (bkz. proje iddia disiplini). Verdiği şey: bilinen cihaz şeritlerinin kapatılması + risk sinyali.
import dicomParser from "dicom-parser";
import type { Rect } from "./dicom-pixels";

export interface BurnInAnalysis {
  /** Otomatik önerilen (ve sunucuda zorunlu uygulanan) maskeler — normalize koordinat. */
  autoRects: Rect[];
  /** (0028,0301) BurnedInAnnotation = YES → dosya kendi kendini işaretlemiş. */
  declaredBurnedIn: boolean;
  /** Yüksek riskli tip: ekran yakalama / fotoğraf / tarama (tüm görüntü cihaz arayüzü olabilir). */
  highRisk: boolean;
  /** Kullanıcıya gösterilecek kural açıklamaları (TR, arayüzde listelenir). */
  notes: string[];
  modality: string;
  rows: number;
  cols: number;
}

/** US cihaz arayüzü şeridi: sekans yoksa üst bant (ad/kurum/tarih buraya basılır). */
const US_TOP_BAND = 0.12;
/** Ekran-yakalama benzeri modalitelerde üst bant (yalnız öneri — highRisk uyarısı asıl mesaj). */
const SC_TOP_BAND = 0.08;
const SCREEN_MODALITIES = new Set(["SC", "OT", "XC", "ES", "GM"]);

function seqNumber(ds: dicomParser.DataSet, tag: string): number | undefined {
  // Bölge koordinatları VR=UL; bazı cihazlar US yazar → ikisini de dene.
  try {
    const el = ds.elements[tag];
    if (!el) return undefined;
    const v = el.length >= 4 ? ds.uint32(tag) : ds.uint16(tag);
    return typeof v === "number" && Number.isFinite(v) ? v : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Ultrason (0018,6011) SequenceOfUltrasoundRegions: cihazın "gerçek görüntü alanı" olarak beyan ettiği
 * bölgeler. Bu bölgelerin DIŞI tanım gereği cihaz arayüzüdür (ad/kurum/tarih/ölçüm menüsü) →
 * klinik veri kaybı olmadan kapatılabilir. Union bounding box'ın dışı 4 kenar dikdörtgeniyle maskelenir.
 */
function ultrasoundOutsideRects(ds: dicomParser.DataSet, rows: number, cols: number): Rect[] | null {
  const seq = ds.elements["x00186011"];
  if (!seq?.items?.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const item of seq.items) {
    const ids = item.dataSet;
    if (!ids) continue;
    const x0 = seqNumber(ids, "x00186018");
    const y0 = seqNumber(ids, "x0018601a");
    const x1 = seqNumber(ids, "x0018601c");
    const y1 = seqNumber(ids, "x0018601e");
    if (x0 == null || y0 == null || x1 == null || y1 == null) continue;
    if (x1 <= x0 || y1 <= y0) continue;
    minX = Math.min(minX, x0);
    minY = Math.min(minY, y0);
    maxX = Math.max(maxX, x1);
    maxY = Math.max(maxY, y1);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(maxY)) return null;
  // Bölge neredeyse tüm kareyi kaplıyorsa maskelenecek anlamlı kenar kalmaz.
  const nx0 = minX / cols;
  const ny0 = minY / rows;
  const nx1 = Math.min(1, maxX / cols);
  const ny1 = Math.min(1, maxY / rows);
  const rects: Rect[] = [];
  const EPS = 0.004; // < %0.4 kenar: gürültü, maskeleme anlamsız
  if (ny0 > EPS) rects.push({ x: 0, y: 0, w: 1, h: ny0 });
  if (ny1 < 1 - EPS) rects.push({ x: 0, y: ny1, w: 1, h: 1 - ny1 });
  if (nx0 > EPS) rects.push({ x: 0, y: ny0, w: nx0, h: Math.max(0, ny1 - ny0) });
  if (nx1 < 1 - EPS) rects.push({ x: nx1, y: ny0, w: 1 - nx1, h: Math.max(0, ny1 - ny0) });
  return rects.length ? rects : null;
}

/**
 * Dosyayı okuyup otomatik maske kurallarını uygular. Parse edilemeyen dosyada THROW etmez —
 * boş analiz döner; asıl fail-closed kararı tag-strip/piksel katmanındadır.
 */
export function analyzeBurnIn(input: ArrayBuffer): BurnInAnalysis {
  const empty: BurnInAnalysis = {
    autoRects: [], declaredBurnedIn: false, highRisk: false, notes: [], modality: "", rows: 0, cols: 0,
  };
  let ds: dicomParser.DataSet;
  try {
    ds = dicomParser.parseDicom(new Uint8Array(input));
  } catch {
    return empty;
  }
  const rows = ds.uint16("x00280010") || 0;
  const cols = ds.uint16("x00280011") || 0;
  if (!rows || !cols) return empty;

  const modality = (ds.string("x00080060") || "").trim().toUpperCase();
  const declaredBurnedIn = (ds.string("x00280301") || "").trim().toUpperCase() === "YES";
  const notes: string[] = [];
  const autoRects: Rect[] = [];

  if (modality === "US") {
    const outside = ultrasoundOutsideRects(ds, rows, cols);
    if (outside) {
      autoRects.push(...outside);
      notes.push("Ultrason: cihazın görüntü alanı dışında kalan arayüz şeritleri otomatik kapatıldı.");
    } else {
      autoRects.push({ x: 0, y: 0, w: 1, h: US_TOP_BAND });
      notes.push("Ultrason: cihaz görüntü alanı bildirilmemiş — üst bilgi şeridi otomatik kapatıldı.");
    }
  }

  const highRisk = SCREEN_MODALITIES.has(modality);
  if (highRisk) {
    autoRects.push({ x: 0, y: 0, w: 1, h: SC_TOP_BAND });
    notes.push("Ekran görüntüsü / fotoğraf türü kayıt: yazılar görüntünün her yerinde olabilir — lütfen tüm kareyi kontrol edin.");
  }
  if (declaredBurnedIn) {
    notes.push("Dosya, üzerinde yazı bulunduğunu kendi etiketinde bildiriyor (BurnedInAnnotation = YES).");
  }
  if (!autoRects.length) {
    notes.push("Bu görüntü tipi için otomatik kural yok — yazı görüyorsanız kendiniz kutu çizin.");
  }

  return { autoRects, declaredBurnedIn, highRisk, notes, modality, rows, cols };
}

/** İki kutu listesini birleştirir (otomatik + kullanıcı); geçersiz/boş kutular elenir. */
export function normalizeRects(input: unknown, limit = 40): Rect[] {
  if (!Array.isArray(input)) return [];
  const out: Rect[] = [];
  for (const r of input.slice(0, limit)) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const x = Number(o.x);
    const y = Number(o.y);
    const w = Number(o.w);
    const h = Number(o.h);
    if (![x, y, w, h].every((n) => Number.isFinite(n))) continue;
    const cx = Math.max(0, Math.min(1, x));
    const cy = Math.max(0, Math.min(1, y));
    const cw = Math.max(0, Math.min(1 - cx, w));
    const ch = Math.max(0, Math.min(1 - cy, h));
    if (cw < 0.002 || ch < 0.002) continue; // nokta/çizgi artığı — anlamlı maske değil
    out.push({ x: cx, y: cy, w: cw, h: ch });
  }
  return out;
}
