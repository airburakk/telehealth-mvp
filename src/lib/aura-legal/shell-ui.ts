// Hukuki belge kabuğunun arayüz sözlüğü — SAF modül (Paket 7, v6.285): sunucu sayfası TR değerleri gösterim diline çevirip
// kabuğa geçirir ("use client" modülünden veri export'u RSC'de proxy'ye dönüşür — [[rsc-client-module-data-export]]).
import type { AuraLegalLang } from "./routes";

export type LegalShellUi = {
  eyebrow: string; version: string; operator: string; note: string; nav: string; langGroup: string; tr: string; en: string; other: string;
  auto: string; reviewed: string; // 7-C (v6.286): çeviri kutusunun ilk satırı — otomatik / incelenmiş (tarih kodda eklenir)
};

export const LEGAL_SHELL_UI: Record<AuraLegalLang, LegalShellUi> = {
  tr: {
    eyebrow: "Hukuki belge",
    version: "Sürüm",
    operator: "İşletici",
    note: "Bu belge Türkçe ve İngilizce yayımlanır; çelişki hâlinde Türkçe metin esastır. Diğer arayüz dillerinde bilgilendirme amaçlı çeviri gösterilir.",
    nav: "Hukuki belgeler",
    langGroup: "Belge dili",
    tr: "Türkçe",
    en: "English",
    other: "Diğer diller",
    auto: "Otomatik çeviri (yapay zekâ). Henüz hukuki incelemeden geçmedi.",
    reviewed: "İncelenmiş çeviri. Hukuki inceleme tarihi:",
  },
  en: {
    eyebrow: "Legal document",
    version: "Version",
    operator: "Operator",
    note: "This document is published in Turkish and English; in case of conflict the Turkish text prevails. In the other interface languages an informational translation is shown.",
    nav: "Legal documents",
    langGroup: "Document language",
    tr: "Türkçe",
    en: "English",
    other: "Other languages",
    auto: "Automatic translation (AI). Not yet legally reviewed.",
    reviewed: "Reviewed translation. Legal review date:",
  },
};

/** Çevrilecek TR değerler (gösterim dili TR/EN dışıysa sunucu getTranslations ile çevirir). */
export const LEGAL_SHELL_UI_TR_VALUES: readonly string[] = Object.values(LEGAL_SHELL_UI.tr);
