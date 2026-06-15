// İşlem (prosedür) kataloğu — T.C. Sağlık Bakanlığı KSHFT (EK-2) tarifesinden derlendi.
// 30 klinik branşa + "others" (tanı/lab/radyoloji/idari) bölünmüştür.
// price = TABAN fiyat (resmi tarife, ₺). TAVAN = taban × CEIL_MULT (uygulamada hesaplanır).
// Doktor (M5) kendi branşındaki işlemleri seçer ve taban↔tavan arası kendi fiyatını belirler.
import catalog from "@/data/procedures.json";

export const CEIL_MULT = 3; // tavan = taban × 3

export interface Procedure {
  code: string;
  name: string;
  price: number | null; // taban (₺)
  branch: string; // branş anahtarı veya "others"
  group: string; // tarifedeki alt-başlık
}

type RawItem = [string, string, number | null, string, string];

const ITEMS: Procedure[] = (catalog.items as RawItem[]).map((t) => ({
  code: t[0],
  name: t[1],
  price: t[2],
  branch: t[3],
  group: t[4],
}));

export const BRANCH_LABELS: Record<string, string> = catalog.branchLabels as Record<string, string>;

// Doctor.branch ETİKET olarak saklanır (ör. "Kardiyoloji") → branş anahtarına çevir.
const KEY_BY_LABEL: Record<string, string> = {};
for (const [key, label] of Object.entries(BRANCH_LABELS)) KEY_BY_LABEL[label] = key;

export function branchKeyFromLabel(label: string | null | undefined): string | null {
  if (!label) return null;
  if (KEY_BY_LABEL[label]) return KEY_BY_LABEL[label];
  // esnek eşleme: birebir tutmazsa normalize ederek dene
  const n = norm(label);
  for (const [lbl, key] of Object.entries(KEY_BY_LABEL)) if (norm(lbl) === n) return key;
  return null;
}

export function branchLabel(key: string): string {
  return BRANCH_LABELS[key] ?? key;
}

// branş anahtarı → indeks
const BY_BRANCH = new Map<string, Procedure[]>();
const BY_CODE = new Map<string, Procedure>();
for (const p of ITEMS) {
  if (!BY_BRANCH.has(p.branch)) BY_BRANCH.set(p.branch, []);
  BY_BRANCH.get(p.branch)!.push(p);
  BY_CODE.set(p.code, p);
}

export function getBranchProcedures(branchKey: string): Procedure[] {
  return BY_BRANCH.get(branchKey) ?? [];
}

export function getByCodes(codes: string[]): Procedure[] {
  const out: Procedure[] = [];
  for (const c of codes) {
    const p = BY_CODE.get(c);
    if (p) out.push(p);
  }
  return out;
}

export function isValidCode(code: string): boolean {
  return BY_CODE.has(code);
}

export function floorPrice(code: string): number | null {
  return BY_CODE.get(code)?.price ?? null;
}

export function ceilPrice(floor: number): number {
  return floor * CEIL_MULT;
}

function norm(s: string): string {
  return s
    .replace(/İ/g, "i").replace(/I/g, "ı").toLowerCase()
    .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i")
    .replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u");
}

// Tüm katalogda (others dahil) ada/koda göre arama — "Diğer havuzundan ekle" için.
export function searchProcedures(q: string, limit = 40): Procedure[] {
  const nq = norm(q.trim());
  if (nq.length < 2) return [];
  const out: Procedure[] = [];
  for (const p of ITEMS) {
    if (norm(p.name).includes(nq) || p.code.toLowerCase().includes(nq)) {
      out.push(p);
      if (out.length >= limit) break;
    }
  }
  return out;
}

export function formatTRY(n: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);
}
