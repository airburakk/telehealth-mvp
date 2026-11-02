// Herkese açık TUS sayfası — SAF görünüm modeli (v6.358, 2026-10-29). Girdi: onaylı dönem özetleri (lib/tus-data approvedTusSummaries)
// + istenen dönem anahtarı; çıktı: sayfanın çizdiği her şey. DB/ağ YOK → birim testte doğrudan sınanır.
// Kurallar: yalnız onaylı dönem (çağıran onaylı listeyi verir; burada tekrar süzülmez ama BİLİNMEYEN anahtar son döneme düşer) ·
// sıralama/yorum YOK (kontenjana göre sıra = ÖSYM tablosundaki büyüklük, "en iyi dal" anlamı taşımaz) · eğilim = yalnız sayılar.
import { periodLabel, type TusPeriodSummaryWithSource } from "@/lib/tus-data";

export interface TusPublicBranchRow {
  branch: string;
  label: string;
  quota: number;
  placed: number;
  vacant: number;
  minScore: number | null;
  medianMinScore: number | null;
  maxScore: number | null;
  programs: number;
  /** Seçili dönem ve önceki en çok iki dönemin en küçük puanı — `trendKeys` ile aynı sıra (eski → yeni); dal o dönemde yoksa null. */
  trend: (number | null)[];
}

export interface TusPublicView {
  period: TusPeriodSummaryWithSource;
  periodLabel: string;
  /** Dönem seçici — yeni → eski. */
  options: { key: string; label: string; selected: boolean }[];
  rows: TusPublicBranchRow[];
  trendKeys: { key: string; label: string }[];
  /** Kapsanan ilk/son dönem (JSON-LD temporalCoverage + metin). */
  first: TusPeriodSummaryWithSource;
  last: TusPeriodSummaryWithSource;
  /** Seçili dönem son dönem değilse canonical/varsayılandan farklıdır (sayfa yine köke canonical verir). */
  isLatest: boolean;
}

/** `?donem=` değerini onaylı anahtara çözer; geçersiz/eksik → null (son dönem). Dizi gelirse ilk değer. */
export function parsePeriodParam(raw: string | string[] | undefined, periods: readonly TusPeriodSummaryWithSource[]): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return null;
  return periods.some((p) => p.key === v) ? v : null;
}

export function buildTusPublicView(periods: readonly TusPeriodSummaryWithSource[], requestedKey: string | null): TusPublicView | null {
  if (periods.length === 0) return null;
  const last = periods[periods.length - 1];
  const idx = requestedKey ? periods.findIndex((p) => p.key === requestedKey) : -1;
  const selIdx = idx >= 0 ? idx : periods.length - 1;
  const period = periods[selIdx];
  const trendPeriods = periods.slice(Math.max(0, selIdx - 2), selIdx + 1);
  const trendMaps = trendPeriods.map((p) => new Map(p.byBranch.map((b) => [b.branch, b.minScore])));
  const rows = [...period.byBranch]
    .sort((a, b) => b.quota - a.quota || a.branchLabel.localeCompare(b.branchLabel, "tr"))
    .map((b) => ({
      branch: b.branch,
      label: b.branchLabel,
      quota: b.quota,
      placed: b.placed,
      vacant: b.vacant,
      minScore: b.minScore,
      medianMinScore: b.medianMinScore,
      maxScore: b.maxScore,
      programs: b.programs,
      trend: trendMaps.map((m) => m.get(b.branch) ?? null),
    }));
  return {
    period,
    periodLabel: periodLabel(period.year, period.term),
    options: [...periods].reverse().map((p) => ({ key: p.key, label: periodLabel(p.year, p.term), selected: p.key === period.key })),
    rows,
    trendKeys: trendPeriods.map((p) => ({ key: p.key, label: periodLabel(p.year, p.term) })),
    first: periods[0],
    last,
    isLatest: period.key === last.key,
  };
}

/** Puan biçimi: iki ondalık, Türkçe (45,02). null → null (çağıran "—" çizer). */
export function formatScore(v: number | null): string | null {
  return v === null ? null : v.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** JSON-LD Dataset nesnesi — yalnız onaylı dönemlerin kaynak sayfalarına dayanır (isBasedOn). Lisans alanı YOK (ölçülmedi). */
export function tusDatasetJsonLd(
  periods: readonly TusPeriodSummaryWithSource[],
  url: string,
  text: { name: string; description: string },
): Record<string, unknown> | null {
  if (periods.length === 0) return null;
  const first = periods[0];
  const last = periods[periods.length - 1];
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: text.name,
    description: text.description,
    url,
    inLanguage: "tr",
    temporalCoverage: `${first.year}/${last.year}`,
    spatialCoverage: { "@type": "Country", name: "Türkiye" },
    isBasedOn: [...new Set(periods.map((p) => p.sourcePage))],
    variableMeasured: ["Kontenjan", "Yerleşen", "Boş kalan", "En küçük puan", "Medyan en küçük puan", "En büyük puan"],
    creator: { "@type": "Organization", name: "Doctorium", url: "https://doctorium.tr" },
    dateModified: [...periods.map((p) => p.fetchedAt)].sort().at(-1),
  };
}
