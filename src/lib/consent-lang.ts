// Onam metni DİLİ (kod Paket B, v6.269 · 2026-09-13) — saf modül (db/auth yok; client + server + proxy-güvenli).
//
// S4 kararı (12.09.2026): hukuki metinler TR kanonik + EN ikinci kanonik; hash DİL BAŞINA ayrı (gösterilen metin
// hash'lenir — ekran = hash). Hasta arayüzü 9+ dilde çalışır; Türkçe dışındaki her arayüz dilinde onam ekranı
// İNGİLİZCE kanonik metni gösterir ve "çelişkide TR esastır" notunu taşır. Diğer dillerde metnin anlaşılması için
// kapılar ayrıca "bilgilendirme amaçlı çeviri" (useT, hash DIŞI) gösterebilir — hukuken bağlayıcı olan yalnız
// gösterilen kanonik metindir.
export type ConsentLang = "tr" | "en";

/** Hasta dil ADI (air_lang / User.patientLanguage: "Türkçe", "Rusça", …) → onam metni dili. */
export function consentLangFor(langName?: string | null): ConsentLang {
  return !langName || langName === "Türkçe" ? "tr" : "en";
}

/** API gövdesindeki `lang` alanı → onam dili (yalnız "en" İngilizce; her şey TR'ye düşer — kanonik). */
export function consentLangParam(value: unknown): ConsentLang {
  return value === "en" ? "en" : "tr";
}

/** Arayüz dili kanonik iki dilden biri mi (değilse kapı bilgilendirme çevirisi de gösterir)? */
export function needsCourtesyTranslation(langName?: string | null): boolean {
  return !!langName && langName !== "Türkçe" && langName !== "İngilizce";
}

/**
 * Markdown onam metnini düz metne indirger — YALNIZ bilgilendirme çevirisinin (useT) girdisi için; hash'lenen
 * metin DEĞİŞMEZ. Kalın/italik/kod işaretleri, blockquote ">" ve kutu glifi düşer, bağlantı metni kalır.
 */
export function plainLegalText(md: string): string {
  return md
    .replace(/^> ?/gm, "") // yalnız boşluk: \s satır sonunu da yutar (boş ">" satırı paragraf ayracını silerdi)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/☐\s*/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Kapıların dil notu (kanonik ikisi dışındaki arayüz dillerinde de gösterilir). */
export const CONSENT_LANG_NOTE: Record<ConsentLang, string> = {
  tr: "Bu metin Türkçe ve İngilizce yayımlanır; çelişki hâlinde Türkçe metin esastır. Onayınız, ekranda gösterilen metnin özeti (hash) ile kaydedilir.",
  en: "This text is published in Turkish and English; in case of conflict the Turkish text prevails. Your consent is recorded with a hash of the text shown on screen.",
};
