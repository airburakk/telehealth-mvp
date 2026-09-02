// Haber kaynaklarının DİL profili — tek doğruluk kaynağı (2026-09-02 akşam, kullanıcı kararı:
// "bültende İngilizce olmasın" kuralı ilaç modülünden sektörel akışa GENİŞLEDİ).
//
// Neden ayrı ve hafif bir modül: hem ingest (lib/doctorium-sources — db + Anthropic bağımlı) hem
// kamuya açık seçki (lib/social-digest — SAF, birim testli) aynı kümeye bakar; seçkinin ağır ingest
// modülünü içe aktarması gerekmesin.
//
// Kural: `source` anahtarı (NewsArticle.source) esas alınır, `sourceName` DEĞİL — görünen ad ürün
// yüzeyinde değişebilir, anahtar idempotent kimliktir (source, externalId).

import type { Prisma } from "@prisma/client";

/**
 * Başlıkları İngilizce DOĞAN sektörel kaynaklar (source anahtarı). openFDA/ClinicalTrials ilaç
 * modülünde ayrı kuralla (module === "ilac") zaten çevrilir — burada tekrarlanmaz.
 * ⚠️ Yeni bir İngilizce besleme eklenirse buraya da eklenir; sözleşme testi (news-language.test)
 * RSS_SOURCES'taki genel medya kaynaklarının hepsinin bu kümede olmasını şart koşar.
 */
export const FOREIGN_LANGUAGE_SOURCES: ReadonlySet<string> = new Set(["medscape", "medicalxpress", "who"]);

/**
 * Ingest'te başlık çevirisi gerekir mi — ilaç modülü + İngilizce sektörel kaynaklar. Türkçe doğan
 * kaynaklar (RG/SGK/OHSAD/TTB/İTO/dernekler) çeviriden GEÇMEZ: gereksiz LLM maliyeti + "zaten
 * Türkçe metni çevirtme" riski (runtime tekrar-çeviri dersi, `8d76d36`).
 */
export function needsTitleTranslation(a: { module: string; source: string }): boolean {
  return a.module === "ilac" || FOREIGN_LANGUAGE_SOURCES.has(a.source);
}

/** Yerli (Türkçe doğan) kaynak mı — seçkide sektörel önceliği (lib/social-digest). */
export function isNativeTurkishSource(source: string): boolean {
  return !FOREIGN_LANGUAGE_SOURCES.has(source);
}

/** Özet çevirisinde modül bazında kapsam — akademik (PubMed/EPMC/DOAJ) ve ilaç (openFDA/ClinicalTrials) İngilizce doğar. */
export const TRANSLATED_MODULES: readonly string[] = ["akademik", "ilac"];

/**
 * ÖZET girişi çevirisi gerekir mi (v6.206 — api/cron/translate-news → lib/translate-summaries).
 * Başlık kuralından farkı: akademik hat da buradadır (başlığı doctorium-ingest'te toplu çevrilir, özeti
 * bu cron'da). Başlığı çevrilen her kaynağın özeti de çevrilir (sözleşme testi: alt küme).
 */
export function needsSummaryTranslation(a: { module: string; source: string }): boolean {
  return TRANSLATED_MODULES.includes(a.module) || FOREIGN_LANGUAGE_SOURCES.has(a.source);
}

/**
 * Çeviri cron'unun seçim süzgeci — needsSummaryTranslation'ın SQL karşılığı (ikisi BİRLİKTE değişir;
 * news-language.test kilitler). `summaryOriginal IS NULL` = henüz işlenmedi ("işlendi" damgası aynı
 * kolondur — lib/translate-summaries sözleşmesi); boş özet seçilmez (çevrilecek şey yok).
 */
export function summaryTranslationWhere(): Prisma.NewsArticleWhereInput {
  return {
    summaryOriginal: null,
    summary: { not: "" },
    OR: [{ module: { in: [...TRANSLATED_MODULES] } }, { source: { in: [...FOREIGN_LANGUAGE_SOURCES] } }],
  };
}
