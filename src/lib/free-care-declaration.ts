// Ücretsiz Sağlık Hizmeti — "yakınım adına" beyanı (kod Paket D, 2026-09-19 — A02 madde 3.4 · A01 madde 12, 👤 R6 12.09.2026).
// Yakını adına bilgi giren kullanıcı, formdaki kutuyu işaretleyerek o kişinin bilgisi ve rızasını aldığını, kişi reşit
// değilse yasal temsilcisi olduğunu beyan eder; kutu işaretlenmeden başvuru GÖNDERİLEMEZ (sunucu 400). Beyan metni
// TR kanonik + EN ikinci kanonik (S4); diğer arayüz dillerinde TR metnin çalışma-anı çevirisi bilgilendirme amaçlıdır.
// Kayıt: onam zincirine DEĞİL denetim zincirine düşer (recordAccess FREECARE_ON_BEHALF_DECLARATION — başvuru başına bir
// beyan; ConsentRecord kullanıcı×kapsam×sürüm tekildir, başvuru başına olmaz). Metin sürümü + sha256 detayda taşınır.
// Saf ve istemci-güvenli (db/env yok): form + api/free-care/apply + birim testi aynı sabitleri okur.
import type { ConsentLang } from "./consent-lang";

export const FREE_CARE_ON_BEHALF_VERSION = 1;

export type FreeCareForWhom = "self" | "relative";

export const FREE_CARE_ON_BEHALF_DECLARATION: Record<ConsentLang, string> = {
  tr:
    "Yakınım adına başvuruyorum: sağlık bilgilerini onun bilgisi ve rızasıyla giriyorum; reşit değilse yasal temsilcisiyim. " +
    "Beyanın doğruluğundan ve sonuçlarından sorumluyum (Kullanım Koşulları madde 3.4).",
  en:
    "I am applying on behalf of a relative: I am entering their health information with their knowledge and consent; if they are a minor, I am their legal representative. " +
    "I am responsible for the accuracy and consequences of this declaration (Terms of Use, Section 3.4).",
};

/** Form sorusu + seçenekler (TR kanonik; diğer diller çalışma-anı çevirisi). */
export const FREE_CARE_FOR_WHOM_TEXTS = {
  question: "Bu başvuru kimin için?",
  self: "Kendim için",
  relative: "Yakınım için",
  missing: "Yakınınız adına başvuru için beyan kutusunu işaretleyin.",
} as const;

export function parseForWhom(v: unknown): FreeCareForWhom {
  return v === "relative" ? "relative" : "self";
}

/** SAF kural: yakını adına başvuruda beyan zorunlu; kendisi için başvuruda kutu sorulmaz. Hata metni ya da null. */
export function onBehalfError(forWhom: FreeCareForWhom, declared: boolean): string | null {
  return forWhom === "relative" && !declared ? FREE_CARE_FOR_WHOM_TEXTS.missing : null;
}
