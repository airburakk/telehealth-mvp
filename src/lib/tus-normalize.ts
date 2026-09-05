// TUS yerleştirme verisi — NORMALİZASYON (veri fazları planı A.2 / K1, 2026-09-05). SAF modül: hem ingest betiği
// (scripts/tus-ingest.ts, tsx) hem sunucu/grafik tarafı okur. DB/React yok.
//
// Kaynak: ÖSYM "Yerleştirme Sonuçlarına İlişkin En Küçük ve En Büyük Puanlar" PDF'i (dönem başına ~3.000 satır):
//   Program Kodu · "Kurum adı/BRANŞ" · Kontenjan Türü (Genel | Yabancı Uyruklu) · Kontenjan · Yerleşen · Boş · En Küçük · En Büyük
// Program adı "Kurum/BRANŞ" biçimindedir; branş SON "/"tan sonra BÜYÜK HARF gelir (kurum adında da "/" olabilir —
// "Gülhane Tıp Fakültesi, Gülhane Eğitim ve Araştırma Hastanesi (ANKARA)/KARDİYOLOJİ").
//
// İDDİA DÜRÜSTLÜĞÜ: burada hiçbir satır uydurulmaz; sınıflandırma (kurum türü) sezgiseldir ve UI'da "kurum türü
// sınıflaması Doctorium'un gruplamasıdır" notuyla sunulur. Puanlar ÖSYM'nin virgüllü ondalığından sayıya çevrilir;
// "--" (yerleşen yok) → null.

export type TusQuotaType = "GENEL" | "YABANCI";
export type TusInstitutionType = "UNIVERSITE" | "SBU_EAH" | "SEHIR_HASTANESI" | "EAH" | "ADLI_TIP" | "DIGER";

export const TUS_INSTITUTION_LABEL: Record<TusInstitutionType, string> = {
  UNIVERSITE: "Üniversite tıp fakültesi",
  SBU_EAH: "SBÜ eğitim ve araştırma hastanesi",
  SEHIR_HASTANESI: "Şehir hastanesi",
  EAH: "Eğitim ve araştırma hastanesi (diğer)",
  ADLI_TIP: "Adli Tıp Kurumu",
  DIGER: "Diğer kurum",
};

/** Kompakt satır — JSON'da dizi olarak saklanır (10 dönem × ~3.000 satır; nesne anahtarları şişirir). */
export type TusRowTuple = [
  code: string,           // program kodu
  institution: string,    // kurum adı (branş ayrıldıktan sonra, kırpılmış)
  branch: string,         // branş — KANONİK BÜYÜK HARF (ÖSYM yazımı)
  quotaType: TusQuotaType,
  quota: number,
  placed: number,
  vacant: number,
  minScore: number | null,
  maxScore: number | null,
];

export interface TusRow {
  code: string; institution: string; institutionType: TusInstitutionType; branch: string; branchLabel: string;
  quotaType: TusQuotaType; quota: number; placed: number; vacant: number; minScore: number | null; maxScore: number | null;
}

/** Türkçe başlık hâli: "İÇ HASTALIKLARI" → "İç Hastalıkları" (I→ı, İ→i; bağlaçlar küçük). */
export function titleCaseTr(s: string): string {
  const small = new Set(["ve", "ile", "veya", "için"]);
  return s
    .toLocaleLowerCase("tr-TR")
    .split(/(\s+|-|\/|\()/)
    .map((w) => {
      if (!w || /^(\s+|-|\/|\()$/.test(w)) return w;
      if (small.has(w)) return w;
      return w.charAt(0).toLocaleUpperCase("tr-TR") + w.slice(1);
    })
    .join("");
}

/** "Kurum adı/BRANŞ" → { institution, branch } — son "/" ayracı; branş büyük harfe normalize (ÖSYM zaten büyük yazar). */
export function splitProgramName(name: string): { institution: string; branch: string } {
  const i = name.lastIndexOf("/");
  if (i < 0) return { institution: name.trim(), branch: "" };
  return { institution: name.slice(0, i).trim().replace(/\s+/g, " "), branch: name.slice(i + 1).trim().replace(/\s+/g, " ").toLocaleUpperCase("tr-TR") };
}

/** Kurum türü — sezgisel (Doctorium gruplaması). Sıra ÖNEMLİ: SBÜ EAH, "Üniversitesi" içerir. */
export function classifyInstitution(institution: string): TusInstitutionType {
  const s = institution.toLocaleLowerCase("tr-TR");
  if (s.includes("adli tıp kurumu")) return "ADLI_TIP";
  if (s.includes("şehir hastanesi")) return "SEHIR_HASTANESI";
  if (s.includes("sağlık bilimleri üniversitesi") && (s.includes("eğitim ve araştırma hastanesi") || s.includes("hastanesi"))) return "SBU_EAH";
  if (s.includes("eğitim ve araştırma hastanesi")) return "EAH";
  if (s.includes("üniversitesi")) return "UNIVERSITE";
  return "DIGER";
}

/** ÖSYM ondalığı "60,83174" → 60.83174; "--" → null. */
export function parseScore(s: string): number | null {
  const t = s.trim();
  if (!t || t === "--" || t === "-") return null;
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// Satır kuyruğu (2022/1 → bugün, "dar" düzen): <Genel|Yabancı Uyruk(lu)> <kontenjan> <yerleşen[*]> <boş> <min|--> <max|-->
//   · 2022/1–2023/1 PDF'lerinde tür "Yabancı Uyruk" (eksiz) yazılır · 2024/2'den itibaren yerleşen "5*" (dipnot: eşit puan/ek
//     yerleşme) olabilir; 2021 düzeninde yıldız sayıdan ÖNCE de gelir ("3 *0") → yıldız yutulur, sayı alınır.
const TAIL = /\s(Genel|Yabancı Uyruk(?:lu)?)\s+\*?(\d+)\*?\s+\*?(\d+)\*?\s+\*?(\d+)\*?\s+(--|\d+,\d+)\s+(--|\d+,\d+)\s*$/u;
// 2021 "geniş" düzen (tek satırda iki blok): <tablo> <G kont> <G yer> <G boş> <G min> <G max> <Y kont> <Y yer> <Y boş> <Y min> <Y max>
//   — boş blok "--" ile doldurulur ("2 -- -- -- -- -- 2 2 0 50,16 62,79" = yalnız yabancı uyruklu kontenjan).
// 🪤 String içinde regex: kaçışlar ÇİFT ters bölü ister ("\\d"); tek "\d" JS'te "d" olur ve "Nothing to repeat" ile patlar.
const NUM = "(?:--|\\*?\\d+\\*?)"; const SCORE = "(?:--|\\d+,\\d+)";
const BLOCK = `(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${SCORE})\\s+(${SCORE})`;
const TAIL_WIDE = new RegExp(`\\s(\\d+)\\s+${BLOCK}\\s+${BLOCK}\\s*$`, "u");
const HEAD = /^(\d{6,})\s+(.*)$/u;

const num = (s: string) => Number(s.replace(/\*/g, ""));

/**
 * Metin satırlarından (unpdf çıktısı, boşluk normalize) program satırlarını çıkarır. Uzun program adları PDF'te alt
 * satıra sarabilir → program koduyla başlayan bir satır kuyruğu tamamlanana kadar sonraki satırlarla birleştirilir.
 * İki düzen tanınır (dar: 2022/1+ · geniş: 2021). Kuyruk hiç oturmazsa satır ATLANIR ve `skipped`e yazılır (sessiz yanlış veri yok).
 */
export function parseMinMaxLines(lines: readonly string[]): { rows: TusRowTuple[]; skipped: string[] } {
  const rows: TusRowTuple[] = []; const skipped: string[] = [];
  let buf: string | null = null;
  const flush = () => { if (buf) { skipped.push(buf); buf = null; } };
  const emit = (head: RegExpMatchArray, quotaType: TusQuotaType, q: string, pl: string, v: string, mn: string, mx: string) => {
    const { institution, branch } = splitProgramName(head[2]);
    if (!branch) return false;
    rows.push([head[1], institution, branch, quotaType, num(q), num(pl), num(v), parseScore(mn), parseScore(mx)]);
    return true;
  };
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line) continue;
    if (HEAD.test(line)) { flush(); buf = line; }
    else if (buf) buf = `${buf} ${line}`;
    else continue;
    const m = buf.match(TAIL);
    if (m) {
      const head = buf.slice(0, buf.length - m[0].length).match(HEAD);
      if (head && emit(head, m[1] === "Genel" ? "GENEL" : "YABANCI", m[2], m[3], m[4], m[5], m[6])) { buf = null; continue; }
      flush(); continue;
    }
    const w = buf.match(TAIL_WIDE);
    if (w) {
      const head = buf.slice(0, buf.length - w[0].length).match(HEAD);
      let ok = false;
      if (head) {
        if (w[2] !== "--") ok = emit(head, "GENEL", w[2], w[3], w[4], w[5], w[6]) || ok;
        if (w[7] !== "--") ok = emit(head, "YABANCI", w[7], w[8], w[9], w[10], w[11]) || ok;
      }
      if (ok) { buf = null; continue; }
      flush(); continue;
    }
    if (buf.length > 700) flush();
  }
  flush();
  return { rows, skipped };
}

export function rowFromTuple(t: TusRowTuple): TusRow {
  const [code, institution, branch, quotaType, quota, placed, vacant, minScore, maxScore] = t;
  return { code, institution, institutionType: classifyInstitution(institution), branch, branchLabel: titleCaseTr(branch), quotaType, quota, placed, vacant, minScore, maxScore };
}

// ── Özetler (grafik girdisi) ────────────────────────────────────────────────────────────────────
export interface TusBranchSummary {
  branch: string; branchLabel: string;
  quota: number; placed: number; vacant: number;
  /** GENEL kontenjanda yerleşen olan programların en küçük puanlarının minimumu / medyanı (yerleşen 0 satırlar hariç). */
  minScore: number | null; medianMinScore: number | null; maxScore: number | null;
  programs: number;
}
export interface TusTypeSummary { type: TusInstitutionType; quota: number; placed: number; vacant: number; programs: number }
export interface TusPeriodSummary {
  year: number; term: 1 | 2; rows: number;
  totals: { quota: number; placed: number; vacant: number; general: { quota: number; placed: number; vacant: number }; foreign: { quota: number; placed: number; vacant: number } };
  byType: TusTypeSummary[];
  byBranch: TusBranchSummary[];
  /** GENEL en küçük puan histogramı (5 puanlık kovalar, [alt, adet]). */
  minScoreHistogram: [number, number][];
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function summarizePeriod(year: number, term: 1 | 2, tuples: readonly TusRowTuple[]): TusPeriodSummary {
  const rows = tuples.map(rowFromTuple);
  const tot = (rs: TusRow[]) => rs.reduce((a, r) => ({ quota: a.quota + r.quota, placed: a.placed + r.placed, vacant: a.vacant + r.vacant }), { quota: 0, placed: 0, vacant: 0 });
  const general = rows.filter((r) => r.quotaType === "GENEL"); const foreign = rows.filter((r) => r.quotaType === "YABANCI");
  const byTypeMap = new Map<TusInstitutionType, TusTypeSummary>();
  for (const r of general) {
    const t = byTypeMap.get(r.institutionType) ?? { type: r.institutionType, quota: 0, placed: 0, vacant: 0, programs: 0 };
    t.quota += r.quota; t.placed += r.placed; t.vacant += r.vacant; t.programs += 1; byTypeMap.set(r.institutionType, t);
  }
  const byBranchMap = new Map<string, TusRow[]>();
  for (const r of general) { const arr = byBranchMap.get(r.branch) ?? []; arr.push(r); byBranchMap.set(r.branch, arr); }
  const byBranch: TusBranchSummary[] = [...byBranchMap.entries()].map(([branch, rs]) => {
    const placedMins = rs.filter((r) => r.placed > 0 && r.minScore !== null).map((r) => r.minScore as number);
    const maxes = rs.filter((r) => r.maxScore !== null).map((r) => r.maxScore as number);
    const t = tot(rs);
    return { branch, branchLabel: titleCaseTr(branch), ...t, minScore: placedMins.length ? Math.min(...placedMins) : null, medianMinScore: median(placedMins), maxScore: maxes.length ? Math.max(...maxes) : null, programs: rs.length };
  }).sort((a, b) => b.quota - a.quota);
  const hist = new Map<number, number>();
  for (const r of general) if (r.placed > 0 && r.minScore !== null) { const b = Math.floor(r.minScore / 5) * 5; hist.set(b, (hist.get(b) ?? 0) + 1); }
  return {
    year, term, rows: rows.length,
    totals: { ...tot(rows), general: tot(general), foreign: tot(foreign) },
    byType: [...byTypeMap.values()].sort((a, b) => b.quota - a.quota),
    byBranch,
    minScoreHistogram: [...hist.entries()].sort((a, b) => a[0] - b[0]),
  };
}
