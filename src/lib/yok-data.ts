// YÖK ATLAS Tıp programları — KAYIT DEFTERİ ve yükleyiciler (K5, 2026-09-05). Sunucu tarafı; grafik bileşenine serileştirilmiş özet geçer.
// KAYNAK: scripts/yok-atlas-ingest.ts → src/data/yok/tip-programlari-<yıl>.json ({ meta, rows }). İNSAN ONAYI: YOK_SNAPSHOTS'ta
// `approvedAt` 👤 doldurulmadan o yıl HİÇBİR yüzeyde görünmez (TUS_SNAPSHOTS ile aynı sözleşme). Dosyalar küçük (~130 KB) → statik import.
import snapshot2026 from "@/data/yok/tip-programlari-2026.json";
import { summarizeYok, type YokTipProgramRow, type YokTipSummary } from "./yok-normalize";

export interface YokSnapshotMeta { year: number; approvedAt: string | null }

/** Yıl kayıtları (kronolojik). Onaysız yıl UI'da yok. */
export const YOK_SNAPSHOTS: readonly YokSnapshotMeta[] = [
  { year: 2026, approvedAt: "2026-09-06" }, // 👤 onay 2026-09-06 (242 program · 127 fakülte · kontenjan 18.564)
];

export interface YokFileMeta {
  year: number; fetchedAt: string; sourceApi: string; sourcePage: string; sourceNote: string;
  totalPrograms: number; tipPrograms: number; filter: string; excludedFields: string[];
}
interface YokFile { meta: YokFileMeta; rows: YokTipProgramRow[] }

// JSON modülünün çıkarsanan tipi (history.yearsBack: number) satır tipine atanamaz → unknown üzerinden daraltılır.
const FILES: Record<number, YokFile> = { 2026: snapshot2026 as unknown as YokFile };

export interface YokSnapshot { meta: YokFileMeta; rows: YokTipProgramRow[]; summary: YokTipSummary; approvedAt: string }

/** Onaylı yıl anlık görüntüleri (kronolojik). */
export function approvedYokSnapshots(registry: readonly YokSnapshotMeta[] = YOK_SNAPSHOTS, files: Record<number, YokFile> = FILES): YokSnapshot[] {
  return registry
    .filter((s): s is YokSnapshotMeta & { approvedAt: string } => s.approvedAt !== null && !!files[s.year])
    .sort((a, b) => a.year - b.year)
    .map((s) => { const f = files[s.year]; return { meta: f.meta, rows: f.rows, summary: summarizeYok(f.meta.year, f.rows), approvedAt: s.approvedAt }; });
}

export function latestApprovedYok(): YokSnapshot | null {
  const all = approvedYokSnapshots();
  return all.length ? all[all.length - 1] : null;
}

/** Grafik/tablo için hafif satır (client'a geçer; koşul metni, koşul kodu, ücret yok). */
export interface YokRowLite {
  code: number; university: string; faculty: string | null; program: string; type: YokTipProgramRow["type"]; city: string | null;
  language: string | null; scholarship: string | null; quota: number; placed: number; minScore: number | null; rank: number | null;
  /** prof + doç + dr. öğr. üyesi (öğretim üyesi toplamı); staff yoksa null. */
  facultyMembers: number | null; accreditation: string | null;
}
export function toRowLite(r: YokTipProgramRow): YokRowLite {
  return {
    code: r.code, university: r.university, faculty: r.faculty, program: r.program, type: r.type, city: r.city, language: r.language,
    scholarship: r.scholarship, quota: r.quota, placed: r.placed, minScore: r.minScore, rank: r.rank,
    facultyMembers: r.staff ? r.staff.prof + r.staff.doc + r.staff.dou : null, accreditation: r.accreditation,
  };
}
