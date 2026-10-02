// Birim — v6.298 (K6): AI kullanım sayacı. Kilitler: upsert artırım şekli + UTC gün, FAIL-OPEN (asla fırlatmaz), P2002 yarış
// yeniden denemesi, trackedCreate'in başarı/hata sayımı ve hatayı AYNEN yeniden fırlatması, tahminî USD ve bilinmeyen model → null.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ db: { aiUsageDaily: { upsert: vi.fn(), findMany: vi.fn() } } }));
import { db } from "@/lib/db";
import { estimateUsd, recordAiUsage, trackedCreate, usageByDayFeature, utcDay, AI_FEATURE_LABEL, type AiUsageRow } from "@/lib/ai-usage";
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
  it("özet etiketleri YÖNLENDİRMEYİ söyler: akademik → news-summary; mevzuat + ilaç + sektörel → regulation-summary (v6.313)", () => {
    // lib/doctorium generatePendingAiSummaries: module === "akademik" ? ensureClinicalSummary : ensureRegulationSummary.
    // Yönlendirmenin kendisi de kilitli: bu desen değişirse etiketler yeniden düşünülmeli (test bilinçli olarak kırılır).
    const src = readFileSync(join(process.cwd(), "src/lib/doctorium.ts"), "utf8");
    expect(src).toMatch(/if \(r\.module === "akademik"\) \{\s*const s = await ensureClinicalSummary\(r\.id\);[\s\S]{0,160}\} else \{\s*const s = await ensureRegulationSummary\(r\.id\);/);
    expect(AI_FEATURE_LABEL["news-summary"]).toMatch(/akademik/i);
    expect(AI_FEATURE_LABEL["news-summary"]).not.toMatch(/sektörel|ilaç|mevzuat/i);
    for (const k of ["mevzuat", "ilaç", "sektörel"]) expect(AI_FEATURE_LABEL["regulation-summary"]).toContain(k);
  });
});

// v6.312 — gün × özellik kırılımı: "o günkü tepe hangi özellikten geldi?" sorusu sayfadan yanıtlanır.
describe("usageByDayFeature", () => {
  const row = (day: string, feature: string, model: string, calls: number, inputTokens: number, outputTokens = 0): AiUsageRow =>
    ({ day, feature, model, calls, errors: 0, inputTokens, outputTokens, cacheReadTokens: 0, cacheWriteTokens: 0 });
  const HAIKU = "claude-haiku-4-5-20251001";

  it("boş girdi → boş matris", () => {
    expect(usageByDayFeature([])).toEqual({ features: [], days: [] });
  });

  it("günler yeniden eskiye; hücre = o gün o özelliğin çağrı + tahminî tutarı; gün toplamı hücrelerin toplamı", () => {
    const m = usageByDayFeature([
      row("2026-09-29", "news-summary", HAIKU, 20, 100_000),
      row("2026-09-30", "news-summary", HAIKU, 60, 300_000),
      row("2026-09-30", "legal-i18n", "claude-sonnet-4-6", 21, 100_000),
      row("2026-09-30", "news-title-translate", HAIKU, 50, 50_000),
    ]);
    expect(m.days.map((d) => d.day)).toEqual(["2026-09-30", "2026-09-29"]);
    const d30 = m.days[0];
    expect(d30.calls).toBe(131);
    expect(d30.cells["news-summary"]).toEqual({ calls: 60, usd: 0.3 });
    expect(d30.cells["legal-i18n"]).toEqual({ calls: 21, usd: 0.3 });
    expect(d30.cells["news-title-translate"]).toEqual({ calls: 50, usd: 0.05 });
    expect(d30.usd).toBeCloseTo(0.65, 6);
    // 29 Eylül'de hukuki çeviri ve başlık çevirisi YOK → hücre tanımsız (sayfada "—").
    expect(m.days[1].cells).toEqual({ "news-summary": { calls: 20, usd: 0.1 } });
  });

  it("özellik sütunları dönem toplamı tutara göre büyükten küçüğe; eşit tutarda çağrı sayısı, sonra ad", () => {
    const m = usageByDayFeature([
      row("2026-10-01", "news-title-translate", HAIKU, 500, 100_000), // 0,10 $
      row("2026-10-01", "news-summary", HAIKU, 30, 400_000), //             0,40 $
      row("2026-10-02", "regulation-summary", HAIKU, 40, 100_000), //       0,10 $ — başlık çevirisiyle eşit tutar, daha az çağrı
      row("2026-10-02", "soap", HAIKU, 40, 100_000), //                     0,10 $ — mevzuat özetiyle eşit tutar ve çağrı → ada göre
    ]);
    expect(m.features).toEqual(["news-summary", "news-title-translate", "regulation-summary", "soap"]);
  });

  it("aynı özelliğin farklı modelleri tek hücrede toplanır; fiyatı bilinmeyen model tutara 0 katar ama çağrısı sayılır", () => {
    const m = usageByDayFeature([
      row("2026-10-02", "news-summary", HAIKU, 10, 1_000_000), //            1 $
      row("2026-10-02", "news-summary", "claude-sonnet-4-6", 2, 1_000_000), // 3 $
      row("2026-10-02", "live-token", "gemini-3.5-live-translate-preview", 7, 999),
    ]);
    expect(m.days).toHaveLength(1);
    expect(m.days[0].cells["news-summary"]).toEqual({ calls: 12, usd: 4 });
    expect(m.days[0].cells["live-token"]).toEqual({ calls: 7, usd: 0 });
    expect(m.days[0]).toMatchObject({ calls: 19, usd: 4 });
    expect(m.features).toEqual(["news-summary", "live-token"]);
  });
});
