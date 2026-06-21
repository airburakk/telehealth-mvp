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

// Toplu arayüz çevirisi — TR kaynak dizisi → hedef dil, sıra ve sayı birebir korunur.
// (Hasta arayüzü çok dilli: triyaj sihirbazı + branş soruları. Sonuçlar Translation tablosunda cache'lenir.)
const TRANSLATE_TOOL: Anthropic.Tool = {
  name: "submit_translations",
  description: "Verilen metinlerin çevirilerini girdiyle AYNI sıra ve sayıda döndürür.",
  input_schema: {
    type: "object",
    properties: {
      translations: { type: "array", items: { type: "string" }, description: "Girdiyle aynı sıra ve sayıda çeviri" },
    },
    required: ["translations"],
  },
};

export async function translateBatch(texts: string[], target: string): Promise<string[]> {
  const res = await client().messages.create({
    model: MODEL,
    max_tokens: 8000,
    system:
      `Sen bir sağlık platformu arayüz çevirmenisin. Verilen Türkçe arayüz metinlerini ${target} diline çevir. ` +
      "Tıbbi terminolojiyi doğru, arayüz dilini kısa ve doğal kullan. Sayıları, birimleri ve teknik adları (FUE, DHT, PET-BT, IVF, MR, BT vb.) koru. " +
      "Her öğeye birebir karşılık ver; sırayı ve öğe sayısını DEĞİŞTİRME. Yanıtı DAİMA submit_translations aracıyla ver.",
    tools: [TRANSLATE_TOOL],
    tool_choice: { type: "tool", name: "submit_translations" },
    messages: [{ role: "user", content: JSON.stringify(texts) }],
  });
  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new Error("Çeviri aracı yanıtı alınamadı.");
  const out = (block.input as { translations?: unknown }).translations;
  if (!Array.isArray(out)) throw new Error("Çeviri biçimi geçersiz.");
  // Sayı uyuşmazlığında eksikler kaynak metinle doldurulur (asla kırılmaz)
  return texts.map((s, i) => (typeof out[i] === "string" && out[i].trim() ? String(out[i]) : s));
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

// ── Post-op serbest-metin kırmızı bayrak (Modül 4) ──
// Hastanın günlük check-in NOTUNU (serbest metin) klinik triyaj asistanı gibi değerlendirir.
// Kural tabanlı keyword taramasının kaçırdığı nüanslı/bağlamsal bulguları yakalar; sonuç
// checkin'de kural + branş-checklist severity'siyle BİRLEŞİR (en kötü). Hızlı sınıflandırma → Haiku.
const TRIAGE_MODEL = "claude-haiku-4-5";

const POSTOP_TOOL: Anthropic.Tool = {
  name: "submit_assessment",
  description: "Post-op hasta notunun kırmızı-bayrak (aciliyet) değerlendirmesi.",
  input_schema: {
    type: "object",
    properties: {
      severity: {
        type: "string",
        enum: ["NONE", "WATCH", "RED"],
        description:
          "RED: acil müdahale gerektiren bulgu (yara enfeksiyonu/irin, kontrolsüz kanama, solunum sıkıntısı, bilinç değişikliği, nakil reddi belirtisi, ani şiddetli ağrı vb.); " +
          "WATCH: izlenmesi/değerlendirilmesi gereken hafif-orta bulgu; NONE: normal iyileşme / endişe verici bulgu yok",
      },
      reason: { type: "string", description: "Kısa Türkçe gerekçe (tek cümle)" },
    },
    required: ["severity", "reason"],
  },
};

export async function assessPostopNote(
  note: string,
  ctx: { branch: string; day: number }
): Promise<{ severity: "NONE" | "WATCH" | "RED"; reason: string }> {
  const res = await client().messages.create({
    model: TRIAGE_MODEL,
    max_tokens: 300,
    system:
      "Sen post-op (ameliyat/işlem sonrası) uzaktan takip için klinik triyaj asistanısın. Hastanın serbest-metin iyileşme notunu değerlendirip kırmızı-bayrak seviyesi belirlersin. " +
      "Şüpheli veya endişe verici bulguda TEMKİNLİ ol (WATCH/RED'e meyilli ol — uzaktan takipte güvenlik önceliklidir). Notta açıkça olmayan bulguyu UYDURMA. Yanıtı DAİMA submit_assessment aracıyla ver.",
    tools: [POSTOP_TOOL],
    tool_choice: { type: "tool", name: "submit_assessment" },
    messages: [{ role: "user", content: `Branş: ${ctx.branch} · Post-op ${ctx.day}. gün\n\nHasta notu:\n${note}` }],
  });

  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new Error("Değerlendirme alınamadı.");
  const a = block.input as { severity?: string; reason?: string };
  const severity = (["NONE", "WATCH", "RED"] as const).includes(a.severity as never)
    ? (a.severity as "NONE" | "WATCH" | "RED")
    : "NONE";
  return { severity, reason: clean(a.reason) };
}

// ── Post-op FOTOĞRAF (görüntü) kırmızı bayrak değerlendirmesi (Modül 4) ──
// Hastanın günlük check-in'de yüklediği iyileşme/yara fotoğrafını Claude vision ile değerlendirir.
// Serbest-metin not değerlendirmesinin (assessPostopNote) görsel karşılığı: enfeksiyon/dikiş/akıntı/şişlik
// gibi GÖRSEL bulguları yakalar. Sonuç checkin'de kural + checklist + not-AI ile BİRLEŞİR (en kötü).
// Görsel akıl yürütme kalitesi kritik (yanlış-negatif tehlikeli) → klinik model (Sonnet) kullanılır.

const PHOTO_TOOL: Anthropic.Tool = {
  name: "submit_photo_assessment",
  description: "Post-op iyileşme fotoğrafının kırmızı-bayrak (aciliyet) değerlendirmesi.",
  input_schema: {
    type: "object",
    properties: {
      severity: {
        type: "string",
        enum: ["NONE", "WATCH", "RED"],
        description:
          "RED: acil müdahale gerektiren görsel bulgu (irin/püy, yayılan kızarıklık/sellülit, dikiş ayrışması/açılması (dehisans), nekroz/siyahlaşma, belirgin pürülan akıntı, aşırı şişlik+morarma birlikte); " +
          "WATCH: izlenmesi gereken hafif-orta görsel bulgu (sınırlı kızarıklık, hafif akıntı, gerginlik); " +
          "NONE: normal post-op görünüm (beklenen kabuklanma, sınırlı morarma, temiz/kapanmış yara) VEYA görüntü tıbbi olarak değerlendirilemez (alakasız/bulanık/karanlık)",
      },
      findings: {
        type: "string",
        description:
          "Kısa Türkçe görsel bulgu (1-2 cümle): kızarıklık, şişlik, akıntı/irin, dikiş durumu, renk, iyileşme aşaması. " +
          "Görüntüde NET olmayanı söyleme. Görüntü tıbbi/alakalı değilse veya çok düşük kaliteliyse bunu açıkça belirt.",
      },
    },
    required: ["severity", "findings"],
  },
};

export async function assessPostopPhoto(
  dataUrl: string,
  ctx: { branch: string; day: number }
): Promise<{ severity: "NONE" | "WATCH" | "RED"; findings: string }> {
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(dataUrl);
  if (!m) throw new Error("Geçersiz görüntü biçimi (data URL bekleniyor).");
  const mediaType = m[1] as "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  const b64 = m[2];

  const res = await client().messages.create({
    model: MODEL,
    max_tokens: 400,
    system:
      "Sen post-op (ameliyat/işlem sonrası) uzaktan takip için klinik GÖRÜNTÜ değerlendirme asistanısın. " +
      "Hastanın yüklediği iyileşme/yara fotoğrafını değerlendirip kırmızı-bayrak seviyesi ve kısa görsel bulgu üretirsin. " +
      "Enfeksiyon belirtileri (irin/püy, yayılan kızarıklık, dikiş açılması, nekroz/renk değişimi) RED'e meyilli; hafif/beklenen post-op bulgular (sınırlı kızarıklık, kabuklanma, morarma) WATCH/NONE. " +
      "Şüpheli veya endişe verici görsel bulguda TEMKİNLİ ol (uzaktan takipte güvenlik önceliklidir). Görüntüde NET OLMAYAN bulguyu UYDURMA; görüntü tıbbi olmayan/alakasız/çok düşük kaliteliyse bunu belirt ve NONE ver. " +
      "Bu bir ön-değerlendirmedir, kesin tanı değildir. Yanıtı DAİMA submit_photo_assessment aracıyla ver.",
    tools: [PHOTO_TOOL],
    tool_choice: { type: "tool", name: "submit_photo_assessment" },
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data: b64 } },
        { type: "text", text: `Branş: ${ctx.branch} · Post-op ${ctx.day}. gün.\nBu iyileşme/yara fotoğrafını değerlendir.` },
      ],
    }],
  });

  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new Error("Görüntü değerlendirmesi alınamadı.");
  const a = block.input as { severity?: string; findings?: string };
  const severity = (["NONE", "WATCH", "RED"] as const).includes(a.severity as never)
    ? (a.severity as "NONE" | "WATCH" | "RED")
    : "NONE";
  return { severity, findings: clean(a.findings) };
}

// ── Triyaj belge AI ön-değerlendirmesi (Modül 1 — AI Orchestration) ──
// Hastanın triyajda yüklediği tıbbi belgeyi (tahlil / görüntüleme raporu / epikriz / reçete) değerlendirir:
// türünü belirler, ANLAMLI içeriğini Türkçeye çevirir, doktor için klinik özet + anormal/kritik bulgu çıkarır.
// Görüntü → Claude vision; PDF → Claude native "document" bloğu. Uydurma yok; okunamıyorsa açıkça belirtir.
// Doktor kokpitte başlatır (düşük hacim) → yüksek kaliteli klinik model (Sonnet, MODEL). DICOM kapsam dışı (viewer-only).

export interface DocLab {
  name: string; // test/analit adı (mümkünse TR, ör. "Hemoglobin")
  value: string; // ölçülen değer (belgedeki haliyle)
  unit: string; // birim (ör. "g/dL"); yoksa ""
  loinc?: string; // güvenilirse LOINC kodu; emin değilse yok
  abnormal?: string; // kısa anormal işareti ("düşük"/"yüksek"/"kritik"); normalse yok
}
export interface DocAssessment {
  docType: string; // Laboratuvar | Görüntüleme Raporu | Epikriz / Tıbbi Rapor | Reçete | Diğer
  summary: string; // klinik özet (TR)
  translation: string; // belge içeriğinin TR çevirisi
  flags: string; // anormal/kritik bulgu (TR; yoksa "Belirgin anormallik saptanmadı")
  labs: DocLab[]; // yalnız Laboratuvar belgelerinde dolu → lab formu / FHIR Observation kaynağı
}

const DOC_TYPES = ["Laboratuvar", "Görüntüleme Raporu", "Epikriz / Tıbbi Rapor", "Reçete", "Diğer"] as const;

const DOCUMENT_TOOL: Anthropic.Tool = {
  name: "submit_document_assessment",
  description: "Tıbbi belgenin tür + Türkçe çeviri + klinik özet + anormal bulgu değerlendirmesi.",
  input_schema: {
    type: "object",
    properties: {
      docType: { type: "string", enum: [...DOC_TYPES], description: "Belge türü" },
      summary: {
        type: "string",
        description:
          "Türkçe klinik özet (2-5 cümle): belgedeki önemli bulgular ve hastanın ilk şikâyetiyle ilişkisi. " +
          "Belge okunamıyorsa / tıbbi değilse / çok düşük kaliteliyse bunu açıkça yaz.",
      },
      translation: {
        type: "string",
        description:
          "Belgedeki ANLAMLI tıbbi içeriğin (değerler, tanılar, ölçümler, hekim notları) Türkçe çevirisi; düzenli ve okunur. " +
          "Belge zaten Türkçe ise 'Belge zaten Türkçe.' yaz. Olmayan içeriği uydurma.",
      },
      flags: {
        type: "string",
        description:
          "Anormal / referans-dışı / kritik bulgular (Türkçe, kısa). Yoksa 'Belirgin anormallik saptanmadı.' yaz. Bulguyu UYDURMA.",
      },
      labs: {
        type: "array",
        description:
          "YALNIZCA belge bir laboratuvar/tahlil sonucu ise: ölçülen her analiti ayrı satır olarak çıkar. " +
          "Laboratuvar DIŞINDAKİ belgelerde (görüntüleme, epikriz, reçete) BOŞ dizi döndür. Değerleri AYNEN belgeden al; analit/değer/birim UYDURMA.",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Test/analit adı, mümkünse Türkçe (ör. 'Hemoglobin', 'Lökosit')." },
            value: { type: "string", description: "Ölçülen değer, belgedeki haliyle (ör. '9.8', '14.2', 'Pozitif')." },
            unit: { type: "string", description: "Birim (ör. 'g/dL', '10^3/µL'); yoksa boş bırak." },
            loinc: { type: "string", description: "Bu analitin LOINC kodu — YALNIZ emin isen (ör. Hemoglobin '718-7'). Emin değilsen boş bırak, UYDURMA." },
            abnormal: { type: "string", description: "Referans dışıysa kısa işaret: 'düşük' / 'yüksek' / 'kritik'. Normal/bilinmiyorsa boş bırak." },
          },
          required: ["name", "value"],
        },
      },
    },
    required: ["docType", "summary", "translation", "flags"],
  },
};

const LOINC_RE = /^\d{1,6}-\d$/; // LOINC = sayısal kök + kontrol hanesi → biçimsiz/uydurma kodları ele

function sanitizeDocLabs(raw: unknown): DocLab[] {
  if (!Array.isArray(raw)) return [];
  const out: DocLab[] = [];
  for (const item of raw) {
    const o = (item ?? {}) as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.trim().slice(0, 120) : "";
    const value =
      typeof o.value === "string" ? o.value.trim().slice(0, 60) : typeof o.value === "number" ? String(o.value) : "";
    if (!name || !value) continue; // ad + değer zorunlu (yoksa atla)
    const unit = typeof o.unit === "string" ? o.unit.trim().slice(0, 24) : "";
    const loincRaw = typeof o.loinc === "string" ? o.loinc.trim() : "";
    const loinc = LOINC_RE.test(loincRaw) ? loincRaw : ""; // biçim dışı kodu at (uydurma yok)
    const abRaw = typeof o.abnormal === "string" ? o.abnormal.trim().toLowerCase().slice(0, 24) : "";
    const abnormal = abRaw && !/normal|negatif|yok|none|bilinm/.test(abRaw) ? abRaw : "";
    out.push({ name, value, unit, ...(loinc ? { loinc } : {}), ...(abnormal ? { abnormal } : {}) });
    if (out.length >= 40) break;
  }
  return out;
}

export async function assessDocument(
  dataUrl: string,
  ctx: { branch: string; symptoms: string; language: string; label: string; loincHints?: { code: string; label: string }[] }
): Promise<DocAssessment> {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!m) throw new Error("Geçersiz belge biçimi (base64 data URL bekleniyor).");
  const media = m[1];
  const b64 = m[2];

  let docBlock: Anthropic.ContentBlockParam;
  if (media === "application/pdf") {
    docBlock = { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } };
  } else if (/^image\/(jpeg|png|webp|gif)$/.test(media)) {
    docBlock = { type: "image", source: { type: "base64", media_type: media as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: b64 } };
  } else {
    throw new Error("Desteklenmeyen belge türü (yalnız PDF ve görüntü AI ile değerlendirilir; DICOM kapsam dışı).");
  }

  const res = await client().messages.create({
    model: MODEL,
    max_tokens: 2000,
    system:
      "Sen uluslararası bir telehealth platformunda klinik belge değerlendirme asistanısın. Hastanın triyajda yüklediği tıbbi belgeyi (laboratuvar tahlili, radyoloji/görüntüleme raporu, epikriz, reçete vb.) incelersin. " +
      "Görevin: (1) belge türünü belirle; (2) belgedeki ANLAMLI tıbbi içeriği Türkçeye çevir; (3) görüşmeyi yapacak doktor için kısa klinik özet çıkar (önemli bulgular + hastanın ilk şikâyetiyle ilişkisi); (4) anormal / referans-dışı / kritik bulguları işaretle; (5) belge bir LABORATUVAR sonucu ise ölçülen her analiti (ad/değer/birim, emin isen LOINC kodu) yapılandırılmış 'labs' olarak çıkar — laboratuvar değilse 'labs' boş bırak. " +
      "Belgede AÇIKÇA olmayan değeri/bulguyu UYDURMA. Belge okunamıyorsa, tıbbi değilse veya çok düşük kaliteliyse bunu açıkça belirt. Bu bir ön-değerlendirmedir, kesin tanı değildir. Yanıtı DAİMA submit_document_assessment aracıyla ver.",
    tools: [DOCUMENT_TOOL],
    tool_choice: { type: "tool", name: "submit_document_assessment" },
    messages: [{
      role: "user",
      content: [
        docBlock,
        {
          type: "text",
          text:
            `Vaka bağlamı:\nBranş: ${ctx.branch}\nHasta dili (belge bu dilde olabilir): ${ctx.language}\n` +
            `İlk şikâyet: ${ctx.symptoms}\nDosya: ${ctx.label}\n` +
            (ctx.loincHints && ctx.loincHints.length
              ? `\nBu branşta sık görülen LOINC kodları (laboratuvar satırlarında uygun olanı tercih et, zorlamadan):\n` +
                ctx.loincHints.map((h) => `- ${h.code}: ${h.label}`).join("\n") + "\n"
              : "") +
            `\nBu tıbbi belgeyi değerlendir, Türkçeye çevir ve özetle. Belge bir laboratuvar sonucu ise ölçülen değerleri 'labs' alanında yapılandır.`,
        },
      ],
    }],
  });

  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new Error("Belge değerlendirmesi alınamadı.");
  const a = block.input as Partial<DocAssessment> & { labs?: unknown };
  const docType = (DOC_TYPES as readonly string[]).includes(String(a.docType)) ? String(a.docType) : "Diğer";
  // Yapılandırılmış lab satırları yalnız Laboratuvar belgelerinde (defansif: tür değilse boşalt)
  const labs = docType === "Laboratuvar" ? sanitizeDocLabs(a.labs) : [];
  return { docType, summary: clean(a.summary), translation: clean(a.translation), flags: clean(a.flags), labs };
}
