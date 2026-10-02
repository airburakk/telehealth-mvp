// Haber özeti ONARIM kararları — SAF (birim testli: tests/unit/summary-repair.test.ts).
//
// Betik (scripts/repair-news-summaries.ts) yalnız okur/yazar; "neyi nasıl yazacağı" burada durur ki üretimde koşacak
// yazma yolu (orada kendi başıma koşturamam) yine de birim testle kilitli olsun.
// Arka plan: 2026-10-02 kök neden düzeltmeleri YENİ satırları düzeltir; eski satırlar bu kararlarla onarılır —
//   · yapışık bölüm etiketleri (lib/abstract-text: Europe PMC `<h4>` söküldüğünde, DOAJ kaynağında zaten yapışık);
//   · eski fetchDocumentText'in sayfa-metni yazımı (<title> + gezinme menüsü + alt bilgi — lib/document-text).
import { repairGluedAbstractLabels } from "./abstract-text";

/**
 * Ingest hiçbir kaynakta `summary`'yi 500 karakterden uzun yazmaz (RSS `slice(0, 500)` · WHO/ClinicalTrials 400); bundan uzun metin
 * fetchDocumentText'in (≤ 8000) SAYFA-metni yazımıdır — sayfa-metni onarımının adaylık imzası.
 */
export const INGEST_SUMMARY_MAX = 500;

export interface SummaryRow {
  summary: string;
  /** Doluysa satır çeviri hattından geçti: `summary` = Türkçe giriş, `summaryOriginal` = özgün tam metin. */
  summaryOriginal: string | null;
}

/** Prisma `data` yaması — yalnız dokunulacak alanlar. */
export interface SummaryPatch {
  summary?: string;
  summaryOriginal?: string | null;
}

/**
 * Etiket onarımı: yapışık bölüm etiketleri onarılır. Çevrilmiş satırda YALNIZ özgün metin düzelir — Türkçe giriş (`summary`)
 * korunur (ondan yeniden türetilemez; çeviri hattı o girişi zaten üretmişti). Değişiklik yoksa null (idempotent).
 */
export function planLabelRepair(row: SummaryRow): SummaryPatch | null {
  const current = row.summaryOriginal ?? row.summary;
  const fixed = repairGluedAbstractLabels(current);
  if (fixed === current) return null;
  return row.summaryOriginal !== null ? { summaryOriginal: fixed } : { summary: fixed };
}

/**
 * Sayfa-metni onarımı: `fresh` = kaynak sayfanın YENİ çıkarıcıyla (extractDocumentText) yeniden okunmuş hali; null = sayfa
 * ulaşılabilir ama kullanılabilir gövde yok (ör. "Yeni Sayı İçin Tıklayınız"). ⚠️ "Sayfaya erişilemedi" bu fonksiyona
 * GELMEZ — çağıran o durumda hiç yazmaz (ağ hatasını "içerik yok" sanıp özeti boşaltmamak için).
 *  · mevcut metin ≤ INGEST_SUMMARY_MAX ise RSS/liste özetidir, sayfa-metni değil → dokunulmaz;
 *  · yeni çıkarım mevcutla aynıysa → null (idempotent);
 *  · aksi halde özet = yeni metin (gövde yoksa "" — menü özet olmasın);
 *  · çevrilmiş satır YENİDEN KUYRUĞA girer (`summaryOriginal` = null → translate-news yeniden çevirir): eldeki Türkçe giriş
 *    kirli metnin çevirisidir.
 */
export function planPageTextRepair(row: SummaryRow, fresh: string | null): SummaryPatch | null {
  const current = row.summaryOriginal ?? row.summary;
  if (current.length <= INGEST_SUMMARY_MAX) return null;
  const next = fresh ?? "";
  if (next === current) return null;
  return { summary: next, summaryOriginal: null };
}
