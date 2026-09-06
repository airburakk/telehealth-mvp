// YÖKSİS — Tıp fakültesi MEZUN sayıları: KAYIT DEFTERİ ve seçiciler (K5(a), 2026-09-06). Sunucu tarafı; grafiğe serileştirilmiş dizi geçer.
// KAYNAK: scripts/yoksis-mezun-ingest.mjs → src/data/yok/mezun-tip-<mezunYılıSonu>.json (YÖKSİS İstatistik, Tablo 12 — önlisans ve lisans
// düzeyindeki mezun sayıları, yükseköğretim kurumları ve akademik birimlere göre; yalnız adı "TIP FAKÜLTESİ" içeren birimler).
// 🪤 Mezun yılı = ÖĞRETİM YILI ("2023-2024" → endYear 2024); YÖKSİS sayfası bir yıl sonra yayımlar (2024-2025 sayfası → 2023-2024 mezunları).
// İNSAN ONAYI: YOK_MEZUN_SNAPSHOTS'ta 👤 approvedAt doldurulmadan o yıl HİÇBİR yüzeyde görünmez (TUS/YÖK Atlas defterleriyle aynı sözleşme).
import m2019 from "@/data/yok/mezun-tip-2019.json";
import m2020 from "@/data/yok/mezun-tip-2020.json";
import m2021 from "@/data/yok/mezun-tip-2021.json";
import m2022 from "@/data/yok/mezun-tip-2022.json";
import m2023 from "@/data/yok/mezun-tip-2023.json";
import m2024 from "@/data/yok/mezun-tip-2024.json";
import m2025 from "@/data/yok/mezun-tip-2025.json";
import { classifyUniType, type YokUniType } from "./yok-normalize";

export interface YokMezunSnapshotMeta { endYear: number; approvedAt: string | null }

/** Mezun yılı kayıtları (kronolojik; endYear = öğretim yılının ikinci yılı). Onaysız yıl UI'da yok. */
export const YOK_MEZUN_SNAPSHOTS: readonly YokMezunSnapshotMeta[] = [
  { endYear: 2019, approvedAt: "2026-09-06" },
  { endYear: 2020, approvedAt: "2026-09-06" },
  { endYear: 2021, approvedAt: "2026-09-06" },
  { endYear: 2022, approvedAt: "2026-09-06" },
  { endYear: 2023, approvedAt: "2026-09-06" },
  { endYear: 2024, approvedAt: "2026-09-06" },
  { endYear: 2025, approvedAt: "2026-09-06" },
];

export interface YokMezunRow { university: string; type: string; city: string | null; faculty: string; male: number; female: number; total: number }
export interface YokMezunFileMeta {
  gradYear: string; endYear: number; pageLabel: string; tableTitle: string; sourcePage: string; sourceFile: string; fetchedAt: string; method: string;
  nationalUndergraduateGraduates: { male: number; female: number; total: number } | null; tipFaculties: number; tipGraduates: number;
}
export interface YokMezunFile { meta: YokMezunFileMeta; rows: YokMezunRow[] }

const FILES: Record<number, YokMezunFile> = {
  2019: m2019 as unknown as YokMezunFile, 2020: m2020 as unknown as YokMezunFile, 2021: m2021 as unknown as YokMezunFile, 2022: m2022 as unknown as YokMezunFile,
  2023: m2023 as unknown as YokMezunFile, 2024: m2024 as unknown as YokMezunFile, 2025: m2025 as unknown as YokMezunFile,
};

export interface YokMezunYear {
  endYear: number; gradYear: string; faculties: number; graduates: number; male: number; female: number;
  byType: { type: YokUniType; faculties: number; graduates: number }[];
  fetchedAt: string; approvedAt: string;
}

export function summarizeMezun(file: YokMezunFile, approvedAt: string): YokMezunYear {
  const types: YokUniType[] = ["DEVLET", "VAKIF", "KKTC", "YURTDISI"];
  const byType = types.map((t) => {
    const rs = file.rows.filter((r) => classifyUniType(r.type) === t);
    return { type: t, faculties: rs.length, graduates: rs.reduce((n, r) => n + r.total, 0) };
  }).filter((x) => x.faculties > 0);
  return {
    endYear: file.meta.endYear, gradYear: file.meta.gradYear, faculties: file.rows.length,
    graduates: file.rows.reduce((n, r) => n + r.total, 0), male: file.rows.reduce((n, r) => n + r.male, 0), female: file.rows.reduce((n, r) => n + r.female, 0),
    byType, fetchedAt: file.meta.fetchedAt, approvedAt,
  };
}

/** Onaylı mezun yılları (kronolojik). */
export function approvedTipGraduates(registry: readonly YokMezunSnapshotMeta[] = YOK_MEZUN_SNAPSHOTS, files: Record<number, YokMezunFile> = FILES): YokMezunYear[] {
  return registry
    .filter((s): s is YokMezunSnapshotMeta & { approvedAt: string } => s.approvedAt !== null && !!files[s.endYear])
    .sort((a, b) => a.endYear - b.endYear)
    .map((s) => summarizeMezun(files[s.endYear], s.approvedAt));
}

/** Onaylı bir yılın fakülte satırları (üniversite adına göre sıralı); onaysız → []. */
export function tipGraduateRowsFor(endYear: number, registry: readonly YokMezunSnapshotMeta[] = YOK_MEZUN_SNAPSHOTS, files: Record<number, YokMezunFile> = FILES): YokMezunRow[] {
  const meta = registry.find((s) => s.endYear === endYear);
  if (!meta?.approvedAt || !files[endYear]) return [];
  return [...files[endYear].rows].sort((a, b) => a.university.localeCompare(b.university, "tr-TR") || a.faculty.localeCompare(b.faculty, "tr-TR"));
}

/** Son onaylı yılın dosya meta'sı (kaynak dipnotu için). */
export function latestApprovedMezunMeta(): YokMezunFileMeta | null {
  const ok = approvedTipGraduates();
  return ok.length ? FILES[ok[ok.length - 1].endYear].meta : null;
}
