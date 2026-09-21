// Birim — lib/ai-clinical translateLegalBatch (7-C düzeltmesi, v6.300 · 2026-09-22): TEK öğeli çağrı SKALER araca (submit_translation,
// `translation` string) gider — model uzun paragrafı (koşullar 5.1 "→" adımları, (a)/(b)/(c)) parçalara bölemez, tırnaklar korunur;
// çok öğeli çağrı dizi aracında kalır ve sayı uyuşmazlığı iki denemeden sonra fırlatır (kaymış hizada yanlış eşleşme önbelleğe YAZILMAZ).
// Anthropic SDK mock'lu (ai-minimize.test deseni); sayaç katmanı (ai-usage) mock → DB'ye dokunmaz.
import { describe, it, expect, vi, beforeEach } from "vitest";

const createMock = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: createMock };
  },
}));
vi.mock("@/lib/ai-usage", () => ({
  trackedCreate: (client: { messages: { create: (p: unknown) => unknown } }, _feature: string, params: unknown) => client.messages.create(params),
}));

import { translateLegalBatch } from "@/lib/ai-clinical";

type Call = { tools: { name: string }[]; tool_choice: { name: string }; messages: { content: string }[]; system: string };
const toolUse = (name: string, input: unknown) => ({ content: [{ type: "tool_use", name, input }] });
const lastCall = () => createMock.mock.calls.at(-1)?.[0] as Call;

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  createMock.mockReset();
});

describe("translateLegalBatch — tek öğe = skaler araç", () => {
  it("tek metin submit_translation aracıyla, ham metin olarak gider; çeviri dizi sarmalanmadan döner", async () => {
    createMock.mockResolvedValueOnce(toolUse("submit_translation", { translation: "**5.1. Консултация.** А → Б → В „ще ги осигуря“ (а) … (б) …" }));
    const out = await translateLegalBatch(["**5.1. Görüşme.** A → B → C \"temin edeceğim\" (a) … (b) …"], "Bulgarca");
    expect(out).toEqual(["**5.1. Консултация.** А → Б → В „ще ги осигуря“ (а) … (б) …"]);
    const call = lastCall();
    expect(call.tools.map((t) => t.name)).toEqual(["submit_translation"]);
    expect(call.tool_choice.name).toBe("submit_translation");
    expect(call.messages[0].content).toBe("**5.1. Görüşme.** A → B → C \"temin edeceğim\" (a) … (b) …"); // JSON dizisi DEĞİL
    expect(call.system).toMatch(/BÖLME/);
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("boş/geçersiz translation → bir kez daha dener, ikincisi de bozuksa fırlatır (önbelleğe yazılmaz)", async () => {
    createMock.mockResolvedValueOnce(toolUse("submit_translation", { translation: "   " }));
    createMock.mockResolvedValueOnce(toolUse("submit_translation", { translations: ["parça 1", "parça 2"] }));
    await expect(translateLegalBatch(["Tek paragraf."], "Almanca")).rejects.toThrow(/biçimi geçersiz/);
    expect(createMock).toHaveBeenCalledTimes(2);
  });
});

describe("translateLegalBatch — çok öğe = dizi aracı", () => {
  it("öğe sayısı uyuşunca sırayla döner; boş öğe özgün metinle doldurulur", async () => {
    createMock.mockResolvedValueOnce(toolUse("submit_translations", { translations: ["Eins", ""] }));
    const out = await translateLegalBatch(["Bir", "İki"], "Almanca");
    expect(out).toEqual(["Eins", "İki"]);
    expect(lastCall().tool_choice.name).toBe("submit_translations");
    expect(JSON.parse(lastCall().messages[0].content)).toEqual(["Bir", "İki"]);
  });

  it("sayı uyuşmazlığı (model öğe böldü) iki denemede de sürerse fırlatır — kısmi doldurma YOK", async () => {
    createMock.mockResolvedValue(toolUse("submit_translations", { translations: ["a", "b", "c"] }));
    await expect(translateLegalBatch(["Bir", "İki"], "Almanca")).rejects.toThrow("Çeviri sayısı uyuşmuyor (3/2).");
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it("string'e sarılı dizi parse edilir", async () => {
    createMock.mockResolvedValueOnce(toolUse("submit_translations", { translations: JSON.stringify(["Eins", "Zwei"]) }));
    expect(await translateLegalBatch(["Bir", "İki"], "Almanca")).toEqual(["Eins", "Zwei"]);
  });
});
