// Hukuki belge GÖSTERİM dili (Paket 7, v6.285 · 2026-09-20 — 👤 karar A: hastanın seçtiği dilde tam çeviri).
//
// Kanonik dil (tr/en, routes.ts auraLegalLang) hukuken bağlayıcı metni seçer; GÖSTERİM dili hastanın arayüz dilidir
// (lib/constants LANGUAGES — 11 dil). tr → TR kanonik · en → EN kanonik · diğer → EN kanonik + o dilde bilgilendirme
// çevirisi (lib/legal-translate; kabuk notu "bağlayıcı metin Türkçe"). `?lang=` kod (ru/de/…) ya da dil ADI kabul eder;
// değer yoksa oturumlu hastanın profil dili (fallback) → o da yoksa TR. Saf modül (client + server + test).
import { LANGUAGES, LANG_NAME_BY_CODE, langCodeFor } from "@/lib/constants";
import type { AuraLegalLang } from "./routes";

export type LegalDisplay = { canonical: AuraLegalLang; display: string; code: string; translated: boolean };

function toName(v: string | undefined): string | null {
  if (!v) return null;
  return LANG_NAME_BY_CODE[v] ?? (LANGUAGES.includes(v) ? v : null);
}

export function resolveLegalDisplay(value: string | string[] | undefined | null, fallbackName?: string | null): LegalDisplay {
  const v = (Array.isArray(value) ? value[0] : value)?.trim();
  const name = toName(v) ?? toName(fallbackName ?? undefined) ?? "Türkçe";
  if (name === "Türkçe") return { canonical: "tr", display: "Türkçe", code: "tr", translated: false };
  if (name === "İngilizce") return { canonical: "en", display: "İngilizce", code: "en", translated: false };
  return { canonical: "en", display: name, code: langCodeFor(name) ?? "en", translated: true };
}

/** Gösterim diline göre belge bağlantısı — TR yol · EN ?lang=en · diğer ?lang=<kod>. */
export function auraLegalHrefFor(path: string, displayName: string): string {
  const code = langCodeFor(displayName) ?? "tr";
  return code === "tr" ? path : `${path}?lang=${code}`;
}

/** Dil seçicide dilin KENDİ adı (Türkçe ad yerine — "Rusça" Rus okura yabancıdır). */
export const LANG_NATIVE_NAME: Record<string, string> = {
  "Türkçe": "Türkçe", "İngilizce": "English", "Rusça": "Русский", "Azerice": "Azərbaycanca", "Arapça": "العربية", "Farsça": "فارسی",
  "Fransızca": "Français", "Almanca": "Deutsch", "Kazakça": "Қазақша", "Kırgızca": "Кыргызча", "Bulgarca": "Български",
};

/** Arayüz dillerinden RTL olanlar (belge gövdesi yönü). */
export function legalDir(code: string): "rtl" | "ltr" {
  return code === "ar" || code === "fa" ? "rtl" : "ltr";
}

// Kabuk ve kapı notları — TR kanonik; gösterim diline useT/getTranslations ile çevrilir.
export const LEGAL_DISPLAY_NOTE_TR = "Bu çeviri bilgilendirme amaçlıdır; hukuken bağlayıcı metin Türkçe (ikincil İngilizce) kanonik metindir.";
export const LEGAL_DISPLAY_PARTIAL_TR = "Bazı paragraflar henüz çevrilemedi ve Türkçe görünüyor.";
export const LEGAL_CANONICAL_LINK_TR = "Bağlayıcı metni aç";
export const LEGAL_CANONICAL_SECTION_TR = "Bağlayıcı metin (İngilizce)";
