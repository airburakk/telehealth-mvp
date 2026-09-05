// Doctorium ÜST RAFI — sekme dizisinin TEK KAYNAĞI (üç katman Faz B1, 2026-09-05; B3 revizyonu aynı gün akşam,
// kullanıcı kararı: "kariyer akışını öğrenciye gösterme; Kariyer EDU ve TUS'u Kariyer'in içine koy — ekstra sekme
// açılmasın, en sonda yine Takvim olsun"). SAF modül (db/React yok; DoctoriumSidebar + birim testi okur).
//
//   · Raf HER KİTLEDE AYNI 8 durak: 7 modül + Takvim (08, en sonda). Öğrenciye ekstra sekme AÇILMAZ.
//   · TUS ve Kariyer EDU, Kariyer sekmesinin İÇİNDE yaşar: öğrencide sahnenin kendisi (page.tsx StudentCareerHub —
//     doktorun denklik/yükselme yol haritası öğrenciye çizilmez), doktorda Özelleştir anahtarıyla yol haritasının altında
//     TUS bölümü (DoctorTusSection; rapor §2 "kapalı, gizli değil"). /tus ve /kariyer-edu rotaları AYRINTI sayfası olarak
//     sürer (raf durağı değil; DoctoriumShell active="kariyer").
//   · Kitle yalnız Kariyer sekmesinin KİMLİK RENGİNİ değiştirir: öğrencide koral (STUDENT_LANE — öğrenci kulvarı),
//     doktorda mavi. Sekme numaraları dizideki sıradan üretilir; küme ayracı grup DEĞİŞTİĞİNDE çizilir.
//
// RENK: sekme kimlik renkleri {dark, light} çifti (raf renk bağlamı, globals.css); "ink" = tema-duyarlı mürekkep;
// null = nötr (aktifken zümrüt çifti).
import type { DoctoriumAudience } from "./doctorium-tiers";

export type ShelfModuleKey = "akis" | "akademik" | "sektorel" | "ilac" | "etkinlik" | "kariyer" | "mevzuat";
export type ShelfColor = { dark: string; light: string } | "ink" | null;
export type ShelfGroupKey = "BİLGİ" | "MESLEĞİM" | null;

export interface ShelfTabDef {
  /** Aktiflik anahtarı — SidebarActive ile aynı sözlük ("akis" · "takvim" …). */
  key: string;
  href: string;
  label: string;
  color: ShelfColor;
  group: ShelfGroupKey;
  /** Nabız sayacı için modül anahtarı; rota-sekmede (Takvim) null. */
  module: ShelfModuleKey | null;
}

export const SHELF_EMERALD = { dark: "#34d399", light: "#047857" } as const;

/** Öğrenci kulvarı — KORAL TURUNCU (👤 karar 2026-09-05, Faz B2; adaylar A koral · B filiz · C fuşya). B3'te bu çift
 *  öğrencinin KARİYER sekmesine bağlanır (EDU içerikleri orada); yüzey token'ları globals.css `[data-audience="student"]`
 *  bloğunda aynı aileden okur (gece #fb923c birebir; gündüz rafta bir kademe koyu #9a3412 — sıcak raf zemininde #c2410c
 *  3.95:1 AA altı kalıyordu, #9a3412 5.6:1). */
export const STUDENT_LANE = { dark: "#fb923c", light: "#9a3412" } as const;

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

/** Takvim durağı (kullanıcı kararı 2026-08-19): modül DEĞİL ayrı ROTA — raf yine de taşır (08, EN SONDA; kimliği marka zümrüdü). */
export const TAKVIM_TAB: ShelfTabDef = { key: "takvim", href: "/doktor/doctorium/takvim", label: "Takvim", color: SHELF_EMERALD, group: null, module: null };

/** Kitleye göre raf: dizi HERKESTE aynı; öğrencide Kariyer sekmesi öğrenci kulvarı rengini alır. Personel (null) doktor rafı. */
export function shelfTabsFor(audience: DoctoriumAudience | null): ShelfTabDef[] {
  const base = [...MODULE_TABS, TAKVIM_TAB];
  if (audience !== "STUDENT") return base;
  return base.map((t) => (t.key === "kariyer" ? { ...t, color: STUDENT_LANE } : t));
}
