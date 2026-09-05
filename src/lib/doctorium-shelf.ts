// Doctorium ÜST RAFI — sekme dizisinin TEK KAYNAĞI (üç katman Faz B1, kullanıcı kararı 2026-09-05). SAF modül
// (db/React yok; DoctoriumSidebar + birim testi okur). Eskiden MODULES/TAKVIM dizileri DoctoriumSidebar.tsx içinde
// kitle-körüydü; artık raf KİTLEYE göre kurulur:
//   · VERIFIED / TRIAL / personel → 7 modül + Takvim (bugünkü raf); Özelleştir'de "TUS sekmesini göster" açılırsa + TUS
//     (rapor §2: doktor tarafında TUS "kapalı, gizli değil" — mentor olacak asistan tek anahtarla açar; doğrudan URL serbest).
//   · STUDENT → 7 modül + Takvim + TUS + Kariyer EDU (öğrenci yüzeyleri; audienceFlags.showsStudentSurfaces).
// Sekme numaraları dizideki sıradan üretilir (Takvim 08 korunur; TUS 09, Kariyer EDU 10). Küme ayracı, grup DEĞİŞTİĞİNDE
// çizilir (eski "grup başlığı + Takvim önünde açık ayraç" davranışıyla birebir aynı yerlere düşer).
//
// RENK: sekme kimlik renkleri {dark, light} çifti (raf renk bağlamı, globals.css); "ink" = tema-duyarlı mürekkep;
// null = nötr (aktifken zümrüt çifti). TUS/Kariyer EDU kimlik rengi 👤 mockup kararına (B2) kadar ZÜMRÜT çifti —
// yüzey boyamaz, tek satırdan değişir.
import type { DoctoriumAudience } from "./doctorium-tiers";

export type ShelfModuleKey = "akis" | "akademik" | "sektorel" | "ilac" | "etkinlik" | "kariyer" | "mevzuat";
export type ShelfColor = { dark: string; light: string } | "ink" | null;
export type ShelfGroupKey = "BİLGİ" | "MESLEĞİM" | "EDU" | null;

export interface ShelfTabDef {
  /** Aktiflik anahtarı — SidebarActive ile aynı sözlük ("akis" · "takvim" · "tus" …). */
  key: string;
  href: string;
  label: string;
  color: ShelfColor;
  group: ShelfGroupKey;
  /** Nabız sayacı için modül anahtarı; rota-sekmelerde (Takvim/TUS/Kariyer EDU) null. */
  module: ShelfModuleKey | null;
}

export const SHELF_EMERALD = { dark: "#34d399", light: "#047857" } as const;

/** Modül sekmeleri — kimlik renkleri kullanıcı kararlarıyla (2026-08-14/19) sabit; ?m= anahtarları DB module değerleriyle aynı. */
export const MODULE_TABS: readonly ShelfTabDef[] = [
  // Akışım sarı (kullanıcı kararı 2026-08-14): kıvılcım çağrışımı; gündüzü --c-gold ailesi.
  { key: "akis", href: "/doktor/doctorium", label: "Akışım", color: { dark: "#facc15", light: "#8a6414" }, group: null, module: "akis" },
  { key: "akademik", href: "/doktor/doctorium?m=akademik", label: "Akademik", color: { dark: "#34d399", light: "#047857" }, group: "BİLGİ", module: "akademik" },
  { key: "sektorel", href: "/doktor/doctorium?m=sektorel", label: "Sektörel", color: { dark: "#a78bfa", light: "#5b4b9e" }, group: "BİLGİ", module: "sektorel" },
  { key: "ilac", href: "/doktor/doctorium?m=ilac", label: "İlaç & Cihaz", color: { dark: "#22d3ee", light: "#0e7d8c" }, group: "BİLGİ", module: "ilac" },
  { key: "etkinlik", href: "/doktor/doctorium?m=etkinlik", label: "Etkinlik", color: "ink", group: "MESLEĞİM", module: "etkinlik" },
  { key: "kariyer", href: "/doktor/doctorium?m=kariyer", label: "Kariyer", color: { dark: "#60a5fa", light: "#2d5c9e" }, group: "MESLEĞİM", module: "kariyer" },
  { key: "mevzuat", href: "/doktor/doctorium?m=mevzuat", label: "Hukuk", color: { dark: "#fb7185", light: "#a83e50" }, group: "MESLEĞİM", module: "mevzuat" },
];

/** Takvim durağı (kullanıcı kararı 2026-08-19): modül DEĞİL ayrı ROTA — raf yine de taşır (08; kimliği marka zümrüdü). */
export const TAKVIM_TAB: ShelfTabDef = { key: "takvim", href: "/doktor/doctorium/takvim", label: "Takvim", color: SHELF_EMERALD, group: null, module: null };

/** TUS — öğrenci yüzeyi (rapor §3); doktorda tercihle açılır. Veri hattı gelene dek dürüst iskelet sayfa (lib/tus). */
export const TUS_TAB: ShelfTabDef = { key: "tus", href: "/doktor/doctorium/tus", label: "TUS", color: SHELF_EMERALD, group: "EDU", module: null };

/** Kariyer EDU — staj/değişim/burs takvimi (rapor §7); YALNIZ öğrenci (ilan değil, süreç bilgisi — İŞKUR sınırı). */
export const KARIYER_EDU_TAB: ShelfTabDef = { key: "kariyer-edu", href: "/doktor/doctorium/kariyer-edu", label: "Kariyer EDU", color: SHELF_EMERALD, group: "EDU", module: null };

/** Kitleye (ve doktor tercihine) göre raf sekmeleri. Personel (audience null) doktor rafını görür. */
export function shelfTabsFor(audience: DoctoriumAudience | null, prefs: { showTus: boolean }): ShelfTabDef[] {
  const base = [...MODULE_TABS, TAKVIM_TAB];
  if (audience === "STUDENT") return [...base, TUS_TAB, KARIYER_EDU_TAB];
  if (prefs.showTus) return [...base, TUS_TAB];
  return base;
}
