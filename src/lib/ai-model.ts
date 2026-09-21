// Model seçimi yardımcıları (v6.293, 2026-09-21) — TEK KAYNAK: gece hatlarının modeli ortam değişkeniyle seçilir
// (TRIAGE_MODEL kalıbı; Vercel'den kod değişikliği olmadan) ve efor parametresi yalnız onu kabul eden modellere gider.
//
// 🪤 Haiku 4.5 `output_config.effort`'u KABUL ETMEZ (400). Fail-open hatlarda (lib/translate-news) bu 400 sessizce
// "hepsi İngilizce kaldı"ya dönüşür; fail-closed hatlarda (AI özetleri) cron her kayıtta hata sayar. Bu yüzden efor
// kararı burada tek noktada verilir (birim testli). Sampling parametresi (temperature/top_p) hiçbir modele gönderilmez —
// Sonnet 5 / Opus 5'te 400 verir (lib/triage-llm notu).
export type EffortLevel = "low" | "medium" | "high";

/** Ortam değişkeninden model adı: tanımsız / boş / yalnız boşluk → varsayılan. */
export function pickModel(env: Record<string, string | undefined>, key: string, fallback: string): string {
  return env[key]?.trim() || fallback;
}

/** Efor parametresini kabul eden model mi? Haiku ailesi etmez (claude-api effort tablosu). */
export function supportsEffort(model: string): boolean {
  return !/^claude-haiku/.test(model);
}

/** İstek gövdesinin model kısmı: model + (destekleniyorsa) efor. Spread ile kullanılır: `...modelParams(m, "low")`. */
export function modelParams(model: string, effort: EffortLevel): { model: string; output_config?: { effort: EffortLevel } } {
  return supportsEffort(model) ? { model, output_config: { effort } } : { model };
}
