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
  // MENA / Körfez genişlemesi — Arapça (RTL) ve Farsça (RTL) pazarları
  { code: "SA", name: "Suudi Arabistan", flag: "🇸🇦", langs: ["Arapça", "İngilizce"] },
  { code: "AE", name: "BAE", flag: "🇦🇪", langs: ["Arapça", "İngilizce"] },
  { code: "QA", name: "Katar", flag: "🇶🇦", langs: ["Arapça", "İngilizce"] },
  { code: "KW", name: "Kuveyt", flag: "🇰🇼", langs: ["Arapça"] },
  { code: "IQ", name: "Irak", flag: "🇮🇶", langs: ["Arapça"] },
  { code: "IR", name: "İran", flag: "🇮🇷", langs: ["Farsça"] },
  // Balkan genişlemesi — Bulgarca (Kiril; 2026-07-23, kullanıcı kararı: vitrin 9. dil + hasta arayüzü)
  { code: "BG", name: "Bulgaristan", flag: "🇧🇬", langs: ["Bulgarca"] },
];

export const LANGUAGES = ["Türkçe", "Rusça", "Azerice", "Arapça", "Farsça", "Fransızca", "İngilizce", "Almanca", "Kazakça", "Kırgızca", "Bulgarca"];

// Dil adı → BCP-47 yerel kodu (tarih/sayı biçimleme için; ConsultationRoom SPEECH_LANG ile aynı küme).
export const LANG_BCP47: Record<string, string> = {
  "Türkçe": "tr-TR", "Rusça": "ru-RU", "Azerice": "az-AZ", "Arapça": "ar-SA", "Farsça": "fa-IR",
  "Fransızca": "fr-FR", "İngilizce": "en-US", "Almanca": "de-DE", "Kazakça": "kk-KZ", "Kırgızca": "ky-KG",
  "Bulgarca": "bg-BG",
};

// ISO 639-1 kodu ↔ dil ADI köprüsü — tek dil anahtarı `air_lang` dil ADI tutar (LANGUAGES);
// kod-bazlı yüzeyler (landing dilleri, public EN/TR sayfalar) bu eşlemeyle aynı anahtarı paylaşır.
export const LANG_NAME_BY_CODE: Record<string, string> = {
  tr: "Türkçe", ru: "Rusça", az: "Azerice", ar: "Arapça", fa: "Farsça",
  fr: "Fransızca", en: "İngilizce", de: "Almanca", kk: "Kazakça", ky: "Kırgızca",
  bg: "Bulgarca",
};
export function langCodeFor(name?: string | null): string | undefined {
  if (!name) return undefined;
  return Object.keys(LANG_NAME_BY_CODE).find((c) => LANG_NAME_BY_CODE[c] === name);
}

// Doktor video kartviziti kanonik TR tanıtım metni — jenerik (isim/branş interpolasyonu YOK:
// AI çevirisinde placeholder kaybı riski sıfır + tüm doktorlar aynı çeviri cache girdisini paylaşır).
// Burada (düz-veri modülü): hem client (PreConsultLobby) hem server (hekim/[id]) import eder —
// "use client" modülünden veri export'u server'da client-reference'a döner (iterate edilemez).
export const VIDEO_CARD_SCRIPT = [
  "Merhaba, hoş geldiniz.",
  "Uluslararası hastalarımıza yıllardır güvenle hizmet veriyoruz.",
  "Görüşmemizde tüm sorularınızı rahatça sorabilirsiniz.",
  "Sağlığınız için her adımda yanınızdayız.",
];

// Sağdan-sola yazılan diller (RTL) — Arapça ve Farsça. Hasta arayüzü bu dillerde
// `dir="rtl"` ile yansıtılır (langDir). LTR dillerde davranış değişmez.
const RTL_LANGS = new Set(["Arapça", "Farsça"]);
export function isRtl(lang?: string | null): boolean {
  return !!lang && RTL_LANGS.has(lang);
}
export function langDir(lang?: string | null): "rtl" | "ltr" {
  return isRtl(lang) ? "rtl" : "ltr";
}

export function countryName(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}
export function countryFlag(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.flag ?? "🏳️";
}

export const CASE_STATUS: Record<string, { label: string; color: string }> = {
  NEW: { label: "Yeni", color: "bg-blue-500/15 text-blue-200" },
  IN_REVIEW: { label: "İncelemede", color: "bg-amber-500/15 text-amber-200" },
  IN_CONSULT: { label: "Görüşmede", color: "bg-violet-500/15 text-violet-200" },
  DONE: { label: "Tamamlandı", color: "bg-emerald-500/15 text-emerald-200" },
};

// Aciliyet stili — tema-duyarlı semantic token'lar (gündüz koyu / gece açık ton → her iki temada
// okunur; eski sabit -200/-300 tonları gündüz açık kart zemininde soluk kalıyordu). 5=kırmızı,
// 4=dolu turuncu, 3=hafif turuncu (sayı + etiket ayırır), 2=turkuaz, 1=nötr.
export function urgencyStyle(u: number): { label: string; badge: string; dot: string } {
  if (u >= 5) return { label: "Acil / Hayati", badge: "bg-[var(--c-danger)]/15 text-[var(--c-danger)] ring-[var(--c-danger)]/30", dot: "bg-[var(--c-danger)]" };
  if (u === 4) return { label: "Yüksek", badge: "bg-[var(--c-warning)]/20 text-[var(--c-warning)] ring-[var(--c-warning)]/35", dot: "bg-[var(--c-warning)]" };
  if (u === 3) return { label: "Orta", badge: "bg-[var(--c-warning)]/12 text-[var(--c-warning)] ring-[var(--c-warning)]/22", dot: "bg-[var(--c-warning)]" };
  if (u === 2) return { label: "Düşük", badge: "bg-[var(--c-accent)]/15 text-[var(--c-accent)] ring-[var(--c-accent)]/25", dot: "bg-[var(--c-accent)]" };
  return { label: "Rutin", badge: "bg-[var(--c-ink)]/10 text-[var(--c-ink-2)] ring-white/15", dot: "bg-[var(--c-ink)]/30" };
}

export function formatDateTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  // timeZone sabit: sunucu (Vercel UTC) ile istemci (TR) aynı çıktıyı üretsin → hydration uyuşmazlığı (#418) olmasın
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }).format(date);
}
