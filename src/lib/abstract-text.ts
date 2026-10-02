// Akademik özet METNİ normalleştirme — SAF (ağ/DB yok), birim testli (tests/unit/abstract-text.test.ts).
//
// KÖK SORUN (2026-10-02, Günlük Seçki özetleri ölçülürken): yapılandırılmış özetin bölüm etiketleri düz metne
// indirgenirken sonraki cümleye YAPIŞIYORDU — "BackgroundGas flaring…", "…communities.ObjectiveThis study…".
// İki ayrı köken, iki ayrı çözüm:
//  · Europe PMC `abstractText` HTML'dir: etiket `<h4>Background</h4>`, ardından DOĞRUDAN metin (`<p>` yok). Eski çıkarım
//    (`.replace(/<[^>]+>/g, "")`) etiketi boşluksuz söküyordu — 100 canlı örneğin 35'i <h4> taşıyordu (dev DB'de 534
//    satırın 270'i yapışıktı). YAPI bilgisi VAR → sezgisel gerekmez: `<h4>` "Etiket: " olur (abstractHtmlToText).
//  · DOAJ'ın ham JSON özeti kaynağında ZATEN yapışık ("…association.MethodsThe medical records…"): yapı bilgisi yok →
//    sözlük tabanlı onarım (repairGluedAbstractLabels). PubMed efetch etiketi `Label=` özniteliğinde taşır (metne hiç
//    girmez), yapışma üretmez — bu modülün kapsamı dışı.
//
// ⚠️ Ham `<` etiket DEĞİLDİR: özetlerde "<30 yaş", "p<0.05" geçer; eski `<[^>]+>` deseni böyle bir `<`'den sonraki ilk
// `>`'a kadar METNİ silebilirdi. Etiket yalnız `<` (ya da `</`) + HARF ile başlar.

/** Gerçek HTML etiketi: `<` (ya da `</`) ardından HARF. "<30", "p<0.05" gibi ham `<` etiket sayılmaz. */
const TAG = /<\/?[A-Za-z][A-Za-z0-9:-]*(?:\s[^<>]*)?\/?>/g;
/** Başlık etiketi = yapılandırılmış özetin bölüm adı (Europe PMC: `<h4>Background</h4>`). */
const HEADING = /<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi;
/** Blok sınırları metni böler → boşluk. Satır içi etiketler (sup/sub/i/b…) boşluksuz sökülür: CO<sub>2</sub> → CO2. */
const BLOCK = /<\/?(?:p|br|div|li|ul|ol|table|tr|td|th|section|blockquote)\b[^>]*>/gi;

/**
 * HTML'li özeti düz metne indirir; bölüm başlıkları "Etiket: " olur ve öncesi/sonrasıyla boşlukla ayrılır.
 * "<h4>Background</h4>Gas flaring…<h4>Objective</h4>This study…" → "Background: Gas flaring… Objective: This study…".
 * Varlıklar ÇÖZÜLMEZ (eski davranış: okuma anında `decodeFeedText` çözer).
 */
export function abstractHtmlToText(html: string): string {
  return html
    .replace(HEADING, (_m, inner: string) => {
      const label = inner.replace(TAG, "").replace(/\s+/g, " ").trim().replace(/[\s:.]+$/, "");
      return label ? ` ${label}: ` : " ";
    })
    .replace(BLOCK, " ")
    .replace(TAG, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Yapılandırılmış özetlerin bilinen bölüm etiketleri (canlı örneklemden: Europe PMC 534 + DOAJ 168 satır — JAMA, BMJ Open,
 * Bioinformatics tarzı bileşikler dahil; dev'de onarımdan önce 296 satır yapışıkken sonra gerçek-etiket artığı kalmadı).
 * Uzun ifade kısa önekinden ÖNCE denensin diye uzunluğa göre sıralanır ("Materials and methods" ≻ "Materials" ≻ …).
 * Yalnız TAM etiket adları — "PubMed" / "ClinicalTrials.gov" / "HyperSperm" / "BugBase" gibi CamelCase özel adlar asla eşleşmez.
 */
const GLUED_LABELS = [
  "Background and objectives", "Background and objective", "Background and aims", "Background and purpose",
  "Background/objectives", "Background/aims", "Background/purpose", "Background & aims", "Aims and objectives",
  "Aim and objectives", "Introduction and aims", "Purpose of review", "Abstract Background",
  "Materials and methods", "Materials & methods", "Patients and methods", "Patient and methods", "Subjects and methods",
  "Method and design", "Methods and analysis", "Methods and results", "Study design", "Design and setting",
  "Design, setting, and participants", "Main outcomes and measures", "Main outcome measures", "Exposure or intervention",
  "Results and conclusions", "Results and conclusion", "Results & conclusion", "Results and discussion",
  "Discussion and conclusions", "Discussion and conclusion", "Conclusions and relevance", "Conclusions and importance",
  "Ethics and dissemination", "Availability and implementation", "Case presentation", "Presentation of case",
  "Trial registration",
  "Background", "Objectives", "Objective", "Aims", "Aim", "Purpose", "Introduction", "Importance", "Context",
  "Rationale", "Motivation", "Summary", "Abstract", "Materials", "Design", "Setting", "Settings", "Participants",
  "Subjects", "Patients", "Interventions", "Intervention", "Exposures", "Exposure", "Procedures", "Methods", "Method",
  "Methodology", "Results", "Result", "Findings", "Finding", "Interpretation", "Conclusions", "Conclusion", "Discussion",
  "Limitations", "Lessons", "Funding", "Registration",
].sort((a, b) => b.length - a.length);

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
/**
 * Etiketin regex'i: İLK sözcük olduğu gibi (büyük harfle başlar), sonraki sözcüklerin baş harfi büyük/küçük olabilir
 * ("Materials and Methods" · "Main Outcome Measures" · "Background/Objectives"); sözcükler arası boşluk esnek.
 */
function labelPattern(label: string): string {
  return label
    .split(/([ /])/) // sözcük + ayraç: "Background/objectives" → ["Background", "/", "objectives"]
    .map((tok, i) => {
      if (tok === " ") return "\\s+";
      if (tok === "/") return "\\/";
      return i === 0 || !/^[A-Za-z]/.test(tok) ? escapeRe(tok) : `[${tok[0].toLowerCase()}${tok[0].toUpperCase()}]${escapeRe(tok.slice(1))}`;
    })
    .join("");
}
/**
 * Etiket, cümle sonu noktalamasına (ya da metin başına) BİTİŞİK ve hemen ardından BÜYÜK harf gelirse yapışıktır:
 * "…association.MethodsThe medical records…". Büyük harf şartı sıradan metni korur ("Methods and Results" boşlukludur).
 * Sayıyla başlayan yapışma ("Results101 patients") bilinçle KAPSAM DIŞI: "Aim2" gibi gen adlarını bölmemek için.
 */
const GLUED = new RegExp(`(^|[.!?%)\\]"'])\\s*(${GLUED_LABELS.map(labelPattern).join("|")})(?=[A-Z])`, "g");

/**
 * Yapışık bölüm etiketlerine ": " koyar ve önündeki boşluğu tamamlar. İdempotent: onarılmış metin değişmez.
 * "BackgroundThe scope…association.MethodsThe records…" → "Background: The scope…association. Methods: The records…".
 */
export function repairGluedAbstractLabels(text: string): string {
  return text.replace(GLUED, (_m, pre: string, label: string) => `${pre}${pre ? " " : ""}${label}: `);
}

/** Ham özeti (HTML ya da düz) tek yoldan normalleştirir: yapıyı koru, etiketleri sök, yapışık etiketleri onar. */
export function normalizeAbstractText(raw: string): string {
  return repairGluedAbstractLabels(abstractHtmlToText(raw));
}
