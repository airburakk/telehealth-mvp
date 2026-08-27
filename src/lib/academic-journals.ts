// Akademik modül — SEÇKİN DERGİ BEYAZ-LİSTESİ + kanıt düzeyi süzgeci (v6.99, 2026-08-15).
//
// SORUN (2026-08-15 dev ölçümü): akademik havuz 74 kayıt / 29 dergiydi ve profili
// "Gut microbes"(10) · "Oncoimmunology"(7) · "The Libyan journal of medicine"(3) gibi orta-düzey
// dergilerden oluşuyordu; NEJM/Lancet/JAMA/BMJ'den TEK kayıt yoktu. Sebep: sorguda dergi ya da
// kanıt-düzeyi ölçütü yoktu — yalnız "son 180 gün, tarihe göre sırala" vardı.
//
// ⚠️ NLM'in "seçkin klinik dergiler" alt kümesi (jsubsetaim / "core clinical journals"[sb]) ÖLÜ:
// 2026-08-15'te ölçüldü, sıfır sonuç döndürüyor (NLM AIM'i güncellemeyi bıraktı). SJR/JCR ise
// lisanslı. Dolayısıyla ölçütü BİZ tanımlıyoruz — kullanıcı kararı 2026-08-15: "yalnız saygın
// medikal dergilerin hakemli araştırmaları".
//
// ÖLÇÜT (iki katmanlı):
//   Katman 1 — beyaz-listedeki dergi VE kanıt üreten yayın tipi (RCT · meta-analiz · sistematik
//              derleme · çok merkezli çalışma · klinik rehber). Editöryel/mektup/yorum DIŞLANIR.
//   Katman 2 — yalnız katman 1 boş dönerse: dergi serbest, kanıt tipi ŞART. Niş branşta akış
//              kurumaz ama "hakemli araştırma" ölçütü korunur.
// Katman 2'den gelen kayıt DB'de `source="pubmed"` olarak aynı kalır; ayrım gerekirse sourceName
// zaten dergi adını taşır (ek kolon açılmadı — bilinçli).
//
// 🪤 Dergi adları PubMed'in `[ta]` (Title Abbreviation) alanına göre YAZILIR ve tek tek DOĞRULANDI
// (2026-08-15, 113/114 ad tanındı; yalnız "Liver Transpl" o an NCBI 500 verdi, listeye alınmadı).
// YENİ AD EKLERKEN: esearch ile `"<ad>"[ta]` sorgusu koşulmadan eklenmez — yanlış yazılmış ad hata
// vermez, SESSİZCE sıfır sonuç döndürür ve o branşın akışı sessizce katman 2'ye düşer.

/** Her branşta geçerli genel tıp dergileri (branşa özel listeye EKLENİR). */
export const GENERAL_JOURNALS: string[] = [
  "N Engl J Med", "Lancet", "JAMA", "BMJ", "Ann Intern Med", "Nat Med", "JAMA Intern Med", "PLoS Med",
];

/** Branş SLUG'ı (lib/triage BRANCHES key) → seçkin dergiler. Etiket değişse de bağ kopmaz. */
export const BRANCH_JOURNALS: Record<string, string[]> = {
  onkoloji: ["J Clin Oncol", "Lancet Oncol", "JAMA Oncol", "Ann Oncol", "Nat Rev Clin Oncol"],
  "radyasyon-onkolojisi": ["Int J Radiat Oncol Biol Phys", "Radiother Oncol", "Lancet Oncol"],
  kardiyoloji: ["Circulation", "J Am Coll Cardiol", "Eur Heart J", "JAMA Cardiol", "Nat Rev Cardiol"],
  kvc: ["J Thorac Cardiovasc Surg", "Ann Thorac Surg", "Eur J Cardiothorac Surg", "Circulation"],
  ortopedi: ["J Bone Joint Surg Am", "Bone Joint J", "Am J Sports Med", "Clin Orthop Relat Res"],
  noroloji: ["Lancet Neurol", "Brain", "Neurology", "JAMA Neurol", "Ann Neurol"],
  norosirurji: ["J Neurosurg", "Neurosurgery", "Lancet Neurol"],
  dahiliye: ["Ann Intern Med", "JAMA Intern Med", "J Gen Intern Med"],
  dermatoloji: ["J Am Acad Dermatol", "JAMA Dermatol", "Br J Dermatol"],
  goz: ["Ophthalmology", "JAMA Ophthalmol", "Am J Ophthalmol", "Br J Ophthalmol"],
  kbb: ["JAMA Otolaryngol Head Neck Surg", "Laryngoscope", "Otolaryngol Head Neck Surg"],
  uroloji: ["Eur Urol", "J Urol", "BJU Int", "Nat Rev Urol"],
  "kadin-dogum": ["Am J Obstet Gynecol", "Obstet Gynecol", "BJOG"],
  ivf: ["Hum Reprod", "Fertil Steril", "Hum Reprod Update"],
  "cocuk-sagligi": ["JAMA Pediatr", "Pediatrics", "Lancet Child Adolesc Health", "Arch Dis Child"],
  "genel-cerrahi": ["Ann Surg", "JAMA Surg", "Br J Surg", "Surgery"],
  "gogus-cerrahisi": ["J Thorac Oncol", "Ann Thorac Surg", "Eur J Cardiothorac Surg"],
  estetik: ["Plast Reconstr Surg", "Aesthet Surg J", "J Plast Reconstr Aesthet Surg"],
  // Saç ekiminin kendi seçkin dergisi yok — alanın literatürü dermatoloji/dermatolojik cerrahide.
  "sac-ekimi": ["Dermatol Surg", "J Am Acad Dermatol", "JAMA Dermatol"],
  endokrinoloji: ["Lancet Diabetes Endocrinol", "Diabetes Care", "J Clin Endocrinol Metab", "Thyroid"],
  gastroenteroloji: ["Gastroenterology", "Gut", "Hepatology", "Am J Gastroenterol", "Lancet Gastroenterol Hepatol"],
  nefroloji: ["J Am Soc Nephrol", "Kidney Int", "Am J Kidney Dis", "Nat Rev Nephrol"],
  "gogus-hastaliklari": ["Am J Respir Crit Care Med", "Eur Respir J", "Chest", "Lancet Respir Med", "Thorax"],
  romatoloji: ["Ann Rheum Dis", "Arthritis Rheumatol", "Lancet Rheumatol", "Rheumatology (Oxford)"],
  hematoloji: ["Blood", "Lancet Haematol", "Haematologica", "Blood Adv"],
  enfeksiyon: ["Clin Infect Dis", "Lancet Infect Dis", "J Infect Dis", "Emerg Infect Dis"],
  psikiyatri: ["JAMA Psychiatry", "Lancet Psychiatry", "Am J Psychiatry", "World Psychiatry", "Mol Psychiatry"],
  "fizik-tedavi": ["Arch Phys Med Rehabil", "J Rehabil Med", "Am J Phys Med Rehabil"],
  dis: ["J Dent Res", "J Clin Periodontol", "J Endod", "J Dent"],
  "organ-nakli": ["Am J Transplant", "Transplantation", "J Hepatol"],

  // Doktor-only branşlar (v6.119) — Akademik modülü bu haritayı okur; eksikse branş boş kalır.
  "acil-tip": ["Ann Emerg Med", "Acad Emerg Med", "Emerg Med J", "Resuscitation"],
  radyoloji: ["Radiology", "Eur Radiol", "AJR Am J Roentgenol", "Radiographics"],
  anesteziyoloji: ["Anesthesiology", "Br J Anaesth", "Anesth Analg", "Intensive Care Med"],
  patoloji: ["Am J Surg Pathol", "Mod Pathol", "Histopathology", "J Pathol"],
  "tibbi-genetik": ["Am J Hum Genet", "Genet Med", "Nat Genet", "Eur J Hum Genet"],
};

/**
 * Kanıt üreten yayın tipleri. "Review" (anlatısal derleme) BİLİNÇLİ yok — hakemlidir ama yeni
 * kanıt üretmez; sistematik derleme ve meta-analiz zaten listede.
 */
export const EVIDENCE_TYPES: string[] = [
  "randomized controlled trial",
  "meta-analysis",
  "systematic review",
  "multicenter study",
  "practice guideline",
];

/** Kanıt taşımayan yayın tipleri — beyaz-liste dergilerinde bunlar akışın çoğunluğunu oluşturur. */
export const EXCLUDED_TYPES: string[] = ["editorial", "letter", "comment", "news", "biography", "retracted publication"];

// ── İnsan tıbbı kısıtı (2026-08-26) ─────────────────────────────────────────
//
// SORUN: akademik akışa "Journal of Integrative Agriculture"dan buzağı ishali makalesi düştü
// (DOAJ, serbest-metin "gastrointestinal diseases" eşleşmesi — DOAJ TÜM disiplinleri indeksler).
// Hattın hiçbir katmanında insan-tıbbı ölçütü yoktu. Üç katmanlı savunma:
//
//   1) PubMed: sorguya PUBMED_HUMAN_FILTER — `humans[mh]` TEK BAŞINA kullanılMAZ (MeSH indekslemesi
//      haftalar gecikir; taze kayıtlar sessizce elenirdi). `NOT (animals[mh] NOT humans[mh])`
//      yalnız "hayvan-işaretli ve insan-işaretsiz" kayıtları düşürür; indekslenmemişler geçer.
//   2) DOAJ: LCC konu kodu (lccNonMedicine) — tıp = "R" sınıfı; tarım/veterinerlik = "S"/"SF".
//      ⚠️ API wildcard'ı REDDEDİYOR ("disallowed Lucene features", 2026-08-26 ölçümü) → süzgeç
//      sorguda değil, dönen kaydın verisi üstünde.
//   3) Tüm kaynaklar: dergi adı + başlık bekçisi (isNonHumanAcademic). Europe PMC'nin TEK savunması
//      bu: `MESH:` alanı güvenilmez (2026-08-26 ölçümü: MESH:"Neoplasms" yalnız ~63 bin kayıt —
//      alan patlatılmamış/kısmi; sorgu-düzeyi MeSH süzgeci sessizce işlevsiz kalıyor).
//
// 🪤 Başlık deseni BİLİNÇLİ dar: yalnız çiftlik/hayvancılık terimleri. "mouse/rat/porcine" YOK —
// fare modeli ve domuz ksenotransplantasyonu İNSAN tıbbı literatürüdür (organ-nakli branşının
// gerçek içeriği); genişletmeden önce translasyonel araştırmayı kurutmadığını ölç. "goats" yalnız
// çoğul: tekil "goat" büyük/küçük harf duyarsız modda GOAT ölçeğini (Galveston Orientation and
// Amnesia Test — insan TBI değerlendirmesi) yakalardı.

/** PubMed sorgu eki — gecikme-güvenli insan süzgeci (tier1 + tier2'ye eklenir). */
export const PUBMED_HUMAN_FILTER = "NOT (animals[mh] NOT humans[mh])";

/** Veteriner/tarım/hayvan bilimi DERGİ adları (insan tıbbı dergisinde geçmeyen kelimeler). */
export const NONHUMAN_JOURNAL_RE =
  /veterinar|agricultur|\banimal|livestock|\bdairy\b|poultry|aquacult|zoonos|zoolog|entomolog|botan|\bplant\b|\bcrop\b|fisher(y|ies)|wildlife|\bavian\b/i;

/** Çiftlik/hayvancılık BAŞLIK terimleri — genel dergideki (PLOS ONE vb.) hayvancılık çalışması için. */
export const NONHUMAN_TITLE_RE =
  /\b(calf|calves|bovine|cattle|heifers?|dairy cows?|piglets?|weanlings?|sows|broilers?|poultry|laying hens?|ewes?|lambs?|goats|caprine|equine|foals?|mares?|canine|feline|veterinary|aquaculture|tilapia|salmonids?|honey ?bees?)\b/i;

/** İnsan tıbbı DIŞI akademik içerik mi? (dergi adı VEYA başlık yakalarsa dışla — fail-closed değil,
 *  desen-bazlı: yakalanmayan kayıt geçer; DOAJ'da LCC kodu ek katmandır.) */
export function isNonHumanAcademic(journal: string | null | undefined, title: string): boolean {
  return NONHUMAN_JOURNAL_RE.test(journal ?? "") || NONHUMAN_TITLE_RE.test(title);
}

/**
 * DOAJ LCC konu kodları tıp DIŞINI mı gösteriyor? Tıp = LCC "R" sınıfı (RC dahiliye, RD cerrahi,
 * RJ pediatri…). Kod hiç yoksa karar VERİLMEZ (false) — o durumda isNonHumanAcademic tek bekçidir.
 */
export function lccNonMedicine(codes: string[]): boolean {
  return codes.length > 0 && !codes.some((c) => c.trim().toUpperCase().startsWith("R"));
}

function orGroup(values: string[], field: string): string {
  return `(${values.map((v) => `"${v}"[${field}]`).join(" OR ")})`;
}

/**
 * Katman 1 sorgusu: MeSH + beyaz-liste dergi + kanıt tipi (− kanıtsız tipler − hayvan-only).
 * Branşın kendi listesi yoksa yalnız genel dergiler kullanılır (liste hiç boş kalmaz).
 * 🪤 join(" AND ") NOT'lu öğelerde " AND NOT " üretir → replaceAll ŞART (iki NOT öğesi var;
 * tekil replace ikincisini kaçırır ve PubMed "AND NOT"u kabul etse de sözleşme testi kırılır).
 */
export function tier1Query(mesh: string, branchSlug: string): string {
  const journals = [...new Set([...(BRANCH_JOURNALS[branchSlug] ?? []), ...GENERAL_JOURNALS])];
  return [
    `(${mesh})`,
    "hasabstract",
    orGroup(journals, "ta"),
    orGroup(EVIDENCE_TYPES, "pt"),
    `NOT ${orGroup(EXCLUDED_TYPES, "pt")}`,
    PUBMED_HUMAN_FILTER,
  ].join(" AND ").replaceAll(" AND NOT ", " NOT ");
}

/** Katman 2 (yedek): dergi serbest, kanıt tipi şart — niş branşta akış kurumasın. */
export function tier2Query(mesh: string): string {
  return [`(${mesh})`, "hasabstract", orGroup(EVIDENCE_TYPES, "pt"), `NOT ${orGroup(EXCLUDED_TYPES, "pt")}`, PUBMED_HUMAN_FILTER]
    .join(" AND ")
    .replaceAll(" AND NOT ", " NOT ");
}

// NOT: "bu kayıt beyaz-listeden mi geldi" sorusuna bakan bir yardımcı BİLİNÇLİ yok. PubMed
// esummary dergi ADINI uzun biçimde verir ("The New England journal of medicine") ama beyaz-liste
// PubMed'in kısaltmasını taşır ("N Engl J Med") — ikisini eşleştiren gevşek karşılaştırma
// "BMJ Open"i "BMJ" sanacak kadar yanılgılıdır. Katman bilgisi gerekirse ingest anında bilinir
// (lib/doctorium-ingest.ts) ve oradan raporlanır.
