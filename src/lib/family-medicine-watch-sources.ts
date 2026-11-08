/** Public publisher indexes, not clinical protocols or automatically approved legal rules.
 * Verified by direct HTTPS GET on 2026-11-08. Changes enter the existing persisted
 * source-review queue; no event dates, legal conclusions or clinical guidance are published.
 */
export interface FamilyMedicineWatchSource {
  id: string;
  url: string;
  title: string;
  expectedTerms: readonly string[];
  expectedContentType: "html";
}

export const HSGM_FAMILY_MEDICINE_LEGISLATION_URL = "https://hsgm.saglik.gov.tr/tr/mevzuat.html";
export const FAMILY_MEDICINE_WATCH_SOURCES: readonly FamilyMedicineWatchSource[] = [
  { id: "tahud-news", url: "https://tahud.org.tr/haberler", title: "TAHUD haber ve duyuruları", expectedTerms: ["tahud", "haber"], expectedContentType: "html" },
  { id: "tahud-events", url: "https://tahud.org.tr/etkinlikler", title: "TAHUD etkinlik ve kongreleri", expectedTerms: ["tahud", "etkinlik", "kongre"], expectedContentType: "html" },
  { id: "ahef-news", url: "https://www.ahef.org.tr/Haberler/6/Tum_Haberler.aspx", title: "AHEF haber ve duyuruları", expectedTerms: ["ahef", "haberler"], expectedContentType: "html" },
  { id: "ahef-events", url: "https://www.ahef.org.tr/Etkinlikler/46/Kongreler.aspx", title: "AHEF kongre duyuruları", expectedTerms: ["ahef", "kongreler"], expectedContentType: "html" },
  { id: "titck-announcements", url: "https://www.titck.gov.tr/duyuru", title: "TİTCK resmî duyuruları", expectedTerms: ["duyuru", "ilac", "cihaz"], expectedContentType: "html" },
  { id: "titck-recalls", url: "https://www.titck.gov.tr/duyuru?aramaTipi=geriCekme", title: "TİTCK geri çekme ve blokaj duyuruları", expectedTerms: ["duyuru", "geri cekme"], expectedContentType: "html" },
  { id: "hsgm-family-legislation", url: HSGM_FAMILY_MEDICINE_LEGISLATION_URL, title: "HSGM aile hekimliği mevzuat dizini", expectedTerms: ["mevzuat", "aile hekimligi"], expectedContentType: "html" },
  { id: "sgk-gss-announcements", url: "https://www.sgk.gov.tr/duyuru/index/GENEL-SAGLIK-SIGORTASI-GENEL-MUDURLUGU-2026-01-28-02-00-42", title: "SGK GSS ve SUT duyuruları", expectedTerms: ["duyurular", "sosyal"], expectedContentType: "html" },
];

const normalize = (text: string) => text.toLocaleLowerCase("tr-TR").replace(/ı/g, "i").normalize("NFKD").replace(/\p{M}/gu, "");
const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Read a JSON array literal without executing any remote JavaScript. Brackets inside
 * quoted strings are not delimiters. Missing/truncated data fails closed. */
function publicationsJson(html: string): unknown {
  const markers = [...html.matchAll(/\bconst\s+publications\s*=\s*(?=\[)/g)];
  if (markers.length !== 1) throw new Error("family-medicine-watch-missing-catalog");
  const start = markers[0].index! + markers[0][0].length;
  let depth = 0, inString = false, escaped = false;
  for (let i = start; i < html.length; i++) {
    const char = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
    } else if (char === '"') inString = true;
    else if (char === "[") depth++;
    else if (char === "]" && --depth === 0) {
      try { return JSON.parse(html.slice(start, i + 1)); }
      catch { throw new Error("family-medicine-watch-invalid-catalog"); }
    }
  }
  throw new Error("family-medicine-watch-truncated-catalog");
}

export interface FamilyMedicineLegislationListing {
  id: number;
  title: string;
  url: string;
  category: string;
  /** Publisher catalog timestamp, NOT an effective date or reviewed legal version. */
  catalogCreatedAt: string;
  tags: string[];
}

/** Only public metadata is retained in the canonical signature. Linked documents are
 * not fetched, stored as source text, or treated as approved evidence. */
export function parseHsgmFamilyMedicineLegislation(html: string): FamilyMedicineLegislationListing[] {
  const rows = publicationsJson(html);
  if (!Array.isArray(rows) || !rows.length || rows.length > 5000) throw new Error("family-medicine-watch-invalid-catalog");
  const records: FamilyMedicineLegislationListing[] = [];
  const seen = new Set<number>();
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") throw new Error("family-medicine-watch-invalid-record");
    const row = raw as Record<string, unknown>;
    if (!Number.isSafeInteger(row.id) || Number(row.id) < 1 || seen.has(Number(row.id)) ||
      typeof row.title !== "string" || !row.title.trim() || row.title.length > 1500 ||
      typeof row.url !== "string" || row.url.length > 2500 ||
      typeof row.category !== "string" || row.category.length > 500 ||
      typeof row.created !== "string" || row.created.length > 100 || !Array.isArray(row.tags) || row.tags.length > 50 ||
      row.tags.some(t => !t || typeof t !== "object" || typeof t.title !== "string" || t.title.length > 500)) {
      throw new Error("family-medicine-watch-invalid-record");
    }
    seen.add(Number(row.id));
    const tags = row.tags.map(t => (t as { title: string }).title.trim()).sort();
    if (!normalize([row.title, ...tags].join(" ")).includes("aile hekim")) continue;
    let url: URL;
    try { url = new URL(row.url); } catch { throw new Error("family-medicine-watch-invalid-link"); }
    if (url.protocol !== "https:" || url.username || url.password || url.port ||
      !["hsgm.saglik.gov.tr", "www.mevzuat.gov.tr", "mevzuat.gov.tr", "www.resmigazete.gov.tr"].includes(url.hostname)) {
      throw new Error("family-medicine-watch-invalid-link");
    }
    records.push({ id: Number(row.id), title: row.title.trim(), url: url.href, category: row.category,
      catalogCreatedAt: row.created, tags });
  }
  if (!records.length) throw new Error("family-medicine-watch-empty-family-catalog");
  return records.sort((a, b) => a.id - b.id);
}

/** Source-specific normalization, used before both hashing and page identity checks.
 * Preserve dates, titles and URLs. Strip only AHEF's observed view/visitor counters,
 * never all numbers. HSGM's listing is embedded JSON, so normal script removal would
 * silently discard every actual legislation change. */
export function prepareFamilyMedicineWatchHtml(url: string, html: string): string {
  if (url === HSGM_FAMILY_MEDICINE_LEGISLATION_URL) {
    const rows = parseHsgmFamilyMedicineLegislation(html);
    const prepared = `<html><title>HSGM aile hekimliği mevzuat dizini</title><main>${escapeHtml(JSON.stringify(rows))}</main></html>`;
    if (new TextEncoder().encode(prepared).length > 2 * 1024 * 1024) throw new Error("family-medicine-watch-catalog-too-large");
    return prepared;
  }
  const source = FAMILY_MEDICINE_WATCH_SOURCES.find(s => s.url === url);
  if (source?.id.startsWith("ahef-")) {
    return html.replace(/(Görüntülenme Adedi:\s*(?:<[^>]+>\s*)*)[\d.,]+/gi, "$1[sayac]")
      .replace(/(Sayfamız,\s*(?:<[^>]+>\s*)*)[\d.,]+(\s*(?:<[^>]+>\s*)*kere Ziyaret edilmiştir\.)/gi, "$1[sayac]$2");
  }
  return html;
}
