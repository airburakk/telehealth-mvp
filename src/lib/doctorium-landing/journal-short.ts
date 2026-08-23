// Landing künyesi için KISA YAYIN ADI (QA pre-freeze 4, 2026-08-23): "The New England journal of
// medicine" dar kartta sıkışıyordu. Veri modelinde kısa ad alanı YOK (NewsArticle.sourceName = PubMed'in
// tam dergi adı) → yalnız yaygın bilinen kısaltmalar burada; eşleşmeyen ad olduğu gibi kalır
// (uydurma kısaltma ÜRETİLMEZ). Tam ad erişilebilirlik için korunur (ArticleCard `sourceShort`:
// title + sr-only). Portal etkilenmez (prop yalnız landing'den geçer).
const SHORT: Record<string, string> = {
  "the new england journal of medicine": "NEJM",
  "new england journal of medicine": "NEJM",
  "jama": "JAMA",
  "jama : the journal of the american medical association": "JAMA",
  "the lancet": "The Lancet",
  "lancet (london, england)": "The Lancet",
  "bmj (clinical research ed.)": "BMJ",
  "the bmj": "BMJ",
  "annals of internal medicine": "Ann Intern Med",
  "european heart journal": "Eur Heart J",
  "journal of the american college of cardiology": "JACC",
  "circulation": "Circulation",
  "nature medicine": "Nat Med",
  "plos medicine": "PLoS Med",
  "journal of clinical oncology": "JCO",
  "the lancet oncology": "Lancet Oncol",
};

export function journalShort(name: string): string | null {
  const key = name.trim().toLocaleLowerCase("en-US");
  return SHORT[key] ?? null;
}
