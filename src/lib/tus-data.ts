// TUS yerleştirme verisi — KAYIT DEFTERİ ve yükleyiciler (veri fazları planı A.2 / K1, 2026-09-05). Sunucu tarafı; grafik
// bileşenine SERİLEŞTİRİLMİŞ özet (TusPeriodSummary) prop olarak geçer.
//
// KAYNAK: scripts/tus-ingest.ts → src/data/tus/<yıl>-<dönem>.json (kompakt satırlar) + summary.json (grafik özetleri).
// İNSAN ONAYI: aşağıdaki TUS_SNAPSHOTS'ta `approvedAt` 👤 doldurulmadan o dönem HİÇBİR yüzeyde görünmez (plan: "onaysız satır
// görünmez"). Onay = ingest raporundaki satır/atlanan/toplam sayılarının gözden geçirilmesi (changelog'da kayıt).
// 🪤 Satır dosyaları BÜYÜK (dönem başına ~200 KB) → statik import HARİTASI ile tembel yüklenir (`import()` specifier'ı sabit —
// template literal Turbopack'i kırar); summary.json küçüktür, doğrudan import edilir.
// EK YERLEŞTİRME (K2, 2026-09-06): aynı hat `--kind ek` ile ek-<dönem>.json üretir (kontenjan = ek yerleştirmeye açılan boş kontenjan,
// yerleşen = ek yerleştirmede yerleşen). Ayrı kayıt defteri TUS_EK_SNAPSHOTS (👤 approvedAt); kurum tablosunda "Ek yerleştirme" sütunu.
import summaryJson from "@/data/tus/summary.json";
import type { TusPeriodSummary, TusRowTuple, TusRow } from "./tus-normalize";
import { rowFromTuple } from "./tus-normalize";

export interface TusSnapshotMeta {
  key: string; year: number; term: 1 | 2;
  /** 👤 yayın onayı (ISO gün) — null → gizli. */
  approvedAt: string | null;
}

/** Dönem kayıtları (kronolojik). Onaysız dönem UI'da yok. */
export const TUS_SNAPSHOTS: readonly TusSnapshotMeta[] = [
  { key: "2021-2", year: 2021, term: 2, approvedAt: "2026-09-05" },
  { key: "2022-1", year: 2022, term: 1, approvedAt: "2026-09-05" },
  { key: "2022-2", year: 2022, term: 2, approvedAt: "2026-09-05" },
  { key: "2023-1", year: 2023, term: 1, approvedAt: "2026-09-05" },
  { key: "2023-2", year: 2023, term: 2, approvedAt: "2026-09-05" },
  { key: "2024-1", year: 2024, term: 1, approvedAt: "2026-09-05" },
  { key: "2024-2", year: 2024, term: 2, approvedAt: "2026-09-05" },
  { key: "2025-1", year: 2025, term: 1, approvedAt: "2026-09-05" },
  { key: "2025-2", year: 2025, term: 2, approvedAt: "2026-09-05" },
  { key: "2026-1", year: 2026, term: 1, approvedAt: "2026-09-05" },
];

export type TusPeriodSummaryWithSource = TusPeriodSummary & { sourcePdf: string; sourcePage: string; fetchedAt: string; key: string };

const SUMMARY = summaryJson as { generatedAt: string; periods: (TusPeriodSummary & { sourcePdf: string; sourcePage: string; fetchedAt: string })[] };

export const periodKey = (year: number, term: number) => `${year}-${term}`;
export const periodLabel = (year: number, term: number) => `${year}-TUS ${term}. Dönem`;

/** Onaylı dönem özetleri (kronolojik). */
export function approvedTusSummaries(): TusPeriodSummaryWithSource[] {
  const ok = new Set(TUS_SNAPSHOTS.filter((s) => s.approvedAt).map((s) => s.key));
  return SUMMARY.periods
    .map((p) => ({ ...p, key: periodKey(p.year, p.term) }))
    .filter((p) => ok.has(p.key))
    .sort((a, b) => a.year - b.year || a.term - b.term);
}

export const tusSummaryGeneratedAt = SUMMARY.generatedAt;

/** Onaylı dönemlerde geçen tüm branşlar (kanonik anahtar → etiket), kontenjan toplamına göre. */
export function tusBranches(periods: readonly TusPeriodSummaryWithSource[]): { branch: string; branchLabel: string; quota: number }[] {
  const m = new Map<string, { branch: string; branchLabel: string; quota: number }>();
  for (const p of periods) for (const b of p.byBranch) {
    const cur = m.get(b.branch) ?? { branch: b.branch, branchLabel: b.branchLabel, quota: 0 };
    cur.quota += b.quota; m.set(b.branch, cur);
  }
  return [...m.values()].sort((a, b) => b.quota - a.quota);
}

// Satır dosyaları — sabit specifier'lı tembel import haritası (Turbopack: template literal YASAK).
// JSON modülünün çıkarsanan tipi (string|number|null)[][] — TusRowTuple'a atanamaz; yükleyici `unknown` döner, tusRowsFor daraltır.
const ROW_LOADERS: Record<string, () => Promise<{ default: unknown }>> = {
  "2021-2": () => import("@/data/tus/2021-2.json"),
  "2022-1": () => import("@/data/tus/2022-1.json"),
  "2022-2": () => import("@/data/tus/2022-2.json"),
  "2023-1": () => import("@/data/tus/2023-1.json"),
  "2023-2": () => import("@/data/tus/2023-2.json"),
  "2024-1": () => import("@/data/tus/2024-1.json"),
  "2024-2": () => import("@/data/tus/2024-2.json"),
  "2025-1": () => import("@/data/tus/2025-1.json"),
  "2025-2": () => import("@/data/tus/2025-2.json"),
  "2026-1": () => import("@/data/tus/2026-1.json"),
};

/** Onaylı bir dönemin satırları (kurum × branş); onaysız/bilinmeyen anahtar → []. */
export async function tusRowsFor(key: string): Promise<TusRow[]> {
  const meta = TUS_SNAPSHOTS.find((s) => s.key === key);
  if (!meta?.approvedAt) return [];
  const loader = ROW_LOADERS[key];
  if (!loader) return [];
  const mod = (await loader()) as { default: { meta: unknown; rows: TusRowTuple[] } };
  return mod.default.rows.map(rowFromTuple);
}

// ── EK YERLEŞTİRME ──
/** Ek yerleştirme dönem kayıtları (kronolojik). 👤 onay 2026-09-06 (10 dönem, atlanan 0; kullanıcı yetkisi "yeni veri onaylı"). */
export const TUS_EK_SNAPSHOTS: readonly TusSnapshotMeta[] = [
  { key: "2021-2", year: 2021, term: 2, approvedAt: "2026-09-06" },
  { key: "2022-1", year: 2022, term: 1, approvedAt: "2026-09-06" },
  { key: "2022-2", year: 2022, term: 2, approvedAt: "2026-09-06" },
  { key: "2023-1", year: 2023, term: 1, approvedAt: "2026-09-06" },
  { key: "2023-2", year: 2023, term: 2, approvedAt: "2026-09-06" },
  { key: "2024-1", year: 2024, term: 1, approvedAt: "2026-09-06" },
  { key: "2024-2", year: 2024, term: 2, approvedAt: "2026-09-06" },
  { key: "2025-1", year: 2025, term: 1, approvedAt: "2026-09-06" },
  { key: "2025-2", year: 2025, term: 2, approvedAt: "2026-09-06" },
  { key: "2026-1", year: 2026, term: 1, approvedAt: "2026-09-06" },
];
const EK_ROW_LOADERS: Record<string, () => Promise<{ default: unknown }>> = {
  "2021-2": () => import("@/data/tus/ek-2021-2.json"),
  "2022-1": () => import("@/data/tus/ek-2022-1.json"),
  "2022-2": () => import("@/data/tus/ek-2022-2.json"),
  "2023-1": () => import("@/data/tus/ek-2023-1.json"),
  "2023-2": () => import("@/data/tus/ek-2023-2.json"),
  "2024-1": () => import("@/data/tus/ek-2024-1.json"),
  "2024-2": () => import("@/data/tus/ek-2024-2.json"),
  "2025-1": () => import("@/data/tus/ek-2025-1.json"),
  "2025-2": () => import("@/data/tus/ek-2025-2.json"),
  "2026-1": () => import("@/data/tus/ek-2026-1.json"),
};
/** Onaylı bir dönemin EK YERLEŞTİRME satırları; onaysız/bilinmeyen → []. */
export async function tusEkRowsFor(key: string, registry: readonly TusSnapshotMeta[] = TUS_EK_SNAPSHOTS): Promise<TusRow[]> {
  const meta = registry.find((s) => s.key === key);
  if (!meta?.approvedAt) return [];
  const loader = EK_ROW_LOADERS[key];
  if (!loader) return [];
  const mod = (await loader()) as { default: { meta: unknown; rows: TusRowTuple[] } };
  return mod.default.rows.map(rowFromTuple);
}
