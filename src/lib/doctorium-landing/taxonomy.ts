// Landing'in İSTEMCİ-GÜVENLİ taksonomi kopyası (2026-08-23).
//
// Neden ayrı dosya: BRANCH_OPTIONS / FEED_MODULE_OPTIONS lib/doctorium.ts'te yaşar ve o modül `db`
// import eder — istemci bileşeni (PersonalizationDemo) oradan DEĞER alamaz (ArticleCard.tsx:2-6
// dersi). lib/triage.ts ise saf veri (db yok) → branşlar doğrudan oradan; bölüm listesi burada
// FEED_MODULE_OPTIONS ile BİREBİR tutulur ve birim testi ikisini karşılaştırır (kopya = drift riski,
// test kilidi şart — PreferencesBoard.tsx'teki "ikisini BİRLİKTE güncelle" notunun test edilmiş hâli).
import { BRANCHES } from "@/lib/triage";

export const LANDING_BRANCHES = BRANCHES.map((b) => ({ slug: b.key, label: b.label }));
const LABEL_BY_SLUG: Record<string, string> = Object.fromEntries(LANDING_BRANCHES.map((b) => [b.slug, b.label]));
export function landingBranchLabel(slug: string): string {
  return LABEL_BY_SLUG[slug] ?? slug;
}
export function isLandingBranch(slug: string): boolean {
  return slug in LABEL_BY_SLUG;
}

/** lib/doctorium.ts FEED_MODULE_OPTIONS ile AYNI sıra ve anahtarlar (test: doctorium-landing-registry). */
export const LANDING_MODULES = [
  { key: "akademik", label: "Akademik" },
  { key: "sektorel", label: "Sektörel" },
  { key: "ilac", label: "İlaç & Regülasyon" },
  { key: "etkinlik", label: "Etkinlik" },
  { key: "kariyer", label: "Kariyer" },
  { key: "hukuk-mevzuat", label: "Mevzuat" },
  { key: "hukuk-ictihat", label: "İçtihat" },
  { key: "hukuk-doktrin", label: "Doktrin" },
] as const;
export type LandingModuleKey = (typeof LANDING_MODULES)[number]["key"];
export const FEED_MODULE_LABEL: Record<string, string> = Object.fromEntries(LANDING_MODULES.map((m) => [m.key, m.label]));
export function isLandingModule(k: string): k is LandingModuleKey {
  return k in FEED_MODULE_LABEL;
}

/** Hero ve demo başlangıcı — veri bakımından zengin bir branş (ingest sorguları tüm branşları kapsar). */
export const DEFAULT_DEMO_BRANCH = "kardiyoloji";
export const DEFAULT_DEMO_MODULES: LandingModuleKey[] = ["akademik", "ilac", "hukuk-mevzuat", "etkinlik"];
