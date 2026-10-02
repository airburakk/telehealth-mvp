// Akademik özet etiketi normalleştirme sözleşmesi (2026-10-02, Günlük Seçki özetlerinin ölçümü).
//
// Kilitlenen kusur: yapılandırılmış özetin bölüm etiketleri sonraki cümleye YAPIŞIYORDU ("BackgroundGas flaring…",
// "…communities.ObjectiveThis study…"). Europe PMC'de etiket `<h4>` olarak GELİR (yapı var → "Etiket: " yapılır);
// DOAJ'ın ham JSON'unda kaynağında yapışıktır (yapı yok → sözlük tabanlı onarım). Fixture'lar canlı kayıtlardan kısaltıldı.
import { describe, it, expect } from "vitest";
import { abstractHtmlToText, repairGluedAbstractLabels, normalizeAbstractText } from "@/lib/abstract-text";

// Canlı Europe PMC kaydı (2026-10-02, DOI 10.1080/16549716.2026.2732789) — kısaltılmış.
const EPMC_RAW =
  "<h4>Background</h4>Gas flaring associated with oil extraction is a major source of environmental pollution and has been " +
  "linked to adverse health outcomes worldwide. In the Ecuadorian Amazon, decades of oil exploitation have resulted in " +
  "widespread gas flaring.<h4>Objective</h4>This study assessed the association between exposure to gas flaring and cancer " +
  "incidence in the provinces of Sucumbíos and Orellana, Ecuador, between 2010 and 2019.<h4>Methods</h4>We conducted an " +
  "ecological study at the parish level using data from the Quito Cancer Registry.";

describe("abstractHtmlToText: Europe PMC <h4> etiketi", () => {
  it("<h4> 'Etiket: ' olur, bölümler boşlukla ayrılır — seçkideki 'BackgroundGas' kusuru", () => {
    const out = abstractHtmlToText(EPMC_RAW);
    expect(out.startsWith("Background: Gas flaring associated with oil extraction")).toBe(true);
    expect(out).toContain("widespread gas flaring. Objective: This study assessed");
    expect(out).toContain("between 2010 and 2019. Methods: We conducted an ecological study");
    // eski çıkarımın ürettiği yapışıklıklar KALMAZ
    expect(out).not.toMatch(/BackgroundGas|flaring\.ObjectiveThis|2019\.MethodsWe/);
  });

  it("eski çıkarım (etiketi boşluksuz sök) aynı girdide yapışık üretirdi — fixture kusuru gerçekten yeniden üretir", () => {
    const legacy = EPMC_RAW.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    expect(legacy.startsWith("BackgroundGas flaring")).toBe(true);
    expect(legacy).toContain("flaring.ObjectiveThis study");
  });

  it("başlıkta zaten iki nokta/nokta varsa çift iki nokta üretmez", () => {
    expect(abstractHtmlToText("<h4>Background:</h4>Text here.")).toBe("Background: Text here.");
    expect(abstractHtmlToText("<h4>Aims.</h4>Text here.")).toBe("Aims: Text here.");
  });

  it("başlık içindeki satır içi etiket sökülür; boş başlık 'undefined' ya da boş etiket üretmez", () => {
    expect(abstractHtmlToText("<h4><b>Methods</b></h4>We did X.")).toBe("Methods: We did X.");
    expect(abstractHtmlToText("<h4></h4>Only text.")).toBe("Only text.");
  });

  it("uzun, çok sözcüklü etiketler olduğu gibi korunur", () => {
    expect(abstractHtmlToText("<h4>Implications for school health policy, practice, and equity</h4>We found Y."))
      .toBe("Implications for school health policy, practice, and equity: We found Y.");
  });
});

describe("abstractHtmlToText: etiket ayıklama", () => {
  it("satır içi etiketler (sup/sub/i/b) BOŞLUKSUZ sökülür", () => {
    expect(abstractHtmlToText("CO<sub>2</sub> and 10<sup>-6</sup> and <i>p</i>-value")).toBe("CO2 and 10-6 and p-value");
  });

  it("blok etiketleri (<p>, <br>) sözcükleri ayırır", () => {
    expect(abstractHtmlToText("<p>One.</p><p>Two.</p>")).toBe("One. Two.");
    expect(abstractHtmlToText("A<br/>B<br>C")).toBe("A B C");
  });

  it("ham '<' bir etiket DEĞİLDİR — eski desen '<30'dan sonraki '>'a kadar metni silerdi", () => {
    const text = "Patients aged <30 years had p<0.05 and BMI >25 more often.";
    expect(abstractHtmlToText(text)).toBe(text);
    // belge: eski `/<[^>]+>/g` aynı girdide ortadaki cümleyi yutuyordu
    expect(text.replace(/<[^>]+>/g, "")).toBe("Patients aged 25 more often.");
  });

  it("boş/boşluk girdi boş string döner; çoklu boşluk tek boşluğa iner", () => {
    expect(abstractHtmlToText("")).toBe("");
    expect(abstractHtmlToText("  \n ")).toBe("");
    expect(abstractHtmlToText("a   b\n\nc")).toBe("a b c");
  });

  it("varlıklar ÇÖZÜLMEZ (okuma anında decodeFeedText çözer — eski davranış korunur)", () => {
    expect(abstractHtmlToText("p &lt; 0.05 &amp; more")).toBe("p &lt; 0.05 &amp; more");
  });
});

describe("repairGluedAbstractLabels: DOAJ'ın kaynağında yapışık etiketleri", () => {
  // Canlı DOAJ kaydı (ham JSON'da böyle geliyor) — kısaltılmış.
  const DOAJ_RAW =
    "BackgroundThe scope of comorbid conditions with meningiomas is understudied. There is limited published evidence. " +
    "This retrospective study was designed to evaluate this association.MethodsThe medical records from 584 patients " +
    "with intracranial meningioma were reviewed.ResultsThyroid disease was more common.ConclusionsThyroid disease may be associated.";

  it("etiketin ardına ': ' konur ve önündeki boşluk tamamlanır", () => {
    const out = repairGluedAbstractLabels(DOAJ_RAW);
    expect(out.startsWith("Background: The scope of comorbid conditions")).toBe(true);
    expect(out).toContain("this association. Methods: The medical records");
    expect(out).toContain("were reviewed. Results: Thyroid disease was more common. Conclusions: Thyroid disease may be associated.");
    expect(out).not.toMatch(/BackgroundThe|\.MethodsThe|\.ResultsThyroid|\.ConclusionsThyroid/);
  });

  it("bileşik etiketler tek parça (uzun ifade kısa önekinden önce denenir)", () => {
    expect(repairGluedAbstractLabels("Background/objectivesTo assess the safety of X."))
      .toBe("Background/objectives: To assess the safety of X.");
    expect(repairGluedAbstractLabels("Study aims.Materials and methodsPatients were enrolled."))
      .toBe("Study aims. Materials and methods: Patients were enrolled.");
    expect(repairGluedAbstractLabels("Trial registrationNCT01234567")).toBe("Trial registration: NCT01234567");
  });

  it("BMJ Open / JAMA / Bioinformatics tarzı bileşik etiketler ve büyük-harfli varyantlar (dev ölçümünde sözlük dışı kalanlar)", () => {
    const cases: [string, string][] = [
      ["Done.Methods and analysisThis single-centre study.", "Done. Methods and analysis: This single-centre study."],
      ["Done.Ethics and disseminationEthical approval was granted.", "Done. Ethics and dissemination: Ethical approval was granted."],
      ["Done.Discussion and conclusionsAll species were active.", "Done. Discussion and conclusions: All species were active."],
      ["Done.Materials & methodsExtracts were prepared.", "Done. Materials & methods: Extracts were prepared."],
      ["Done.Materials and MethodsPatients were enrolled.", "Done. Materials and Methods: Patients were enrolled."], // Title Case varyant
      ["Done.Main Outcome MeasuresClinical symptoms were recorded.", "Done. Main Outcome Measures: Clinical symptoms were recorded."],
      ["Done.Exposure or InterventionAll patients underwent MRI.", "Done. Exposure or Intervention: All patients underwent MRI."],
      ["Purpose of reviewMigration is an increasing issue.", "Purpose of review: Migration is an increasing issue."],
      ["Done.Availability and implementationPEStimate is online.", "Done. Availability and implementation: PEStimate is online."],
      ["Done.Presentation of caseTwo patients presented.", "Done. Presentation of case: Two patients presented."],
      ["Background and objectiveThe integration of AI is new.", "Background and objective: The integration of AI is new."],
      ["Done.LessonsThis illustrative case demonstrates risk.", "Done. Lessons: This illustrative case demonstrates risk."],
      ["Done.MaterialsTwo clones were studied.", "Done. Materials: Two clones were studied."],
      ["AbstractOrthopedic surgery is common.", "Abstract: Orthopedic surgery is common."],
      ["Abstract BackgroundChronic urticaria is common.", "Abstract Background: Chronic urticaria is common."],
      ["Background/ObjectivesOlder adults undergo surgery.", "Background/Objectives: Older adults undergo surgery."],
    ];
    for (const [input, expected] of cases) expect(repairGluedAbstractLabels(input), input).toBe(expected);
  });

  it("cümle sonundan önce boşluk varsa da onarır; yüzde/parantez sonrası yapışmayı da", () => {
    expect(repairGluedAbstractLabels("It was safe. ResultsThe rate was 5%.")).toBe("It was safe. Results: The rate was 5%.");
    expect(repairGluedAbstractLabels("Risk fell by 45%ConclusionsOur data suggest benefit.")).toBe("Risk fell by 45% Conclusions: Our data suggest benefit.");
    expect(repairGluedAbstractLabels("Was higher (p<0.05).DiscussionIn context.")).toBe("Was higher (p<0.05). Discussion: In context.");
  });

  it("İDEMPOTENT: onarılmış metin ikinci geçişte değişmez", () => {
    const once = repairGluedAbstractLabels(DOAJ_RAW);
    expect(repairGluedAbstractLabels(once)).toBe(once);
  });

  it("sıradan metne DOKUNMAZ (PubMed/ClinicalTrials.gov, boşluklu etiket, gen adı, küçük harf…)", () => {
    const same = [
      "PubMed and ClinicalTrials.gov were searched.",
      "Methods and Results are described below.",
      "The study design was randomized.",
      "Aim2 inflammasome activation was measured.",
      "Design Expert software was used.",
      "Results: The rate was 5%.",
      "Methodswe describe nothing here.",
      "Background: Already formatted.",
      "Values rose in the Summary.",
      // dev ölçümündeki özel adlar (gerçek etiket DEĞİL): CamelCase ürün/yöntem adları bölünmez
      "HyperSperm is a novel capacitation assay.",
      "BugBase analysis revealed enrichment.",
      "ThinPrep-fixed specimens were stable. EasyEnsemble and logistic regression were compared.",
      "Using CiteSpace for visual data analysis, we found trends. PubMed, Embase, Scopus were searched.",
      "Trial Registration ClinicalTrials.gov identifier: NCT0135",
    ];
    for (const s of same) expect(repairGluedAbstractLabels(s), s).toBe(s);
  });
});

describe("normalizeAbstractText: tek giriş (EPMC HTML + DOAJ düz metin/ham etiketli)", () => {
  it("DOAJ'ın bazı kayıtlarındaki ham <b>/<i>/<sub> sökülür, etiket çift iki nokta almaz", () => {
    expect(normalizeAbstractText("<b>Background:</b> Bronchiectasis is a chronic respiratory condition."))
      .toBe("Background: Bronchiectasis is a chronic respiratory condition.");
    expect(normalizeAbstractText("<i>Background/Objectives</i>: Older adults undergoing surgery."))
      .toBe("Background/Objectives: Older adults undergoing surgery.");
    expect(normalizeAbstractText("Severity by SpO<sub>2</sub> to FiO<sub>2</sub> (SF) ratio")).toBe("Severity by SpO2 to FiO2 (SF) ratio");
  });

  it("Europe PMC HTML'i ve yapışık düz metni aynı yoldan temizler", () => {
    expect(normalizeAbstractText(EPMC_RAW)).toBe(abstractHtmlToText(EPMC_RAW));
    expect(normalizeAbstractText("BackgroundGas flaring is bad.ObjectiveTo assess it."))
      .toBe("Background: Gas flaring is bad. Objective: To assess it.");
  });
});
