import { describe, expect, it } from "vitest";
import { modelParams, pickModel, supportsEffort } from "@/lib/ai-model";
import { NEWS_SUMMARY_DEFAULT_MODEL, resolveNewsSummaryModel } from "@/lib/ai-clinical";

// v6.293 (2026-09-21) — gece hatlarının model seçimi TEK KAYNAK: efor parametresi yalnız kabul eden modellere gider
// (Haiku 4.5 400 verir; fail-open hatta sessiz "İngilizce kaldı", fail-closed hatta cron hatası olurdu).
describe("lib/ai-model — model seçimi tek kaynak", () => {
  it("pickModel: tanımsız / boş / boşluk → varsayılan; dolu → kırpılmış değer", () => {
    expect(pickModel({}, "X_MODEL", "claude-haiku-4-5")).toBe("claude-haiku-4-5");
    expect(pickModel({ X_MODEL: "" }, "X_MODEL", "claude-haiku-4-5")).toBe("claude-haiku-4-5");
    expect(pickModel({ X_MODEL: "   " }, "X_MODEL", "claude-haiku-4-5")).toBe("claude-haiku-4-5");
    expect(pickModel({ X_MODEL: " claude-sonnet-5 " }, "X_MODEL", "claude-haiku-4-5")).toBe("claude-sonnet-5");
  });
  it("supportsEffort: Haiku ailesi hayır, Sonnet/Opus evet", () => {
    expect(supportsEffort("claude-haiku-4-5")).toBe(false);
    expect(supportsEffort("claude-sonnet-4-6")).toBe(true);
    expect(supportsEffort("claude-sonnet-5")).toBe(true);
    expect(supportsEffort("claude-opus-5")).toBe(true);
  });
  it("modelParams: Haiku'da output_config YOK, diğerlerinde verilen efor", () => {
    expect(modelParams("claude-haiku-4-5", "low")).toEqual({ model: "claude-haiku-4-5" });
    expect("output_config" in modelParams("claude-haiku-4-5", "low")).toBe(false);
    expect(modelParams("claude-sonnet-5", "low")).toEqual({ model: "claude-sonnet-5", output_config: { effort: "low" } });
  });
});

describe("resolveNewsSummaryModel — Doctorium AI özet modeli (v6.293, Sonnet 4.6'dan iniş)", () => {
  it("varsayılan Haiku 4.5; Sonnet 4.6 artık varsayılan değil", () => {
    expect(NEWS_SUMMARY_DEFAULT_MODEL).toBe("claude-haiku-4-5");
    expect(resolveNewsSummaryModel({})).toBe("claude-haiku-4-5");
  });
  it("NEWS_SUMMARY_MODEL ortam değişkeni modeli değiştirir (kalite için Sonnet)", () => {
    expect(resolveNewsSummaryModel({ NEWS_SUMMARY_MODEL: "claude-sonnet-4-6" })).toBe("claude-sonnet-4-6");
    expect(resolveNewsSummaryModel({ NEWS_SUMMARY_MODEL: "  " })).toBe("claude-haiku-4-5");
  });
  it("klinik belge modelinden BAĞIMSIZ: TRIAGE_MODEL / NEWS_TRANSLATE_MODEL bu seçimi etkilemez", () => {
    expect(resolveNewsSummaryModel({ TRIAGE_MODEL: "claude-opus-5", NEWS_TRANSLATE_MODEL: "claude-sonnet-5" })).toBe("claude-haiku-4-5");
  });
});
