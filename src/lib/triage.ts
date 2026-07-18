// Triyaj Motoru (MVP — kural tabanlı "AI" stub)
// Semptom metnini analiz edip branş + aciliyet skoru (1-5) üretir.
// İleride bu fonksiyon bir LLM/NLP servisiyle değiştirilecek (bkz. AI Orchestration Gateway).

export interface BranchDef {
  key: string;
  label: string;
  keywords: string[];
}

export const BRANCHES: BranchDef[] = [
  // ── Mevcut branşlar (etiketler değiştirilmedi — seed doktor eşleşmesi korunur) ──
  { key: "onkoloji", label: "Onkoloji", keywords: ["kanser", "tümör", "tumor", "onkoloji", "kitle", "metastaz", "biyopsi", "lenf", "kemoterapi", "ur"] },
  { key: "kardiyoloji", label: "Kardiyoloji", keywords: ["kalp", "göğüs ağrı", "çarpıntı", "tansiyon", "kardiyo", "ritim", "damar", "bypass", "stent"] },
  { key: "ortopedi", label: "Ortopedi", keywords: ["diz", "kalça", "omuz", "kemik", "kırık", "eklem", "bel ağrı", "menisk", "protez", "kıkırdak", "topuk"] },
  { key: "norosirurji", label: "Nöroşirürji", keywords: ["beyin", "omurga", "disk", "felç", "omurilik", "beyin tümör", "bel fıtığı ameliyat"] },
  { key: "sac-ekimi", label: "Saç Ekimi", keywords: ["saç", "saç dökül", "greft", "fue", "dht", "kellik", "ekim", "sakal ekim"] },
  { key: "estetik", label: "Estetik Cerrahi", keywords: ["estetik", "burun", "rinoplasti", "liposuction", "meme", "yağ ald", "germe", "botoks", "dolgu", "plastik cerrahi"] },
  { key: "ivf", label: "Tüp Bebek (IVF)", keywords: ["tüp bebek", "ivf", "kısırlık", "infertilite", "yumurtlama", "embriyo", "aşılama", "gebe kalamı"] },
  { key: "dis", label: "Diş Tedavisi", keywords: ["diş", "implant", "kanal", "ortodonti", "gülüş", "dolgu diş", "çene", "kaplama diş"] },
  { key: "goz", label: "Göz Cerrahisi", keywords: ["göz", "katarakt", "lasik", "retina", "görme", "miyop", "şaşılık", "glokom"] },
  { key: "genel-cerrahi", label: "Genel Cerrahi", keywords: ["safra", "apandisit", "tiroid ameliyat", "fıtık karın", "kasık fıtığı", "kese", "hemoroid", "obezite cerrah"] },
  { key: "dahiliye", label: "Dahiliye (İç Hastalıkları)", keywords: ["halsizlik", "tahlil", "kan değer", "genel kontrol", "yorgunluk", "iç hastalık"] },

  // ── Dahili (medikal) dallar ──
  { key: "noroloji", label: "Nöroloji", keywords: ["baş ağrı", "migren", "baş dönmesi", "nöbet", "epilepsi", "parkinson", "unutkanlık", "nöroloji", "el titreme", "inme", "uyuşma"] },
  { key: "gastroenteroloji", label: "Gastroenteroloji", keywords: ["reflü", "gastrit", "ülser", "hepatit", "kolit", "ishal", "kabızlık", "endoskopi", "kolonoskopi", "mide yanma", "sindirim"] },
  { key: "endokrinoloji", label: "Endokrinoloji ve Metabolizma", keywords: ["tiroit", "tiroid", "guatr", "hormon", "hipofiz", "metabolizma", "insülin", "hashimoto", "şeker hasta", "diyabet"] },
  { key: "nefroloji", label: "Nefroloji", keywords: ["böbrek yetmezliği", "diyaliz", "kreatinin", "nefrit", "idrarda protein", "böbrek hastalığı"] },
  { key: "gogus-hastaliklari", label: "Göğüs Hastalıkları", keywords: ["astım", "koah", "öksürük", "akciğer", "bronşit", "zatürre", "uyku apne", "balgam", "nefes darlığı"] },
  { key: "hematoloji", label: "Hematoloji", keywords: ["anemi", "kansızlık", "lösemi", "lenfoma", "pıhtılaşma", "trombosit", "kemik iliği", "hemoglobin düşük", "kan hastalığı"] },
  { key: "romatoloji", label: "Romatoloji", keywords: ["romatizma", "romatoid", "lupus", "gut", "eklem iltihap", "behçet", "ankilozan", "eklem şişme", "sabah tutuk"] },
  { key: "enfeksiyon", label: "Enfeksiyon Hastalıkları", keywords: ["enfeksiyon", "mikrop", "hiv", "viral", "bakteri", "uzun süreli ateş", "antibiyotik", "hepatit b", "hepatit c"] },
  { key: "dermatoloji", label: "Dermatoloji (Cilt Hastalıkları)", keywords: ["cilt", "deri", "sivilce", "akne", "egzama", "sedef", "leke", "mantar", "döküntü", "ben kontrol", "kaşıntı", "saç dermatoloji"] },
  { key: "psikiyatri", label: "Psikiyatri", keywords: ["depresyon", "anksiyete", "panik atak", "uykusuzluk", "psikiyatri", "bipolar", "obsesif", "ruhsal", "stres"] },
  { key: "fizik-tedavi", label: "Fiziksel Tıp ve Rehabilitasyon", keywords: ["fizik tedavi", "rehabilitasyon", "kas ağrı", "tutukluk", "felç rehabilitasyon", "ftr", "boyun tutulma"] },
  { key: "cocuk-sagligi", label: "Çocuk Sağlığı ve Hastalıkları", keywords: ["çocuk", "bebek", "pediatri", "aşı", "çocuğum", "büyüme gelişme"] },

  // ── Cerrahi dallar ──
  { key: "uroloji", label: "Üroloji", keywords: ["prostat", "böbrek taşı", "mesane", "sünnet", "testis", "üroloji", "işeme", "varikosel", "idrar kaçır", "iktidarsız"] },
  { key: "kbb", label: "Kulak Burun Boğaz (KBB)", keywords: ["kulak", "burun tıkanık", "boğaz", "geniz", "sinüzit", "bademcik", "işitme", "horlama", "kbb", "ses kısık"] },
  { key: "kadin-dogum", label: "Kadın Hastalıkları ve Doğum", keywords: ["gebelik", "doğum", "jinekoloji", "rahim", "yumurtalık", "adet", "miyom", "smear", "menopoz", "kadın doğum", "kist yumurtalık"] },
  { key: "kvc", label: "Kalp ve Damar Cerrahisi", keywords: ["bypass", "kalp ameliyat", "kapak ameliyat", "açık kalp", "aort", "varis", "damar tıkanıklığı ameliyat", "anevrizma"] },
  { key: "gogus-cerrahisi", label: "Göğüs Cerrahisi", keywords: ["akciğer ameliyat", "göğüs cerrahi", "plevra", "akciğer nodül", "toraks", "akciğer kitle ameliyat"] },
  { key: "organ-nakli", label: "Organ Nakli", keywords: ["organ nakli", "böbrek nakli", "karaciğer nakli", "transplant", "nakil", "donör", "verici", "nakil bekleme"] },
  { key: "radyasyon-onkolojisi", label: "Radyasyon Onkolojisi", keywords: ["radyoterapi", "ışın tedavi", "radyasyon onkoloji"] },
];

const RED_FLAGS_5 = ["nefes darlığı", "göğüs ağrı", "bilinç", "felç", "şiddetli kanama", "kanama", "inme", "bayıl", "39", "40 derece", "kan kus", "morar"];
const RED_FLAGS_4 = ["ateş", "kusma", "şiddetli ağrı", "kanlı", "ani ", "yüksek tansiyon", "şişlik hızl"];
const ELECTIVE = ["saç", "estetik", "rinoplasti", "diş", "kontrol", "lazer", "gülüş", "dolgu", "botoks"];

export interface TriageInput {
  symptoms: string;
  durationText?: string;
  answers?: Record<string, string>;
  forceBranchKey?: string; // hasta branşı elle seçtiyse (branş sabitlenir, aciliyet yine hesaplanır)
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

  // Hasta branşı elle seçtiyse onu sabitle (aciliyet yine aşağıda semptom/yanıtlardan hesaplanır)
  const forced = input.forceBranchKey ? BRANCHES.find((b) => b.key === input.forceBranchKey) : null;
  if (forced) best = forced;

  // 2) Aciliyet skoru
  let urgency = 3;
  const redHit5 = RED_FLAGS_5.find((k) => text.includes(k));
  const redHit4 = RED_FLAGS_4.find((k) => text.includes(k));
  const electiveHit = ELECTIVE.find((k) => text.includes(k));
  let why = "Belirtiler orta düzeyde değerlendirildi.";
  if (redHit5) { urgency = 5; why = `Kırmızı bayrak ("${redHit5}") tespit edildi — acil önceliklendirme.`; }
  else if (redHit4) { urgency = 4; why = `Dikkat gerektiren belirti ("${redHit4}") tespit edildi.`; }
  else if (electiveHit && bestHits > 0) { urgency = best.key === "onkoloji" || best.key === "kardiyoloji" ? 3 : 1; why = "Elektif (seçimlik) işlem profili — düşük aciliyet."; }
  else if (["onkoloji", "radyasyon-onkolojisi", "organ-nakli", "kvc", "gogus-cerrahisi", "hematoloji"].includes(best.key)) { urgency = 4; why = "Yüksek öncelikli branş (onkoloji/nakil/kalp-damar) — ileri değerlendirme."; }

  // 3) Güven skoru (branş elle seçildiyse yüksek)
  const confidence = forced ? 92 : Math.min(95, 45 + bestHits * 18 + (redHit5 || redHit4 ? 10 : 0));

  // 4) Gerekçe metni
  const kwText = matched.length ? `eşleşen anahtar kelimeler: ${matched.slice(0, 6).join(", ")}` : "belirgin anahtar kelime bulunamadı, varsayılan branşa yönlendirildi";
  const reasoning = forced
    ? `Hasta tarafından seçilen branş → ${best.label}. Aciliyet ${urgency}/5 — ${why}`
    : `Semptom analizi → ${best.label}. (${kwText}). Aciliyet ${urgency}/5 — ${why}`;

  return { branchKey: best.key, branch: best.label, urgency, confidence, reasoning, matched, engine: "rules" };
}
