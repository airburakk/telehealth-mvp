// YÖK ATLAS — Tıp lisans programları NORMALİZASYONU (K5, 2026-09-05). SAF modül (fetch/fs/DB yok); ingest betiği + UI özetleri kullanır.
//
// KAYNAK: YÖK Atlas "Tercih Sihirbazı" arama API'si (`POST https://yokatlas.yok.gov.tr/api/tercih-kilavuz/search`, gövde `{}` → TÜM
// programlar tek yanıtta, ~21.500 kayıt / ~87 MB). Sayfanın kendi dipnotu: "Bilgiler <yıl>-YKS Yükseköğretim Programları ve Kontenjanları
// Kılavuzu'ndan derlenmiş olup nihai kontrol ÖSYM'nin güncel kılavuzundan yapılmalıdır." Kontenjan/koşul = ÖSYM kılavuzu; taban puan
// (minPuan) ve başarı sırası (basariSirasi) = o yılın YKS yerleştirme sonucu; gk1/minPuan1/basariSirasi1 … gk3/… = 1–3 yıl öncesi.
// ⚠️ YAYIMLANMAYAN alanlar (etiketi doğrulanamadı → dürüstlük): `tustt1`, `tusktp`, `kpss1` (yalnız kayıtların bir kısmında dolu; uygulama
// kaynağında etiket bulunamadı), `ucret` (kurs/kaynakça fiyat yasağıyla tutarlı olsun diye alınmaz), okul birincisi / şehit-gazi
// kontenjanları (`kontenjanObs/obkY/kontenjanSgy/sgyY`), koşul metinleri.
// 🪤 minPuan1..3 API'de STRING gelir ("533.46922"; "0" = veri yok), minPuan (cari yıl) SAYI; basariSirasi1..3 int|null.

export type YokUniType = "DEVLET" | "VAKIF" | "KKTC" | "YURTDISI";
export const YOK_UNI_TYPE_LABEL: Record<YokUniType, string> = { DEVLET: "Devlet", VAKIF: "Vakıf", KKTC: "KKTC", YURTDISI: "Yurt dışı" };

/** API kaydının kullanılan alt kümesi (gelen nesnede çok daha fazla alan var). */
export interface YokAtlasRaw {
  kilavuzKodu: number;
  yil?: number;
  birimGrupAdi?: string;
  universiteAdi: string;
  universiteTuru: string;
  ilAdi?: string | null;
  fymkAdi?: string | null;
  birimAdi: string;
  ogrenimDiliAdi?: string | null;
  bursOraniAdi?: string | null;
  ogrenimSuresi?: number | null;
  kontenjan?: number | null;
  gkY?: number | null;
  minPuan?: number | string | null;
  basariSirasi?: number | null;
  gk1?: number | null; minPuan1?: number | string | null; basariSirasi1?: number | null;
  gk2?: number | null; minPuan2?: number | string | null; basariSirasi2?: number | null;
  gk3?: number | null; minPuan3?: number | string | null; basariSirasi3?: number | null;
  prof?: number | null; doc?: number | null; dou?: number | null; ogrGor?: number | null; arGor?: number | null;
  akreditasyon?: string | null;
}

export interface YokHistoryPoint {
  /** Kaç yıl önce (1 = geçen yıl). */
  yearsBack: 1 | 2 | 3;
  quota: number | null;
  minScore: number | null;
  rank: number | null;
}

export interface YokStaff { prof: number; doc: number; dou: number; ogrGor: number; arGor: number }

export interface YokTipProgramRow {
  /** ÖSYM program kodu — KİMLİK (yıllar arası eşleştirme anahtarı). */
  code: number;
  university: string;
  type: YokUniType;
  city: string | null;
  faculty: string | null;
  program: string;
  language: string | null;
  /** Vakıf/KKTC: Burslu · %50 İndirimli · Ücretli …; devlette null. */
  scholarship: string | null;
  quota: number;
  placed: number;
  minScore: number | null;
  rank: number | null;
  history: YokHistoryPoint[];
  /** Öğretim elemanı sayıları (YÖK Atlas); verilmemişse null. */
  staff: YokStaff | null;
  accreditation: string | null;
}

export function parseScore(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function classifyUniType(v: string | null | undefined): YokUniType {
  const s = (v ?? "").toUpperCase().replace("İ", "I").replace("Ş", "S");
  if (s === "DEVLET") return "DEVLET";
  if (s === "VAKIF") return "VAKIF";
  if (s === "KKTC") return "KKTC";
  return "YURTDISI";
}

const int = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function normalizeRow(r: YokAtlasRaw): YokTipProgramRow {
  const hist: YokHistoryPoint[] = [
    { yearsBack: 1, quota: int(r.gk1), minScore: parseScore(r.minPuan1), rank: int(r.basariSirasi1) },
    { yearsBack: 2, quota: int(r.gk2), minScore: parseScore(r.minPuan2), rank: int(r.basariSirasi2) },
    { yearsBack: 3, quota: int(r.gk3), minScore: parseScore(r.minPuan3), rank: int(r.basariSirasi3) },
  ];
  const staffVals = [r.prof, r.doc, r.dou, r.ogrGor, r.arGor].map(int);
  const staff = staffVals.some((v) => v !== null)
    ? { prof: staffVals[0] ?? 0, doc: staffVals[1] ?? 0, dou: staffVals[2] ?? 0, ogrGor: staffVals[3] ?? 0, arGor: staffVals[4] ?? 0 }
    : null;
  return {
    code: r.kilavuzKodu,
    university: r.universiteAdi.trim(),
    type: classifyUniType(r.universiteTuru),
    city: r.ilAdi?.trim() || null,
    faculty: r.fymkAdi?.trim() || null,
    program: r.birimAdi.trim(),
    language: r.ogrenimDiliAdi?.trim() || null,
    scholarship: r.bursOraniAdi?.trim() || null,
    quota: int(r.kontenjan) ?? 0,
    placed: int(r.gkY) ?? 0,
    minScore: parseScore(r.minPuan),
    rank: int(r.basariSirasi),
    history: hist,
    staff,
    accreditation: r.akreditasyon?.trim() || null,
  };
}

/** Yalnız Tıp lisans programları (birimGrupAdi tam eşleşme — "Tıp Mühendisliği" vb. dışarıda). */
export const isTipProgram = (r: { birimGrupAdi?: string }) => r.birimGrupAdi === "Tıp";

export interface YokTipSummary {
  year: number;
  programs: number;
  faculties: number;
  universities: number;
  totals: { quota: number; placed: number; vacant: number };
  byType: { type: YokUniType; programs: number; quota: number; placed: number }[];
  /** Giriş kontenjanı yıllara göre (cari yıl + 3 önceki; API'nin gk1..gk3 alanlarından). */
  quotaByYear: { year: number; quota: number; programs: number }[];
  /** Cari yıl taban puanı olan devlet programlarının medyan/min/max başarı sırası. */
  rankStats: { type: YokUniType; n: number; min: number; median: number; max: number }[];
  accredited: number;
  /** İl başına kontenjan (en çok 12 il, kalanı "Diğer"). */
  byCity: { city: string; quota: number; programs: number }[];
}

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export function summarizeYok(year: number, rows: readonly YokTipProgramRow[]): YokTipSummary {
  const types: YokUniType[] = ["DEVLET", "VAKIF", "KKTC", "YURTDISI"];
  const byType = types.map((t) => {
    const rs = rows.filter((r) => r.type === t);
    return { type: t, programs: rs.length, quota: rs.reduce((n, r) => n + r.quota, 0), placed: rs.reduce((n, r) => n + r.placed, 0) };
  }).filter((x) => x.programs > 0);
  const quota = rows.reduce((n, r) => n + r.quota, 0), placed = rows.reduce((n, r) => n + r.placed, 0);
  const quotaByYear = [3, 2, 1].map((yb) => {
    const pts = rows.map((r) => r.history.find((h) => h.yearsBack === yb)?.quota ?? null).filter((q): q is number => q !== null);
    return { year: year - yb, quota: pts.reduce((n, q) => n + q, 0), programs: pts.length };
  });
  quotaByYear.push({ year, quota, programs: rows.length });
  const rankStats = types.map((t) => {
    const xs = rows.filter((r) => r.type === t && r.rank !== null).map((r) => r.rank as number);
    return xs.length ? { type: t, n: xs.length, min: Math.min(...xs), median: median(xs), max: Math.max(...xs) } : null;
  }).filter((x): x is NonNullable<typeof x> => x !== null);
  const cityMap = new Map<string, { city: string; quota: number; programs: number }>();
  for (const r of rows) {
    const c = r.city ?? "—"; const cur = cityMap.get(c) ?? { city: c, quota: 0, programs: 0 };
    cur.quota += r.quota; cur.programs += 1; cityMap.set(c, cur);
  }
  const cities = [...cityMap.values()].sort((a, b) => b.quota - a.quota);
  const top = cities.slice(0, 12); const rest = cities.slice(12);
  if (rest.length) top.push({ city: "Diğer", quota: rest.reduce((n, c) => n + c.quota, 0), programs: rest.reduce((n, c) => n + c.programs, 0) });
  return {
    year, programs: rows.length,
    faculties: new Set(rows.map((r) => `${r.university}|${r.faculty ?? ""}`)).size,
    universities: new Set(rows.map((r) => r.university)).size,
    totals: { quota, placed, vacant: quota - placed },
    byType, quotaByYear, rankStats,
    accredited: rows.filter((r) => r.accreditation).length,
    byCity: top,
  };
}
