// Klinik AI yardımcıları — Claude (Anthropic) ile. Mevcut ANTHROPIC_API_KEY'i yeniden kullanır.
// 1) summarizeSOAP: doktorun dağınık görüşme notlarını standart SOAP formatına çevirir (zorlanmış tool_use).
// 2) translateText: medikal metni hedef dile çevirir.
// Anahtar yoksa anlamlı hata fırlatır (bunlar yalnız-AI özellikleridir; kural tabanlı karşılığı yok).
import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-haiku-4-5"; // hızlı/ucuz; gerekirse sonnet/opus

function client(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("AI devre dışı: ANTHROPIC_API_KEY tanımlı değil.");
  return new Anthropic();
}

export interface SoapContext {
  patientName: string;
  branch: string;
  symptoms: string;
}
export interface Soap {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

const SOAP_TOOL: Anthropic.Tool = {
  name: "submit_soap",
  description: "Görüşme notunu standart SOAP formatında döndürür.",
  input_schema: {
    type: "object",
    properties: {
      subjective: { type: "string", description: "S — Subjektif: hastanın kendi ifadesi, şikâyet, öykü" },
      objective: { type: "string", description: "O — Objektif: muayene/ölçüm/bulgular (nottan çıkarılabilenler)" },
      assessment: { type: "string", description: "A — Değerlendirme: ön tanı / klinik yorum" },
      plan: { type: "string", description: "P — Plan: tetkik, tedavi, yönlendirme, takip önerisi" },
    },
    required: ["subjective", "objective", "assessment", "plan"],
  },
};

export async function summarizeSOAP(notes: string, ctx: SoapContext): Promise<{ soap: string; structured: Soap }> {
  const res = await client().messages.create({
    model: MODEL,
    max_tokens: 1500,
    system:
      "Sen bir klinik dokümantasyon asistanısın. Doktorun görüşme sırasında aldığı dağınık/serbest notları, vaka bağlamıyla birlikte standart SOAP formatına dönüştürürsün. Tıbbi olarak tutarlı, özlü ve Türkçe yaz. Notta olmayan bulguyu UYDURMA; bilgi yoksa 'Belirtilmedi' yaz. Yanıtı DAİMA submit_soap aracıyla ver.",
    tools: [SOAP_TOOL],
    tool_choice: { type: "tool", name: "submit_soap" },
    messages: [{
      role: "user",
      content:
        `Vaka bağlamı:\nHasta: ${ctx.patientName}\nBranş: ${ctx.branch}\nİlk şikâyet: ${ctx.symptoms}\n\n` +
        `Doktorun görüşme notları:\n${notes || "(not girilmedi)"}`,
    }],
  });

  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new Error("SOAP aracı yanıtı alınamadı.");
  const s = block.input as Partial<Soap>;
  const structured: Soap = {
    subjective: String(s.subjective || "Belirtilmedi"),
    objective: String(s.objective || "Belirtilmedi"),
    assessment: String(s.assessment || "Belirtilmedi"),
    plan: String(s.plan || "Belirtilmedi"),
  };
  const soap =
    `S — Subjektif:\n${structured.subjective}\n\n` +
    `O — Objektif:\n${structured.objective}\n\n` +
    `A — Değerlendirme:\n${structured.assessment}\n\n` +
    `P — Plan:\n${structured.plan}`;
  return { soap, structured };
}

export async function translateText(text: string, target: string): Promise<string> {
  const res = await client().messages.create({
    model: MODEL,
    max_tokens: 1500,
    system:
      `Sen bir medikal çeviri motorusun. Verilen metni ${target} diline çevir. Tıbbi terminolojiyi doğru koru, akıcı ve doğal çevir. SADECE çeviriyi döndür; açıklama, ön söz veya not ekleme.`,
    messages: [{ role: "user", content: text }],
  });
  const out = res.content.find((b) => b.type === "text");
  return out && out.type === "text" ? out.text.trim() : "";
}
