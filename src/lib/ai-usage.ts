// AI kullanım sayacı (v6.298, 2026-09-21 — kontrol raporu K6, 👤 "günlük toplam tablosu").
//
// NE: her Anthropic çağrısı (ve Gemini Live token üretimi) gün (UTC) × özellik × model satırına çağrı/hata/token
// sayıları olarak eklenir (AiUsageDaily). İÇERİK YOK — prompt, yanıt, hasta verisi, kullanıcı kimliği yazılmaz
// (asla-loglama kuralı: lib/alerts.ts). Amaç: aylık Console faturasını özelliğe bölmek (/admin/ai-kullanim).
//
// NASIL: `trackedCreate(client, feature, params)` = `client.messages.create(params)` + sayaç. Sayaç FAIL-OPEN —
// DB/ağ hatası AI yolunu ASLA bozmaz (yalnız console.warn). Prisma upsert yarışı (aynı gün×özellik×model satırını iki
// eşzamanlı istek ilk kez yazarken P2002) bir kez yeniden denenir; ikinci deneme update yoluna düşer.
//
// 🪤 Gün UTC'dir (Console da UTC) — TR günü değil. Tahminî USD (estimateUsd) bilgi amaçlıdır: fiyat tablosu elle güncellenir
// (AI_PRICES_USD_PER_MTOK, tarih aşağıda); Console faturası esastır.
import type Anthropic from "@anthropic-ai/sdk";
import { db } from "./db";

export type AiFeature =
  | "triage"                 // lib/triage-llm — hasta triyajı (branş + aciliyet)
  | "soap"                   // ai-clinical.summarizeSOAP
  | "suggest-procedures"     // ai-clinical.suggestProcedures
  | "translate-text"         // ai-clinical.translateText (çeviri düğmesi · konsültasyon · liste başlığı)
  | "redact-names"           // ai-clinical.redactPersonNames (havuz özeti)
  | "legal-i18n"             // ai-clinical.translateLegalBatch (hukuki belgeler)
  | "batch-translate"        // ai-clinical.translateBatch (arayüz sözlüğü + klinik serbest metin)
  | "discharge"              // ai-clinical.generateDischarge
  | "postop-note"            // ai-clinical.assessPostopNote
  | "postop-photo"           // ai-clinical.assessPostopPhoto
  | "doc-analysis"           // ai-clinical.assessDocument
  | "news-summary"           // ai-clinical.summarizeArticleForClinician (cron generate-ai-summaries + tembel yol)
  | "regulation-summary"     // ai-clinical.summarizeRegulationForClinician
  | "news-title-translate"   // lib/translate-news (ingest)
  | "news-summary-translate" // lib/translate-news (cron translate-news)
  | "live-token";            // api/realtime/token — Gemini Live oturumu (token adedi; dakika ücreti Google'da)

export const AI_FEATURE_LABEL: Record<AiFeature, string> = {
  "triage": "Triyaj (branş + aciliyet)",
  "soap": "SOAP görüşme özeti",
  "suggest-procedures": "KSHFT işlem önerisi",
  "translate-text": "Metin çevirisi (düğme / konsültasyon)",
  "redact-names": "Kişi adı redaksiyonu (havuz)",
  "legal-i18n": "Hukuki belge çevirisi",
  "batch-translate": "Arayüz + klinik toplu çeviri",
  "discharge": "Epikriz / taburcu",
  "postop-note": "Post-op not değerlendirmesi",
  "postop-photo": "Post-op fotoğraf değerlendirmesi",
  "doc-analysis": "Belge analizi",
  "news-summary": "Doctorium AI özeti (akademik/ilaç/sektörel)",
  "regulation-summary": "Doctorium mevzuat özeti",
  "news-title-translate": "Haber başlığı çevirisi (gece)",
  "news-summary-translate": "Haber özet girişi çevirisi (gece)",
  "live-token": "Canlı tercüman oturumu (Gemini)",
};

/** Fiyat listesi USD / 1M token — claude-api referansı, 2026-06-24 (elle güncellenir). Önbellek: okuma ×0,1 · yazma ×1,25 (standart). */
export const AI_PRICES_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 5, output: 25 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};
export const AI_PRICES_ASOF = "2026-06-24";

export type UsageLike = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

export interface AiUsageRow {
  day: string;
  feature: string;
  model: string;
  calls: number;
  errors: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

/** UTC gün anahtarı "YYYY-MM-DD" (Console ile aynı takvim). */
export function utcDay(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Tahminî maliyet (USD). Model fiyat tablosunda yoksa null (ör. Gemini token sayımı). */
export function estimateUsd(row: Pick<AiUsageRow, "model" | "inputTokens" | "outputTokens" | "cacheReadTokens" | "cacheWriteTokens">): number | null {
  const key = Object.keys(AI_PRICES_USD_PER_MTOK).find((k) => row.model === k || row.model.startsWith(k + "-"));
  if (!key) return null;
  const p = AI_PRICES_USD_PER_MTOK[key];
  const usd = (row.inputTokens * p.input + row.outputTokens * p.output + row.cacheReadTokens * p.input * 0.1 + row.cacheWriteTokens * p.input * 1.25) / 1_000_000;
  return Math.round(usd * 10_000) / 10_000;
}

const n = (v: number | null | undefined): number => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : 0);

/** Sayaç yazımı — FAIL-OPEN: hiçbir koşulda fırlatmaz. */
export async function recordAiUsage(e: { feature: AiFeature; model: string; usage: UsageLike | null | undefined; ok: boolean }): Promise<void> {
  const day = utcDay();
  const u = e.usage ?? {};
  const inc = {
    errors: e.ok ? 0 : 1,
    inputTokens: n(u.input_tokens),
    outputTokens: n(u.output_tokens),
    cacheReadTokens: n(u.cache_read_input_tokens),
    cacheWriteTokens: n(u.cache_creation_input_tokens),
  };
  const model = e.model || "unknown";
  const upsert = () =>
    db.aiUsageDaily.upsert({
      where: { day_feature_model: { day, feature: e.feature, model } },
      create: { day, feature: e.feature, model, calls: 1, ...inc },
      update: {
        calls: { increment: 1 },
        errors: { increment: inc.errors },
        inputTokens: { increment: inc.inputTokens },
        outputTokens: { increment: inc.outputTokens },
        cacheReadTokens: { increment: inc.cacheReadTokens },
        cacheWriteTokens: { increment: inc.cacheWriteTokens },
      },
    });
  try {
    try {
      await upsert();
    } catch (err) {
      // Yarış: iki eşzamanlı ilk yazım → P2002; satır artık var, ikinci deneme update yoluna düşer.
      if ((err as { code?: string }).code === "P2002") await upsert();
      else throw err;
    }
  } catch (err) {
    console.warn("[ai-usage] sayaç yazılamadı (AI yolu etkilenmedi):", err instanceof Error ? err.message : err);
  }
}

/** `client.messages.create` + sayaç. Hata sayılır ve AYNEN yeniden fırlatılır (çağıranın fallback mantığı değişmez). */
export async function trackedCreate(
  client: Anthropic,
  feature: AiFeature,
  params: Anthropic.MessageCreateParamsNonStreaming,
): Promise<Anthropic.Message> {
  let res: Anthropic.Message;
  try {
    res = await client.messages.create(params);
  } catch (e) {
    await recordAiUsage({ feature, model: params.model, usage: null, ok: false });
    throw e;
  }
  await recordAiUsage({ feature, model: res.model || params.model, usage: res.usage, ok: true });
  return res;
}

/** Son N günün satırları (admin görünümü). */
export async function listAiUsage(days = 30): Promise<AiUsageRow[]> {
  const since = utcDay(new Date(Date.now() - (days - 1) * 86_400_000));
  return db.aiUsageDaily.findMany({
    where: { day: { gte: since } },
    orderBy: [{ day: "desc" }, { feature: "asc" }, { model: "asc" }],
    select: { day: true, feature: true, model: true, calls: true, errors: true, inputTokens: true, outputTokens: true, cacheReadTokens: true, cacheWriteTokens: true },
  });
}
