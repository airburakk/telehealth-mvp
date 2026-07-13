// Branş görsel kimliği — her tıbbi branşın rengi + (üretilen) sembol/banner varlıkları.
// Renkler semantik (kalp=kırmızı, onkoloji=mor, nöro=indigo…) + koyu tema (#0D0E10 zemin) üzerinde
// okunur orta-parlak tonlar; anahtarlar lib/triage BRANCHES.key ile birebir aynı (30 branş).
// Sembol + banner görselleri Higgsfield ile üretilip public/branches/ altına düşer (Faz C).
import { BRANCHES } from "./triage";

export const BRANCH_COLORS: Record<string, string> = {
  onkoloji: "#A855F7",              // mor — kanser farkındalık
  kardiyoloji: "#EF4444",           // kırmızı — kalp
  ortopedi: "#3B82F6",              // çelik mavi — kemik/eklem
  norosirurji: "#6366F1",           // indigo — beyin/omurga cerrahisi
  "sac-ekimi": "#D97706",           // amber-kahve — saç
  estetik: "#F472B6",               // rose — estetik
  ivf: "#14B8A6",                   // turkuaz-yeşil — yaşam/doğurganlık
  dis: "#38BDF8",                   // açık mavi — diş
  goz: "#22D3EE",                   // cyan — göz
  "genel-cerrahi": "#0D9488",       // koyu turkuaz — cerrahi
  dahiliye: "#22C55E",              // yeşil — iç hastalıkları
  noroloji: "#818CF8",              // açık indigo — sinir/beyin
  gastroenteroloji: "#F97316",      // turuncu — sindirim
  endokrinoloji: "#10B981",         // zümrüt — hormon/metabolizma
  nefroloji: "#2563EB",             // koyu mavi — böbrek
  "gogus-hastaliklari": "#60A5FA",  // gök mavisi — akciğer/nefes
  hematoloji: "#DC2626",            // bordo-kırmızı — kan
  romatoloji: "#06B6D4",            // turkuaz — eklem/romatizma
  enfeksiyon: "#84CC16",            // lime — mikrop/enfeksiyon
  dermatoloji: "#FB923C",           // şeftali — cilt
  psikiyatri: "#C084FC",            // lavanta — ruh sağlığı
  "fizik-tedavi": "#4ADE80",        // açık yeşil — rehabilitasyon
  "cocuk-sagligi": "#F9A8D4",       // açık pembe — çocuk
  uroloji: "#F59E0B",               // amber — üroloji
  kbb: "#2DD4BF",                   // turkuaz-mavi — kulak burun boğaz
  "kadin-dogum": "#EC4899",         // magenta-pembe — kadın doğum
  kvc: "#B91C1C",                   // koyu kırmızı — kalp-damar cerrahisi
  "gogus-cerrahisi": "#8B5CF6",     // menekşe — göğüs cerrahisi
  "organ-nakli": "#059669",         // koyu zümrüt — organ nakli/yaşam
  "radyasyon-onkolojisi": "#D946EF",// magenta-mor — radyasyon onkolojisi
};

// AURA turkuaz vurgusu — branş bilinmiyorsa/eşleşmiyorsa nötr geri düşüş.
export const DEFAULT_BRANCH_COLOR = "#28C8D8";

// Case.branch LABEL tutar ("Kardiyoloji"), triyaj effectiveBranch ise KEY ("kardiyoloji") —
// görsel fonksiyonlar HER İKİSİNİ de kabul etsin diye tek noktada key'e normalize edilir.
const KEY_BY_LABEL: Record<string, string> = {};
for (const b of BRANCHES) KEY_BY_LABEL[b.label] = b.key;
export function resolveBranchKey(v?: string | null): string | undefined {
  if (!v) return undefined;
  if (BRANCH_COLORS[v]) return v;   // zaten key
  return KEY_BY_LABEL[v];           // label → key (yoksa undefined)
}

export function branchColor(v?: string | null): string {
  const k = resolveBranchKey(v);
  return (k && BRANCH_COLORS[k]) || DEFAULT_BRANCH_COLOR;
}

// Branşın SVG amblemi (public/branches/, Higgsfield Recraft vector ile üretildi — 30 branş).
export function branchSymbolSrc(v: string): string {
  return `/branches/${resolveBranchKey(v) ?? v}-symbol.svg`; // 1:1 minimal vektör amblem (koyu zemin)
}

// Branşın atmosferik banner arka planı — Higgsfield görseli DEĞİL, branş renginden türetilen CSS
// gradyan (kullanıcı kararı 2026-07-13). Tutarlı, kredi harcamaz, her branşın rengiyle otomatik
// uyumlu, sonsuz ölçeklenir. Pilot kardiyoloji banner'ının koyu + diagonal ışık dalgası hissini taklit.
export function branchBannerBg(key?: string | null): string {
  const c = branchColor(key);
  return `radial-gradient(120% 150% at 78% 22%, ${c}40 0%, ${c}1a 28%, transparent 58%), radial-gradient(90% 120% at 12% 105%, ${c}26 0%, transparent 55%), #0D0E10`;
}

// Bir branşın görsel kimliği (renk + sembol) var mı? Girdi key veya label olabilir → resolve.
// 30 branşın tamamı üretildi; BRANCH_COLORS anahtarları otoriter kaynak.
export const BRANCHES_WITH_VISUALS = new Set<string>(Object.keys(BRANCH_COLORS));
export function hasBranchVisual(v?: string | null): boolean {
  return !!resolveBranchKey(v);
}
