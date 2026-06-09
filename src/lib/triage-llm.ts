// Gerçek AI Triyaj — Claude (Anthropic) ile branş + aciliyet sınıflandırması.
// Yapılandırılmış çıktı için ZORLANMIŞ tool_use kullanılır (submit_triage).
// ANTHROPIC_API_KEY yoksa veya çağrı hata/zaman aşımı verirse kural tabanlı
// analyzeTriage motoruna otomatik düşülür — uygulama anahtarsız da çalışır.
import Anthropic from "@anthropic-ai/sdk";
import { analyzeTriage, BRANCHES, type TriageInput, type TriageOutput } from "./triage";

// Hızlı/ucuz sınıflandırma için Haiku. Daha yüksek kalite gerekiyorsa
// "claude-sonnet-4-6" veya "claude-opus-4-8" ile değiştirilebilir.
const MODEL = "claude-haiku-4-5";

const BRANCH_KEYS = BRANCHES.map((b) => b.key);

const SYSTEM = `Sen bir sağlık turizmi platformunun triyaj asistanısın. Hastanın serbest metinle yazdığı şikâyeti analiz edip onu DOĞRU TIBBİ BRANŞA yönlendirir ve ACİLİYET düzeyini belirlersin. Tanı KOYMAZSIN; yalnızca yönlendirme ve önceliklendirme yaparsın. Yanıtını DAİMA submit_triage aracıyla ver.

Aciliyet ölçeği (1-5):
5 = Acil/Hayati (nefes darlığı, göğüs ağrısı, şiddetli kanama, bilinç kaybı, felç belirtisi, çok yüksek ateş)
4 = Yüksek (onkolojik şüphe, hızlı kötüleşen belirti, ileri evre tedavi gerekliliği)
3 = Orta (kronik takip, belirgin ama stabil şikâyet)
2 = Düşük (planlı değerlendirme)
1 = Rutin/Elektif (saç ekimi, estetik cerrahi, rutin diş/göz)

Gerekçeyi Türkçe, kısa ve hastanın anlayacağı dilde yaz.`;

const TRIAGE_TOOL: Anthropic.Tool = {
  name: "submit_triage",
  description: "Triyaj değerlendirmesini yapılandırılmış olarak gönderir.",
  input_schema: {
    type: "object",
    properties: {
      branchKey: { type: "string", enum: BRANCH_KEYS, description: "En uygun tıbbi branşın anahtarı" },
      urgency: { type: "integer", enum: [1, 2, 3, 4, 5], description: "Aciliyet düzeyi (1 rutin → 5 acil)" },
      confidence: { type: "integer", description: "Güven yüzdesi (0-100)" },
      reasoning: { type: "string", description: "Türkçe kısa gerekçe: neden bu branş ve bu aciliyet" },
      missingInfo: { type: "string", description: "Karar için eksik kritik bilgi varsa tek bir soru; yoksa boş bırak" },
    },
    required: ["branchKey", "urgency", "confidence", "reasoning"],
  },
};

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("LLM triyaj zaman aşımı")), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

export async function analyzeTriageLLM(input: TriageInput): Promise<TriageOutput> {
  const client = new Anthropic(); // ANTHROPIC_API_KEY ortam değişkeninden okunur

  const userText = [
    input.symptoms ? `Şikâyet: ${input.symptoms}` : "",
    input.durationText ? `Süre: ${input.durationText}` : "",
    input.answers && Object.keys(input.answers).length ? `Ek yanıtlar: ${JSON.stringify(input.answers)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM,
    tools: [TRIAGE_TOOL],
    tool_choice: { type: "tool", name: "submit_triage" },
    messages: [{ role: "user", content: userText || "Şikâyet belirtilmedi." }],
  });

  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new Error("Triyaj aracı yanıtı alınamadı.");

  const out = block.input as {
    branchKey?: string;
    urgency?: number;
    confidence?: number;
    reasoning?: string;
    missingInfo?: string;
  };

  const branch = BRANCHES.find((b) => b.key === out.branchKey) ?? BRANCHES.find((b) => b.key === "dahiliye")!;
  const urgency = Math.min(5, Math.max(1, Math.round(Number(out.urgency) || 3)));
  const confidence = Math.min(99, Math.max(40, Math.round(Number(out.confidence) || 70)));
  let reasoning = String(out.reasoning || `Semptom analizi → ${branch.label}.`);
  if (out.missingInfo && out.missingInfo.trim()) reasoning += ` (Netleştirilecek: ${out.missingInfo.trim()})`;

  return { branchKey: branch.key, branch: branch.label, urgency, confidence, reasoning, matched: [], engine: "llm" };
}

// Üretim girişi: anahtar varsa LLM dener, yoksa/hata olursa kural tabanlıya düşer.
export async function runTriage(input: TriageInput): Promise<TriageOutput> {
  if (!process.env.ANTHROPIC_API_KEY) return analyzeTriage(input);
  try {
    return await withTimeout(analyzeTriageLLM(input), 12000);
  } catch (e) {
    console.warn("[triyaj] LLM başarısız, kural tabanlına düşülüyor:", e instanceof Error ? e.message : e);
    return analyzeTriage(input);
  }
}
