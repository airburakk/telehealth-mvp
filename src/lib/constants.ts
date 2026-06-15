// Ülke, dil ve durum sabitleri

export interface CountryDef {
  code: string;
  name: string;
  flag: string;
  langs: string[];
}

export const COUNTRIES: CountryDef[] = [
  { code: "DZ", name: "Cezayir", flag: "🇩🇿", langs: ["Arapça", "Fransızca"] },
  { code: "LY", name: "Libya", flag: "🇱🇾", langs: ["Arapça"] },
  { code: "RU", name: "Rusya", flag: "🇷🇺", langs: ["Rusça"] },
  { code: "AZ", name: "Azerbaycan", flag: "🇦🇿", langs: ["Azerice", "Rusça"] },
  { code: "KZ", name: "Kazakistan", flag: "🇰🇿", langs: ["Kazakça", "Rusça"] },
  { code: "KG", name: "Kırgızistan", flag: "🇰🇬", langs: ["Kırgızca", "Rusça"] },
  { code: "DE", name: "Almanya", flag: "🇩🇪", langs: ["Almanca", "Türkçe"] },
  { code: "GB", name: "Birleşik Krallık", flag: "🇬🇧", langs: ["İngilizce"] },
  { code: "FR", name: "Fransa", flag: "🇫🇷", langs: ["Fransızca"] },
  { code: "TR", name: "Türkiye", flag: "🇹🇷", langs: ["Türkçe"] },
];

export const LANGUAGES = ["Türkçe", "Rusça", "Azerice", "Arapça", "Fransızca", "İngilizce", "Almanca", "Kazakça", "Kırgızca"];

export function countryName(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}
export function countryFlag(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.flag ?? "🏳️";
}

export const CASE_STATUS: Record<string, { label: string; color: string }> = {
  NEW: { label: "Yeni", color: "bg-blue-100 text-blue-800" },
  IN_REVIEW: { label: "İncelemede", color: "bg-amber-100 text-amber-800" },
  IN_CONSULT: { label: "Görüşmede", color: "bg-violet-100 text-violet-800" },
  DONE: { label: "Tamamlandı", color: "bg-emerald-100 text-emerald-800" },
};

export function urgencyStyle(u: number): { label: string; badge: string; dot: string } {
  if (u >= 5) return { label: "Acil / Hayati", badge: "bg-red-100 text-red-700 ring-red-200", dot: "bg-red-500" };
  if (u === 4) return { label: "Yüksek", badge: "bg-orange-100 text-orange-700 ring-orange-200", dot: "bg-orange-500" };
  if (u === 3) return { label: "Orta", badge: "bg-amber-100 text-amber-800 ring-amber-200", dot: "bg-amber-500" };
  if (u === 2) return { label: "Düşük", badge: "bg-teal-100 text-teal-700 ring-teal-200", dot: "bg-teal-500" };
  return { label: "Rutin", badge: "bg-slate-100 text-slate-600 ring-slate-200", dot: "bg-slate-400" };
}

export function formatDateTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  // timeZone sabit: sunucu (Vercel UTC) ile istemci (TR) aynı çıktıyı üretsin → hydration uyuşmazlığı (#418) olmasın
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }).format(date);
}
