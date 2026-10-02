import type { Lang } from "@/lib/aura-landing/copy";
import type { ModuleKey } from "./catalog";

// Üç bağımsız modül sitesinin dokuz dildeki ADI — AURA ana sitesinde yalnız bağlantı etiketinde kullanılır
// (components/aura/care-site-links.tsx). Landing ve rehber metinleri burada YOKTUR: o içerik modül sitelerinin kendi
// kaynağında yaşar (👤 karar 2026-10-02; bkz. catalog.ts). Statik; sağlık verisi ya da çeviri çağrısı içermez.
const NAMES: Record<Lang, Record<ModuleKey, string>> = {
  tr: { "second-opinion": "İkinci Görüş", "medical-tourism": "Sağlık Turizmi", "medical-aesthetics": "Medikal Estetik" },
  en: { "second-opinion": "Second Opinion", "medical-tourism": "Medical Tourism", "medical-aesthetics": "Medical Aesthetics" },
  de: { "second-opinion": "Zweitmeinung", "medical-tourism": "Medizintourismus", "medical-aesthetics": "Ästhetische Medizin" },
  fr: { "second-opinion": "Deuxième avis", "medical-tourism": "Tourisme médical", "medical-aesthetics": "Médecine esthétique" },
  ru: { "second-opinion": "Второе мнение", "medical-tourism": "Медицинский туризм", "medical-aesthetics": "Эстетическая медицина" },
  ar: { "second-opinion": "رأي طبي ثانٍ", "medical-tourism": "السياحة العلاجية", "medical-aesthetics": "الطب التجميلي" },
  fa: { "second-opinion": "نظر دوم پزشکی", "medical-tourism": "گردشگری سلامت", "medical-aesthetics": "پزشکی زیبایی" },
  az: { "second-opinion": "İkinci rəy", "medical-tourism": "Sağlamlıq turizmi", "medical-aesthetics": "Tibbi estetika" },
  bg: { "second-opinion": "Второ мнение", "medical-tourism": "Медицински туризъм", "medical-aesthetics": "Естетична медицина" },
};

export function moduleName(lang: Lang, key: ModuleKey): string {
  return NAMES[lang][key];
}
