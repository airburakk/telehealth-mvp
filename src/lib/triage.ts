// Triyaj Motoru (MVP — kural tabanlı "AI" stub)
// Semptom metnini analiz edip branş + aciliyet skoru (1-5) üretir.
// İleride bu fonksiyon bir LLM/NLP servisiyle değiştirilecek (bkz. AI Orchestration Gateway).

export interface BranchDef {
  key: string;
  label: string;
  keywords: string[];
}

export const BRANCHES: BranchDef[] = [
  { key: "onkoloji", label: "Onkoloji", keywords: ["kanser", "tümör", "tumor", "onkoloji", "kitle", "metastaz", "biyopsi", "lenf", "kemoterapi", "ur"] },
  { key: "kardiyoloji", label: "Kardiyoloji", keywords: ["kalp", "göğüs ağrı", "çarpıntı", "tansiyon", "kardiyo", "ritim", "damar", "bypass", "stent"] },
  { key: "ortopedi", label: "Ortopedi", keywords: ["diz", "kalça", "omuz", "kemik", "kırık", "eklem", "bel ağrı", "menisk", "protez", "kıkırdak", "topuk"] },
  { key: "norosirurji", label: "Nöroşirürji", keywords: ["beyin", "omurga", "disk", "fıtık", "felç", "omurilik", "sinir", "tümörü beyin"] },
  { key: "sac-ekimi", label: "Saç Ekimi", keywords: ["saç", "saç dökül", "greft", "fue", "dht", "kellik", "ekim"] },
  { key: "estetik", label: "Estetik Cerrahi", keywords: ["estetik", "burun", "rinoplasti", "liposuction", "meme", "yağ ald", "germe", "botoks", "dolgu"] },
  { key: "ivf", label: "Tüp Bebek (IVF)", keywords: ["tüp bebek", "ivf", "gebe", "kısırlık", "infertilite", "yumurtlama", "embriyo", "aşılama"] },
  { key: "dis", label: "Diş Tedavisi", keywords: ["diş", "implant", "kanal", "ortodonti", "gülüş", "dolgu diş", "çene"] },
  { key: "goz", label: "Göz Cerrahisi", keywords: ["göz", "katarakt", "lasik", "retina", "görme", "miyop", "şaşılık"] },
  { key: "genel-cerrahi", label: "Genel Cerrahi", keywords: ["safra", "apandisit", "bağırsak", "tiroid", "fıtık karın", "kese"] },
  { key: "dahiliye", label: "Dahiliye (İç Hastalıkları)", keywords: ["şeker", "diyabet", "mide", "karaciğer", "böbrek", "halsizlik", "tahlil", "kan değer"] },
];

const RED_FLAGS_5 = ["nefes darlığı", "göğüs ağrı", "bilinç", "felç", "şiddetli kanama", "kanama", "inme", "bayıl", "39", "40 derece", "kan kus", "morar"];
const RED_FLAGS_4 = ["ateş", "kusma", "şiddetli ağrı", "kanlı", "ani ", "yüksek tansiyon", "şişlik hızl"];
const ELECTIVE = ["saç", "estetik", "rinoplasti", "diş", "kontrol", "lazer", "gülüş", "dolgu", "botoks"];

export interface TriageInput {
  symptoms: string;
  durationText?: string;
  answers?: Record<string, string>;
}

export interface TriageOutput {
  branchKey: string;
  branch: string;
  urgency: number; // 1..5
  confidence: number; // 0..100
  reasoning: string;
  matched: string[];
  engine?: "llm" | "rules"; // hangi motorun ürettiği (şeffaflık)
}

function normalize(t: string): string {
  return (t || "").toLocaleLowerCase("tr-TR");
}

export function urgencyLabel(u: number): string {
  switch (u) {
    case 5: return "Acil / Hayati";
    case 4: return "Yüksek";
    case 3: return "Orta";
    case 2: return "Düşük";
    default: return "Rutin / Elektif";
  }
}

export function analyzeTriage(input: TriageInput): TriageOutput {
  const text = normalize([input.symptoms, input.durationText, Object.values(input.answers || {}).join(" ")].join(" "));

  // 1) Branş eşleştirme — anahtar kelime sayımı
  let best: BranchDef | null = null;
  let bestHits = 0;
  const matched: string[] = [];
  for (const b of BRANCHES) {
    let hits = 0;
    for (const kw of b.keywords) {
      if (text.includes(kw)) { hits++; if (!matched.includes(kw)) matched.push(kw); }
    }
    if (hits > bestHits) { bestHits = hits; best = b; }
  }
  if (!best) best = BRANCHES.find((b) => b.key === "dahiliye")!;

  // 2) Aciliyet skoru
  let urgency = 3;
  const redHit5 = RED_FLAGS_5.find((k) => text.includes(k));
  const redHit4 = RED_FLAGS_4.find((k) => text.includes(k));
  const electiveHit = ELECTIVE.find((k) => text.includes(k));
  let why = "Belirtiler orta düzeyde değerlendirildi.";
  if (redHit5) { urgency = 5; why = `Kırmızı bayrak ("${redHit5}") tespit edildi — acil önceliklendirme.`; }
  else if (redHit4) { urgency = 4; why = `Dikkat gerektiren belirti ("${redHit4}") tespit edildi.`; }
  else if (electiveHit && bestHits > 0) { urgency = best.key === "onkoloji" || best.key === "kardiyoloji" ? 3 : 1; why = "Elektif (seçimlik) işlem profili — düşük aciliyet."; }
  else if (best.key === "onkoloji") { urgency = 4; why = "Onkolojik şüphe — yüksek öncelik."; }

  // 3) Güven skoru
  const confidence = Math.min(95, 45 + bestHits * 18 + (redHit5 || redHit4 ? 10 : 0));

  // 4) Gerekçe metni
  const kwText = matched.length ? `eşleşen anahtar kelimeler: ${matched.slice(0, 6).join(", ")}` : "belirgin anahtar kelime bulunamadı, varsayılan branşa yönlendirildi";
  const reasoning = `Semptom analizi → ${best.label}. (${kwText}). Aciliyet ${urgency}/5 — ${why}`;

  return { branchKey: best.key, branch: best.label, urgency, confidence, reasoning, matched, engine: "rules" };
}
