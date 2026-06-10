// Klinik AI yardımcıları — Claude (Anthropic) ile. Mevcut ANTHROPIC_API_KEY'i yeniden kullanır.
// 1) summarizeSOAP: doktorun dağınık görüşme notlarını standart SOAP formatına çevirir (zorlanmış tool_use).
// 2) translateText: medikal metni hedef dile çevirir.
// 3) generateDischarge: hastanın tüm yolculuğunu epikriz/taburcu raporuna sentezler (zorlanmış tool_use).
// Anahtar yoksa anlamlı hata fırlatır (bunlar yalnız-AI özellikleridir; kural tabanlı karşılığı yok).
import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-6"; // klinik dökümanlar (epikriz/SOAP/çeviri) — yüksek kalite akıl yürütme & dil; doktor başlatır, düşük hacim

function client(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("AI devre dışı: ANTHROPIC_API_KEY tanımlı değil.");
  return new Anthropic();
}

// Model bazen gerçek satır sonu yerine literal "\n" (ters bölü + n) üretebiliyor → gerçek satır sonuna çevir.
// Boş alan için "Belirtilmedi" döner (klinik dökümanlarda uydurma yok ilkesi).
function clean(v: unknown): string {
  const s = String(v ?? "").replace(/\\n/g, "\n").replace(/\\t/g, " ").trim();
  return s || "Belirtilmedi";
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

export async function summarizeSOAP(
  notes: string,
  ctx: SoapContext,
  source: "notes" | "transcript" = "notes"
): Promise<{ soap: string; structured: Soap }> {
  const sysIntro =
    source === "transcript"
      ? "Sen bir klinik dokümantasyon asistanısın. Doktor–hasta görüşmesinin KONUŞMA TRANSKRİPTİNİ (ve varsa doktorun ek notlarını) vaka bağlamıyla birlikte standart SOAP formatına dönüştürürsün. Hastanın söyledikleri ağırlıkla Subjektif'e, doktorun gözlem/değerlendirme/plan ifadeleri O/A/P'ye gider. Selamlaşma, bağlantı sorunu gibi tıbbi olmayan konuşmaları ele."
      : "Sen bir klinik dokümantasyon asistanısın. Doktorun görüşme sırasında aldığı dağınık/serbest notları, vaka bağlamıyla birlikte standart SOAP formatına dönüştürürsün.";
  const res = await client().messages.create({
    model: MODEL,
    max_tokens: 1500,
    system:
      sysIntro +
      " Tıbbi olarak tutarlı, özlü ve Türkçe yaz. Girdide olmayan bulguyu UYDURMA; bilgi yoksa 'Belirtilmedi' yaz. Yanıtı DAİMA submit_soap aracıyla ver.",
    tools: [SOAP_TOOL],
    tool_choice: { type: "tool", name: "submit_soap" },
    messages: [{
      role: "user",
      content:
        `Vaka bağlamı:\nHasta: ${ctx.patientName}\nBranş: ${ctx.branch}\nİlk şikâyet: ${ctx.symptoms}\n\n` +
        (source === "transcript" ? `Görüşme transkripti (+ varsa doktor notları):\n` : `Doktorun görüşme notları:\n`) +
        (notes || "(not girilmedi)"),
    }],
  });

  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new Error("SOAP aracı yanıtı alınamadı.");
  const s = block.input as Partial<Soap>;
  const structured: Soap = {
    subjective: clean(s.subjective),
    objective: clean(s.objective),
    assessment: clean(s.assessment),
    plan: clean(s.plan),
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

// ── AI Epikriz / Taburcu Raporu ──
// Hastanın tüm yolculuğunu (triyaj + SOAP notu + tedavi paketi + post-op iyileşme)
// standart bir epikrize sentezler. Zorlanmış tool_use; verilmeyen veriyi uydurmaz.

export interface DischargeContext {
  patientName: string;
  countryName: string;
  language: string;
  branch: string;
  urgency: number;
  symptoms: string;
  triageReasoning: string;
  soapNotes: string; // en güncel konsültasyon notu (boş olabilir)
  packageSummary: string; // rezervasyon özeti ya da "Paket oluşturulmadı."
  recoverySummary: string; // post-op özeti ya da "Post-op takip başlamadı."
}

export interface Discharge {
  tani: string;
  anamnez: string;
  tedaviSureci: string;
  klinikSeyir: string;
  cikisIlaclari: string;
  oneriler: string;
}

const DISCHARGE_SECTIONS: { key: keyof Discharge; label: string }[] = [
  { key: "tani", label: "TANI" },
  { key: "anamnez", label: "ÖYKÜ VE BAŞVURU" },
  { key: "tedaviSureci", label: "UYGULANAN TEDAVİ VE İŞLEMLER" },
  { key: "klinikSeyir", label: "KLİNİK SEYİR VE İYİLEŞME" },
  { key: "cikisIlaclari", label: "ÇIKIŞ İLAÇLARI" },
  { key: "oneriler", label: "ÖNERİLER VE KONTROL PLANI" },
];

const DISCHARGE_TOOL: Anthropic.Tool = {
  name: "submit_discharge",
  description: "Hastanın klinik yolculuğunu standart epikriz (taburcu raporu) bölümlerinde döndürür.",
  input_schema: {
    type: "object",
    properties: {
      tani: { type: "string", description: "Tanı — branş ve klinik veriye dayalı final/çalışma tanısı" },
      anamnez: { type: "string", description: "Öykü ve başvuru nedeni — şikâyet, triyaj bulguları, hastanın ifadesi" },
      tedaviSureci: { type: "string", description: "Uygulanan tedavi ve işlemler — konsültasyon kararı, tedavi paketi/operasyon (varsa)" },
      klinikSeyir: { type: "string", description: "Klinik seyir ve iyileşme — post-op takip verisi (ağrı/ateş/kırmızı bayrak) varsa özetle; yoksa beklenen seyir" },
      cikisIlaclari: { type: "string", description: "Çıkış ilaçları / reçete önerisi — veride yoksa branşa uygun genel/tipik öneri, kesin doz uydurma" },
      oneriler: { type: "string", description: "Öneriler ve kontrol planı — yara bakımı, kontrol randevusu, kırmızı bayrak uyarıları, takip" },
    },
    required: ["tani", "anamnez", "tedaviSureci", "klinikSeyir", "cikisIlaclari", "oneriler"],
  },
};

export async function generateDischarge(ctx: DischargeContext): Promise<{ sections: string; structured: Discharge }> {
  const res = await client().messages.create({
    model: MODEL,
    max_tokens: 2000,
    system:
      "Sen kıdemli bir klinik dokümantasyon hekimisin. Hastanın yolculuk verisini (triyaj, görüşme/SOAP notu, tedavi paketi, post-op takip) profesyonel bir EPİKRİZ (taburcu raporu) haline getirirsin. " +
      "Tıbbi olarak tutarlı, özlü ve resmi Türkçe yaz. Verilmeyen bulguyu/ölçümü UYDURMA; bilgi yoksa 'Belirtilmedi' yaz veya branşa uygun genel/önerilen ifade kullan (kesin doz/değer uydurma). " +
      "Hasta uluslararası bir sağlık turizmi hastasıdır; rapor yurt dışındaki hekimine iletilecektir. Yanıtı DAİMA submit_discharge aracıyla ver.",
    tools: [DISCHARGE_TOOL],
    tool_choice: { type: "tool", name: "submit_discharge" },
    messages: [{
      role: "user",
      content:
        `Hasta: ${ctx.patientName} (${ctx.countryName}, dil: ${ctx.language})\n` +
        `Branş: ${ctx.branch}\nTriyaj aciliyeti: ${ctx.urgency}/5\n\n` +
        `İlk şikâyet / semptomlar:\n${ctx.symptoms}\n\n` +
        `Triyaj değerlendirmesi:\n${ctx.triageReasoning}\n\n` +
        `Görüşme (SOAP) notu:\n${ctx.soapNotes || "(konsültasyon notu girilmemiş)"}\n\n` +
        `Tedavi paketi:\n${ctx.packageSummary}\n\n` +
        `Post-op takip:\n${ctx.recoverySummary}`,
    }],
  });

  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new Error("Epikriz aracı yanıtı alınamadı.");
  const d = block.input as Partial<Discharge>;
  const structured: Discharge = {
    tani: clean(d.tani),
    anamnez: clean(d.anamnez),
    tedaviSureci: clean(d.tedaviSureci),
    klinikSeyir: clean(d.klinikSeyir),
    cikisIlaclari: clean(d.cikisIlaclari),
    oneriler: clean(d.oneriler),
  };
  const sections = DISCHARGE_SECTIONS.map((s) => `${s.label}\n${structured[s.key]}`).join("\n\n");
  return { sections, structured };
}

// ── Sağlık Turizmi Agent'ı — SOAP'tan paket teklifi ──
// Nihai SOAP'taki tedavi planından paket parametrelerini (süre, tier, hastane, ekstralar) çıkarır.
// FİYAT HESAPLAMAZ — fiyat her zaman platformun kendi motorunda (lib/pricing computePackage) hesaplanır.

export interface PackageProposal {
  tier: "Ekonomik" | "Standart" | "Premium";
  nights: number;
  hospitalType: "Özel" | "Üniversite";
  hotelStars: 4 | 5;
  translator: boolean;
  insuranceExtended: boolean;
  insuranceMalpractice: boolean;
  rationale: string;
}

export interface ProposalContext {
  patientName: string;
  branch: string;
  countryName: string;
  language: string;
  urgency: number;
}

const PACKAGE_TOOL: Anthropic.Tool = {
  name: "submit_package",
  description: "SOAP'taki tedavi planına uygun sağlık turizmi paket parametrelerini döndürür.",
  input_schema: {
    type: "object",
    properties: {
      tier: { type: "string", enum: ["Ekonomik", "Standart", "Premium"], description: "Vaka karmaşıklığı ve konfor ihtiyacına göre paket seviyesi" },
      nights: { type: "integer", description: "Türkiye'de toplam konaklama gecesi (işlem + iyileşme + kontrol; 1-21)" },
      hospitalType: { type: "string", enum: ["Özel", "Üniversite"], description: "Kompleks/onkolojik/nakil vakalarında Üniversite önerilir" },
      hotelStars: { type: "integer", enum: [4, 5], description: "Otel sınıfı" },
      translator: { type: "boolean", description: "Hasta dili Türkçe değilse tıbbi tercüman önerilir" },
      insuranceExtended: { type: "boolean", description: "Genişletilmiş sağlık sigortası" },
      insuranceMalpractice: { type: "boolean", description: "Cerrahi/invaziv işlemlerde malpraktis sigortası önerilir" },
      rationale: { type: "string", description: "Türkçe kısa gerekçe: SOAP'taki plana dayanarak bu seçimler neden yapıldı (2-4 cümle)" },
    },
    required: ["tier", "nights", "hospitalType", "hotelStars", "translator", "insuranceExtended", "insuranceMalpractice", "rationale"],
  },
};

export async function proposePackage(soap: string, ctx: ProposalContext): Promise<PackageProposal> {
  const res = await client().messages.create({
    model: MODEL,
    max_tokens: 1000,
    system:
      "Sen bir sağlık turizmi planlama agent'ısın. Doktorun nihai SOAP notundaki tedavi planına göre hastanın Türkiye paketi parametrelerini belirlersin: " +
      "konaklama süresini işlem + iyileşme + kontrol ve (varsa) uçuş kısıtlarına göre hesapla; kompleks/onkolojik/nakil vakalarda Üniversite hastanesi ve Premium düşün; " +
      "hasta dili Türkçe değilse tercüman öner; cerrahi/invaziv planlarda malpraktis sigortası öner. FİYAT VERME — fiyatı platform hesaplar. " +
      "SOAP'ta olmayan bilgiyi uydurma; emin değilsen makul-muhafazakâr seç. Yanıtı DAİMA submit_package aracıyla ver.",
    tools: [PACKAGE_TOOL],
    tool_choice: { type: "tool", name: "submit_package" },
    messages: [{
      role: "user",
      content:
        `Hasta: ${ctx.patientName} (${ctx.countryName}, dil: ${ctx.language})\n` +
        `Branş: ${ctx.branch} · Triyaj aciliyeti: ${ctx.urgency}/5\n\n` +
        `Nihai SOAP notu:\n${soap}`,
    }],
  });

  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new Error("Paket aracı yanıtı alınamadı.");
  const p = block.input as Partial<PackageProposal>;
  return {
    tier: (["Ekonomik", "Standart", "Premium"] as const).includes(p.tier as never) ? (p.tier as PackageProposal["tier"]) : "Standart",
    nights: Math.min(21, Math.max(1, Math.round(Number(p.nights) || 5))),
    hospitalType: p.hospitalType === "Üniversite" ? "Üniversite" : "Özel",
    hotelStars: Number(p.hotelStars) === 5 ? 5 : 4,
    translator: !!p.translator,
    insuranceExtended: !!p.insuranceExtended,
    insuranceMalpractice: !!p.insuranceMalpractice,
    rationale: clean(p.rationale),
  };
}
