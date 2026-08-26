import type { SectionId } from "@/lib/doctorium-landing/content";

// V3 tema haritası — content.ts'teki `theme` alanından BİLİNÇLİ olarak bağımsız (o alan v2'nin
// mekanik dark/light/deep alternasyonunu taşır ve v2 dondurulduğu için değişmez).
//
// 2026-08-26 (kullanıcı, üç adımda): "zebra kalksın — tek koyu blok hero" → "hero da koyu
// olmasın, video gelecek" → NİHAİ: hero film13 VIDEO-zeminli (LandingSection kullanmaz, paletini
// Hero.tsx kendisi taşır — bu haritanın dışındadır); LandingSection'lı 13 bölümün tamamı açık.
// Koyu görünen diğer şeyler ProductFrame ürün pencereleridir (kendi --c-* teması). Mekanizma
// ileride tekil bir koyu vurgu istenirse dursun diye korunuyor.
export type V3Theme = "light" | "dark";

export const V3_SECTION_THEME: Partial<Record<SectionId, V3Theme>> = {};

export function v3Theme(id: SectionId): V3Theme {
  return V3_SECTION_THEME[id] ?? "light";
}
