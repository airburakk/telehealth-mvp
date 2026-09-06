// TUS KURUM TABLOSU (K2, 2026-09-06) — SAF yardımcılar: bir branşın kurum satırları + son 3 dönem en küçük puan eğilimi + ek yerleştirme
// eşlemesi + süzgeç/sıralama. Veri lib/tus-data'dan (tusRowsFor / tusEkRowsFor) gelir; burada DB/fetch yok.
// İDDİA DÜRÜSTLÜĞÜ: satırlar ÖSYM'nin yayımladığı sayılardır; eğilim = geçmiş dönemlerin en küçük puanı (tahmin/uydurma YOK);
// kurum türü Doctorium sınıflamasıdır (UI notu). Eşleme anahtarı program KODU; kod değişmişse kurum+branş+kontenjan türü ile eşlenir.
import type { TusInstitutionType, TusQuotaType, TusRow } from "./tus-normalize";

export interface InstitutionRow {
  code: string;
  institution: string;
  institutionType: TusInstitutionType;
  quotaType: TusQuotaType;
  quota: number;
  placed: number;
  vacant: number;
  minScore: number | null;
  maxScore: number | null;
  /** Son dönemler en küçük puanı — eskiden yeniye, SON eleman = seçili dönem (uzunluk = 1 + verilen geçmiş dönem sayısı). */
  trend: (number | null)[];
  /** Aynı dönemin ek yerleştirmesi (varsa): ek kontenjan (boş kalan), yerleşen, kalan, puanlar. */
  ek: { quota: number; placed: number; vacant: number; minScore: number | null; maxScore: number | null } | null;
}

export type InstitutionSort = "min" | "quota" | "vacant" | "name";
export interface InstitutionFilter {
  type?: TusInstitutionType | "ALL";
  quotaType?: TusQuotaType | "ALL";
  q?: string;
  sort?: InstitutionSort;
}

const norm = (s: string) => s.toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();
const altKey = (r: TusRow) => `${norm(r.institution)}|${r.branch}|${r.quotaType}`;

function indexRows(rows: readonly TusRow[]) {
  const byCode = new Map<string, TusRow>(); const byAlt = new Map<string, TusRow>();
  for (const r of rows) { byCode.set(`${r.code}|${r.quotaType}`, r); byAlt.set(altKey(r), r); }
  return { byCode, byAlt };
}
function match(idx: ReturnType<typeof indexRows>, r: TusRow): TusRow | null {
  return idx.byCode.get(`${r.code}|${r.quotaType}`) ?? idx.byAlt.get(altKey(r)) ?? null;
}

/**
 * Bir branş için kurum tablosu.
 * @param current   seçili dönemin TÜM satırları (tusRowsFor)
 * @param previous  önceki dönemlerin satırları, ESKİDEN YENİYE (en fazla 2 dönem beklenir; boş dizi olabilir)
 * @param ek        seçili dönemin ek yerleştirme satırları (yoksa null)
 */
export function buildInstitutionTable(
  branch: string,
  current: readonly TusRow[],
  previous: readonly (readonly TusRow[])[],
  ek: readonly TusRow[] | null,
  filter: InstitutionFilter = {},
): InstitutionRow[] {
  const rows = current.filter((r) => r.branch === branch);
  const prevIdx = previous.map((p) => indexRows(p.filter((r) => r.branch === branch)));
  const ekIdx = ek ? indexRows(ek.filter((r) => r.branch === branch)) : null;
  const q = filter.q ? norm(filter.q) : "";
  let out: InstitutionRow[] = rows
    .filter((r) => (!filter.type || filter.type === "ALL" || r.institutionType === filter.type))
    .filter((r) => (!filter.quotaType || filter.quotaType === "ALL" || r.quotaType === filter.quotaType))
    .filter((r) => !q || norm(r.institution).includes(q))
    .map((r) => {
      const trend = [...prevIdx.map((idx) => match(idx, r)?.minScore ?? null), r.minScore];
      const e = ekIdx ? match(ekIdx, r) : null;
      return {
        code: r.code, institution: r.institution, institutionType: r.institutionType, quotaType: r.quotaType,
        quota: r.quota, placed: r.placed, vacant: r.vacant, minScore: r.minScore, maxScore: r.maxScore, trend,
        ek: e ? { quota: e.quota, placed: e.placed, vacant: e.vacant, minScore: e.minScore, maxScore: e.maxScore } : null,
      };
    });
  const sort = filter.sort ?? "min";
  const byName = (a: InstitutionRow, b: InstitutionRow) => a.institution.localeCompare(b.institution, "tr-TR");
  if (sort === "min") out = out.sort((a, b) => (b.minScore ?? -1) - (a.minScore ?? -1) || byName(a, b));
  else if (sort === "quota") out = out.sort((a, b) => b.quota - a.quota || byName(a, b));
  else if (sort === "vacant") out = out.sort((a, b) => b.vacant - a.vacant || byName(a, b));
  else out = out.sort(byName);
  return out;
}

/** Tablo altı özet: kurum sayısı, toplam kontenjan/yerleşen/boş, ek yerleştirmeyle dolan. */
export function summarizeInstitutionTable(rows: readonly InstitutionRow[]) {
  const quota = rows.reduce((n, r) => n + r.quota, 0), placed = rows.reduce((n, r) => n + r.placed, 0);
  const ekPlaced = rows.reduce((n, r) => n + (r.ek?.placed ?? 0), 0);
  const withEk = rows.filter((r) => r.ek).length;
  return { institutions: new Set(rows.map((r) => r.institution)).size, programs: rows.length, quota, placed, vacant: quota - placed, ekPlaced, withEk };
}

/** URL sorgu değerini güvenli daralt. */
export function parseInstitutionType(v: string | undefined): TusInstitutionType | "ALL" {
  const ok: TusInstitutionType[] = ["UNIVERSITE", "SBU_EAH", "SEHIR_HASTANESI", "EAH", "ADLI_TIP", "DIGER"];
  return v && (ok as string[]).includes(v) ? (v as TusInstitutionType) : "ALL";
}
export function parseQuotaType(v: string | undefined): TusQuotaType | "ALL" {
  return v === "GENEL" || v === "YABANCI" ? v : "ALL";
}
export function parseSort(v: string | undefined): InstitutionSort {
  return v === "quota" || v === "vacant" || v === "name" ? v : "min";
}
