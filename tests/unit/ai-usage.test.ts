// Birim — v6.298 (K6): AI kullanım sayacı. Kilitler: upsert artırım şekli + UTC gün, FAIL-OPEN (asla fırlatmaz), P2002 yarış
// yeniden denemesi, trackedCreate'in başarı/hata sayımı ve hatayı AYNEN yeniden fırlatması, tahminî USD ve bilinmeyen model → null.
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ db: { aiUsageDaily: { upsert: vi.fn(), findMany: vi.fn() } } }));
import { db } from "@/lib/db";
import { estimateUsd, recordAiUsage, trackedCreate, utcDay, AI_FEATURE_LABEL } from "@/lib/ai-usage";
import type Anthropic from "@anthropic-ai/sdk";

const upsert = vi.mocked(db.aiUsageDaily.upsert);
beforeEach(() => { upsert.mockReset().mockResolvedValue({} as never); vi.spyOn(console, "warn").mockImplementation(() => {}); });

describe("recordAiUsage", () => {
  it("gün×özellik×model anahtarıyla upsert; create=ilk değerler, update=increment; gün UTC", async () => {
    await recordAiUsage({ feature: "soap", model: "claude-sonnet-4-6", usage: { input_tokens: 120, output_tokens: 30, cache_read_input_tokens: 5, cache_creation_input_tokens: 0 }, ok: true });
    expect(upsert).toHaveBeenCalledTimes(1);
    const arg = upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ day_feature_model: { day: utcDay(), feature: "soap", model: "claude-sonnet-4-6" } });
    expect(arg.create).toEqual({ day: utcDay(), feature: "soap", model: "claude-sonnet-4-6", calls: 1, errors: 0, inputTokens: 120, outputTokens: 30, cacheReadTokens: 5, cacheWriteTokens: 0 });
    expect(arg.update).toEqual({ calls: { increment: 1 }, errors: { increment: 0 }, inputTokens: { increment: 120 }, outputTokens: { increment: 30 }, cacheReadTokens: { increment: 5 }, cacheWriteTokens: { increment: 0 } });
    expect(utcDay(new Date("2026-09-21T23:30:00Z"))).toBe("2026-09-21");
  });
  it("hata çağrısı: usage yok → token 0, errors 1", async () => {
    await recordAiUsage({ feature: "triage", model: "claude-sonnet-4-6", usage: null, ok: false });
    expect(upsert.mock.calls[0][0].create).toMatchObject({ calls: 1, errors: 1, inputTokens: 0, outputTokens: 0 });
  });
  it("FAIL-OPEN: DB hatası fırlatılmaz, yalnız warn", async () => {
    upsert.mockRejectedValue(new Error("db down"));
    await expect(recordAiUsage({ feature: "soap", model: "m", usage: null, ok: true })).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalled();
  });
  it("P2002 yarışı bir kez yeniden denenir", async () => {
    upsert.mockRejectedValueOnce(Object.assign(new Error("unique"), { code: "P2002" })).mockResolvedValueOnce({} as never);
    await recordAiUsage({ feature: "soap", model: "m", usage: null, ok: true });
    expect(upsert).toHaveBeenCalledTimes(2);
  });
});

describe("trackedCreate", () => {
  it("başarı: yanıtın model + usage'ı sayılır, yanıt aynen döner", async () => {
    const res = { model: "claude-haiku-4-5", usage: { input_tokens: 10, output_tokens: 4 }, content: [] } as unknown as Anthropic.Message;
    const client = { messages: { create: vi.fn(async () => res) } } as unknown as Anthropic;
    const out = await trackedCreate(client, "news-summary", { model: "claude-haiku-4-5", max_tokens: 10, messages: [] });
    expect(out).toBe(res);
    expect(upsert.mock.calls[0][0].where).toEqual({ day_feature_model: { day: utcDay(), feature: "news-summary", model: "claude-haiku-4-5" } });
    expect(upsert.mock.calls[0][0].create).toMatchObject({ calls: 1, errors: 0, inputTokens: 10, outputTokens: 4 });
  });
  it("hata: errors 1 sayılır ve AYNI hata yeniden fırlatılır (fallback mantığı değişmez)", async () => {
    const boom = Object.assign(new Error("429"), { status: 429 });
    const client = { messages: { create: vi.fn(async () => { throw boom; }) } } as unknown as Anthropic;
    await expect(trackedCreate(client, "triage", { model: "claude-sonnet-4-6", max_tokens: 10, messages: [] })).rejects.toBe(boom);
    expect(upsert.mock.calls[0][0].create).toMatchObject({ errors: 1, model: "claude-sonnet-4-6" });
  });
});

describe("estimateUsd", () => {
  it("Haiku: 1M giriş = 1 $, 1M çıkış = 5 $; önbellek okuma ×0,1", () => {
    expect(estimateUsd({ model: "claude-haiku-4-5", inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 })).toBe(1);
    expect(estimateUsd({ model: "claude-haiku-4-5", inputTokens: 0, outputTokens: 1_000_000, cacheReadTokens: 0, cacheWriteTokens: 0 })).toBe(5);
    expect(estimateUsd({ model: "claude-haiku-4-5", inputTokens: 0, outputTokens: 0, cacheReadTokens: 1_000_000, cacheWriteTokens: 0 })).toBe(0.1);
  });
  it("bilinmeyen model (Gemini) → null; tarih sonekli id tabloya eşlenir", () => {
    expect(estimateUsd({ model: "gemini-3.5-live-translate-preview", inputTokens: 5, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0 })).toBeNull();
    expect(estimateUsd({ model: "claude-sonnet-4-6-20260101", inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 })).toBe(3);
  });
  it("her özelliğin Türkçe etiketi var", () => {
    for (const v of Object.values(AI_FEATURE_LABEL)) expect(v.length).toBeGreaterThan(3);
  });
});
