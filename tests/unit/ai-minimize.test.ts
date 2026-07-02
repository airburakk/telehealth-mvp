// Birim testleri — lib/ai-minimize.ts (1C) + ai-clinical entegrasyonu (Anthropic SDK mock'lu).
// Kanıtlanan: gerçek hasta adı AI prompt'una GİTMEZ (placeholder gider); çıktıda gerçek ad GERİ KONUR.
import { describe, it, expect, vi, beforeEach } from "vitest";

// Anthropic SDK'yı mock'la — gerçek API çağrısı/anahtarı gerekmesin; prompt'u yakala, canlı tool_use yanıtı döndür.
const createMock = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: createMock };
  },
}));

import { minimizedName, reidentifyName, redactName, AI_NAME_PLACEHOLDER } from "@/lib/ai-minimize";
import { summarizeSOAP, generateDischarge } from "@/lib/ai-clinical";

describe("ai-minimize — saf yardımcılar", () => {
  it("minimizedName placeholder döner (gerçek ad değil)", () => {
    expect(minimizedName()).toBe(AI_NAME_PLACEHOLDER);
  });
  it("reidentifyName placeholder'ı gerçek adla değiştirir", () => {
    expect(reidentifyName("Hasta [HASTA] başvurdu", "Ahmet Yılmaz")).toBe("Hasta Ahmet Yılmaz başvurdu");
  });
  it("birden çok placeholder hepsini değiştirir", () => {
    expect(reidentifyName("[HASTA] ve yine [HASTA]", "Ali")).toBe("Ali ve yine Ali");
  });
  it("gerçek ad boşsa metin aynen döner", () => {
    expect(reidentifyName("Hasta [HASTA]", "")).toBe("Hasta [HASTA]");
    expect(reidentifyName("Hasta [HASTA]", null)).toBe("Hasta [HASTA]");
  });
  it("özel karakterli ad (regex değil split/join) güvenli", () => {
    expect(reidentifyName("[HASTA]", "A. (Test) $1")).toBe("A. (Test) $1");
  });
});

describe("redactName — çeviri/AI öncesi ad maskeleme (P0 #2)", () => {
  it("gerçek adı placeholder ile değiştirir (reidentifyName'in tersi)", () => {
    expect(redactName("Hasta: Ahmet Yılmaz", "Ahmet Yılmaz")).toBe(`Hasta: ${AI_NAME_PLACEHOLDER}`);
  });
  it("aynı metinde birden çok geçişi maskeler", () => {
    expect(redactName("Ali geldi, sonra Ali gitti", "Ali")).toBe(`${AI_NAME_PLACEHOLDER} geldi, sonra ${AI_NAME_PLACEHOLDER} gitti`);
  });
  it("ad boşsa metin aynen döner (maskeleme yok)", () => {
    expect(redactName("Hasta: Ahmet", "")).toBe("Hasta: Ahmet");
    expect(redactName("Hasta: Ahmet", null)).toBe("Hasta: Ahmet");
  });
  it("Türkçe karakterli ad güvenli (split/join, regex değil)", () => {
    expect(redactName("Rapor: Şükrü Çağdaş", "Şükrü Çağdaş")).toBe(`Rapor: ${AI_NAME_PLACEHOLDER}`);
  });
  it("round-trip: redactName → reidentifyName orijinali geri verir", () => {
    const original = "Hasta Ahmet Yılmaz baş ağrısıyla başvurdu";
    const masked = redactName(original, "Ahmet Yılmaz");
    expect(masked).not.toContain("Ahmet");
    expect(reidentifyName(masked, "Ahmet Yılmaz")).toBe(original);
  });
});

describe("summarizeSOAP — PHI minimizasyonu", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    createMock.mockReset();
    createMock.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          input: { subjective: "Hasta [HASTA] baş ağrısı tarif ediyor", objective: "TA 120/80", assessment: "Migren", plan: "İlaç" },
        },
      ],
    });
  });

  it("AI prompt'una gerçek ad GİTMEZ (placeholder gider)", async () => {
    await summarizeSOAP("notlar", { patientName: "Ahmet Yılmaz", branch: "Nöroloji", symptoms: "baş ağrısı" });
    const prompt = createMock.mock.calls[0][0].messages[0].content as string;
    expect(prompt).toContain(AI_NAME_PLACEHOLDER);
    expect(prompt).not.toContain("Ahmet");
    expect(prompt).not.toContain("Yılmaz");
  });

  it("çıktıda gerçek ad GERİ KONUR (doktor görünümü korunur)", async () => {
    const { structured, soap } = await summarizeSOAP("notlar", { patientName: "Ahmet Yılmaz", branch: "Nöroloji", symptoms: "baş ağrısı" });
    expect(structured.subjective).toBe("Hasta Ahmet Yılmaz baş ağrısı tarif ediyor");
    expect(soap).toContain("Ahmet Yılmaz");
    expect(soap).not.toContain(AI_NAME_PLACEHOLDER);
  });
});

describe("generateDischarge — PHI minimizasyonu", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    createMock.mockReset();
    createMock.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          input: {
            tani: "Migren",
            anamnez: "[HASTA] 3 gündür baş ağrısı ile başvurdu",
            tedaviSureci: "Medikal",
            klinikSeyir: "İyi",
            cikisIlaclari: "Analjezik",
            oneriler: "Kontrol",
          },
        },
      ],
    });
  });

  it("prompt'ta placeholder, çıktıda gerçek ad", async () => {
    const { structured } = await generateDischarge({
      patientName: "Maria Schmidt",
      countryName: "Almanya",
      language: "Almanca",
      branch: "Nöroloji",
      urgency: 2,
      symptoms: "baş ağrısı",
      triageReasoning: "x",
      soapNotes: "y",
      packageSummary: "z",
      recoverySummary: "w",
    });
    const prompt = createMock.mock.calls[0][0].messages[0].content as string;
    expect(prompt).toContain(AI_NAME_PLACEHOLDER);
    expect(prompt).not.toContain("Maria");
    expect(structured.anamnez).toBe("Maria Schmidt 3 gündür baş ağrısı ile başvurdu");
  });
});
