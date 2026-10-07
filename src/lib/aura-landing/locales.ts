// Shared landing locale metadata; independent of translated page content.
export type Lang = "en" | "tr" | "de" | "fr" | "ru" | "ar" | "fa" | "az" | "bg";

// Dil secici + <html lang/dir> icin meta (platform LANDING_LOCALES ile ayni set).
export const LANGS: { code: Lang; native: string }[] = [
  { code: "en", native: "English" },
  { code: "tr", native: "Türkçe" },
  { code: "de", native: "Deutsch" },
  { code: "fr", native: "Français" },
  { code: "ru", native: "Русский" },
  { code: "ar", native: "العربية" },
  { code: "fa", native: "فارسی" },
  { code: "az", native: "Azərbaycanca" },
  { code: "bg", native: "Български" },
];
export const LANG_CODES = LANGS.map((l) => l.code);
export function langDir(l: Lang): "rtl" | "ltr" {
  return l === "ar" || l === "fa" ? "rtl" : "ltr";
}

