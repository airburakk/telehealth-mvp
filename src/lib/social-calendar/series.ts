// İçerik takvimi — RUBRİK kayıt defteri (v6.328, 2026-10-06). TEK doğruluk kaynağı: hangi gün hangi rubrik, kaynağı ne, onay türü ne.
//
// 👤 Karar (2026-10-06): günlük seçki (omurga) AYNEN kalır; üstüne hafta içi "imza içerik" rubrikleri eklenir. Başlangıçta ÜÇ rubrik:
//   Çar ⚖️ Karar masası (Yargıtay kararı incelemesi — insan onayı ZORUNLU) · Pzt Etkinlik radarı · Cum Öğrenci köşesi; hukuk günü uçtan
//   uca oturunca (≈4. hafta) 5–6 rubrike çıkılır. Tek editör: hazırlayan = onaylayan (IN_REVIEW aşaması YOK).
// Faz 1'de yalnız `karar-masasi` için aday seçici + taslak üretici var (generator:true); diğer ikisi ELLE taslakla çalışır (üreticileri Faz 3).
// Rubrik adları (halka açık metin) 👤 onayına tabidir — bu dosyadaki `name`ler öneridir.
// Kaynak: lib/social-calendar/* ; ekran: /admin/icerik-takvimi ; tablo: ContentPlanItem.

export type SeriesKey = "karar-masasi" | "etkinlik-radari" | "ogrenci-kosesi";
export type SourceKind = "ictihat" | "etkinlik" | "kariyer-edu";
/** legal = hukuki içerik (uyarı + alıntı bütünlüğü + kimlik onayı kapıları); light = hafif onay. */
export type ApprovalKind = "legal" | "light";
export type SlideRole = "kapak" | "uyusmazlik" | "mahkeme" | "gerekce" | "sonuc" | "cikarim" | "kaynak" | "genel";

export const SLIDE_ROLES: readonly SlideRole[] = ["kapak", "uyusmazlik", "mahkeme", "gerekce", "sonuc", "cikarim", "kaynak", "genel"];

export const SLIDE_ROLE_LABEL: Record<SlideRole, string> = {
  kapak: "Kapak",
  uyusmazlik: "Uyuşmazlık",
  mahkeme: "Mahkeme ve temyiz",
  gerekce: "Yargıtay gerekçesi",
  sonuc: "Sonuç",
  cikarim: "Doktor için çıkarım",
  kaynak: "Kaynak ve uyarı",
  genel: "İçerik",
};

export interface SeriesDef {
  key: SeriesKey;
  /** Halka açık rubrik adı (öneri; 👤 onayı). */
  name: string;
  /** ISO hafta günü: 1 = Pazartesi … 7 = Pazar. */
  weekday: number;
  sourceKind: SourceKind;
  sourceLabel: string;
  approval: ApprovalKind;
  /** Zorunlu editör metni etiketi ("Doktor için çıkarım"); null = bu rubrikte yok. */
  noteLabel: string | null;
  /** Hukuk günü: "taraf adı / kimlik bilgisi içermiyor" onay kutusu ZORUNLU. */
  attestIdentity: boolean;
  /** kart servisi şablon anahtarı (infra/kart/lib/social-rubrik.mjs). */
  templateKey: string;
  /** Faz 1'de aday seçici + taslak üretici var mı. */
  generator: boolean;
  /** Boş taslağın slayt iskeleti. */
  slideRoles: SlideRole[];
  /** Onay kapısının ZORUNLU tuttuğu roller (hepsi dolu olmalı). */
  requiredRoles: SlideRole[];
  /** Bu roller `quote:true` OLMAK ZORUNDA ve kaynak metinde birebir doğrulanır (hukuk günü: uyuşmazlık + gerekçe mahkemenin kendi sözüdür). */
  quoteRoles: SlideRole[];
}

export const SERIES: readonly SeriesDef[] = [
  {
    key: "etkinlik-radari",
    name: "Etkinlik radarı",
    weekday: 1,
    sourceKind: "etkinlik",
    sourceLabel: "Kongre / STE etkinlikleri",
    approval: "light",
    noteLabel: null,
    attestIdentity: false,
    templateKey: "etkinlik-radari",
    generator: false,
    slideRoles: ["kapak", "genel", "genel", "genel", "kaynak"],
    requiredRoles: ["kapak", "kaynak"],
    quoteRoles: [],
  },
  {
    key: "karar-masasi",
    name: "Karar masası",
    weekday: 3,
    sourceKind: "ictihat",
    sourceLabel: "Yargıtay İçtihat",
    approval: "legal",
    noteLabel: "Doktor için çıkarım",
    attestIdentity: true,
    templateKey: "karar-masasi",
    generator: true,
    slideRoles: ["kapak", "uyusmazlik", "mahkeme", "gerekce", "sonuc", "cikarim", "kaynak"],
    requiredRoles: ["kapak", "uyusmazlik", "gerekce", "sonuc", "cikarim", "kaynak"],
    quoteRoles: ["uyusmazlik", "gerekce"],
  },
  {
    key: "ogrenci-kosesi",
    name: "Öğrenci köşesi",
    weekday: 5,
    sourceKind: "kariyer-edu",
    sourceLabel: "TUS verisi + Kariyer EDU fırsatları",
    approval: "light",
    noteLabel: null,
    attestIdentity: false,
    templateKey: "ogrenci-kosesi",
    generator: false,
    slideRoles: ["kapak", "genel", "genel", "genel", "kaynak"],
    requiredRoles: ["kapak", "kaynak"],
    quoteRoles: [],
  },
];

export function seriesByKey(key: string): SeriesDef | null {
  return SERIES.find((s) => s.key === key) ?? null;
}

// ── Gün aritmetiği (SAF; saat dilimi UTC — "YYYY-AA-GG" bir TAKVİM günüdür, anlık değil) ──────────────

export const WEEKDAY_SHORT = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"] as const;
export const WEEKDAY_LONG = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"] as const;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Gerçek bir takvim günü mü (2026-02-30 gibi taşmalar reddedilir). */
export function isDayString(s: unknown): s is string {
  if (typeof s !== "string" || !DAY_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** ISO hafta günü: 1 = Pazartesi … 7 = Pazar. */
export function isoWeekday(day: string): number {
  const w = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Pazar
  return w === 0 ? 7 : w;
}

/** Günün ait olduğu haftanın PAZARTESİ günü. */
export function weekStart(day: string): string {
  return addDays(day, 1 - isoWeekday(day));
}

/** Pazartesiden başlayan 7 gün. */
export function weekDays(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** Haftanın rubrik yuvaları (kayıt defteri sırasıyla gün sırasına göre). */
export function slotsOfWeek(monday: string): { series: SeriesDef; slotDay: string }[] {
  return [...SERIES]
    .sort((a, b) => a.weekday - b.weekday)
    .map((series) => ({ series, slotDay: addDays(monday, series.weekday - 1) }));
}

/** Bir (rubrik, gün) çifti kayıt defterinin takvimine uyuyor mu (rubrik doğru haftanın gününde mi). */
export function slotMatchesSeries(series: SeriesDef, slotDay: string): boolean {
  return isDayString(slotDay) && isoWeekday(slotDay) === series.weekday;
}
