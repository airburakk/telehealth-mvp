// İçerik takvimi — "Karar masası": Yargıtay kararı AYRIŞTIRICI + ADAY SEÇİCİ + TASLAK ÜRETİCİ (v6.328, 2026-10-06). SAF: DB/ağ yok.
//
// 👤 Karar (2026-10-06): sistem aday ve taslak üretir, "Doktor için çıkarım"ı İNSAN yazar. Bu dosya o iş bölümünün sistem yarısıdır.
// Girdi `NewsArticle` (category "ictihat", source "yargitay") satırıdır: başlık "Yargıtay {daire} · E. …, K. …", `summary` = karar metni
// (DB'de ≤ 20.000 karakter; kesilmişse KARAR bölümü yoktur → aday olmaz).
//
// İlkeler:
//  • DETERMİNİSTİK — AI yok (içtihat kartlarıyla aynı ilke, hukuk-keywords.ts başlığı). Kendi cümlemiz yalnız metaveri ve sabit tanımlardan çıkar.
//  • BİREBİR ALINTI — uyuşmazlık + gerekçe slaytı karar metninden aynen alınır (`quote:true`); onay kapısı bunu yeniden kanıtlar (gates.ts).
//  • TUTUCU ELEME — iskeleti/sonucu/uyuşmazlık cümlesi net olmayan, alıntısında kimlik şüphesi olan karar ADAY OLMAZ (sessizce elenir, nedeni sayılır).
//  • "kim kazandı" iddiası YOK — yalnız usul sonucu (onama/bozma/düzelterek onama) ve tanımı yazılır.
//
// Gerçek metin gözlemleri (DEV, 2026-10-06; 246 karar): modern iskelet %62 — `V. TEMYİZ` → `A. Temyiz Sebepleri` → `B. <gerekçe>` → `VI. KARAR`;
// B başlığı üç adla gelir (Değerlendirme ve Gerekçe · Uyuşmazlık ve Hukuki Nitelendirme · Gerekçe ve Değerlendirme) → başlık ADINA değil
// "Temyiz Sebepleri'nden sonraki harf başlığı"na bağlanır. Üstbilgi: `MAHKEMESİ : …` / `İLK DERECE MAHKEMESİ : …` + `SAYISI : … E., … K.`.
import { extractLawRefs } from "../hukuk-keywords";
import { scanIdentity, type IdentityHit } from "./identity";
import type { PlanPayload, Slide } from "./payload";
import { SLIDE_ROLE_LABEL } from "./series";
import { ELLIPSIS, cleanText, excerptParagraph, splitSentences, tl } from "./text";

// ── Tipler ────────────────────────────────────────────────────────────────────────────────────────────

export interface KararSource {
  id: string;
  externalId?: string | null;
  title: string;
  summary: string;
  publishedAt: Date | string;
}

export type KararOutcome = "onama" | "bozma" | "duzelterek-onama";

export const OUTCOME_LABEL: Record<KararOutcome, string> = {
  onama: "Karar onandı",
  bozma: "Karar bozuldu",
  "duzelterek-onama": "Karar düzeltilerek onandı",
};

/** Sonuç terimlerinin SABİT tanımı (yorum değil, usul tanımı) — okuyucu "onama/bozma" ne demek bilmeyebilir. */
const OUTCOME_EXPLAIN: Record<KararOutcome, string> = {
  onama: "Onama: Yargıtay, temyiz edilen kararı yerinde bulmuştur.",
  bozma: "Bozma: Yargıtay, temyiz edilen kararı hukuka aykırı bulmuş; dosya yeniden karar verilmek üzere geri gönderilmiştir.",
  "duzelterek-onama": "Düzelterek onama: Yargıtay, kararı bazı yönlerden düzeltmiş ve düzeltilmiş hâliyle onamıştır.",
};

export interface KararHeader {
  mahkeme: string | null;
  mahkemeSayisi: string | null;
  ilkDerece: string | null;
  ilkDereceSayisi: string | null;
}

export interface KararParts {
  daire: string | null;
  esas: string | null;
  karar: string | null;
  /** Karar günü gg.aa.yyyy (KARAR bölümünün son cümlesinden; yoksa publishedAt). */
  tarih: string | null;
  oy: "oy birliği" | "oy çokluğu" | null;
  header: KararHeader;
  /** TEMYİZ ve sonrasında KARAR başlığı bulundu. */
  modern: boolean;
  /** "Uyuşmazlık, … ilişkindir." cümlesi (birebir). */
  uyusmazlik: string | null;
  /** Gerekçe paragrafları (uyuşmazlık cümlesi çıkarılmış). */
  gerekce: string[];
  kararBolumu: string;
  /** "kismi" = hem bozma hem onama / "kısmen" — özetlenemez, aday olmaz. */
  outcome: KararOutcome | "kismi" | null;
}

// ── Ayrıştırma ───────────────────────────────────────────────────────────────────────────────────────

const RE_TITLE = /^Yargıtay\s+(.+?)\s+·\s+E\.\s*([\d/]+)\s*,\s*K\.\s*([\d/]+)/;
const RE_ROMAN_HEAD = /^\s*[IVXLC]+\.\s+\S/;
const RE_TEMYIZ = /^\s*(?:[IVXLC]+\.)?\s*TEMY[İI]Z\s*$/;
const RE_KARAR = /^\s*(?:[IVXLC]+\.)?\s*KARAR\s*$/;
const RE_LETTER = /^\s*([A-F])\.\s+(\S.{1,88}?)\s*$/;
const RE_HEADER_COURT = /^(?:["“”][İI]çtihat Metni["“”])?\s*([İI]LK DERECE\s+)?MAHKEMES[İI]\s*:\s*(.+)$/;
const RE_HEADER_NO = /^SAYISI\s*:\s*(.+)$/;
const RE_TARIH_OY = /(\d{2}\.\d{2}\.\d{4})\s+tarihinde\s+(oy\s+birliğiyle|oy\s+çokluğuyla)/;

const isHeading = (l: string): boolean => l.length <= 100 && (RE_LETTER.test(l) || RE_ROMAN_HEAD.test(l));

// Gerçek metin (DEV, 246 karar) gerekçe paragraflarında üç düzensizlik gösterdi:
//  • numaralı alt başlıklar ("1. Uyuşmazlık ve Hukuki Nitelendirme" · "2. İlgili Hukuk" · "3. Değerlendirme") — içerik değil, atılır;
//  • paragraf numaraları ("3. Tüm açıklamalar…" · "1.Tarafların…" · "b) Hükme esas…") — alıntıya sızmasın diye başından kırpılır
//    (kalan metin kaynağın BİREBİR alt dizgisi olduğundan alıntı doğrulaması bozulmaz; "31.08.2012" ve "1.000,00" gibi tarih/tutar KORUNUR);
//  • satır kırığı: cümle ortasında bölünmüş satır küçük harfle başlar ("uygun olduğu tespiti…") — önceki paragraf noktalamayla bitmiyorsa ona eklenir.
const RE_NUM_HEADING = /^\d{1,2}\.\s*\p{Lu}[^.!?;:]{2,58}$/u;
const RE_LEAD_NO = /^\s*(?:\d{1,2}\s*\.(?!\d)\s*|\d{1,2}\.\d{1,2}\.(?!\d)\s*|[a-zçğıöşü]\)\s+)/u;

export function cleanParagraphs(raw: string[]): string[] {
  const out: string[] = [];
  for (const line of raw) {
    if (RE_NUM_HEADING.test(line.trim())) continue;
    const p = line.replace(RE_LEAD_NO, "").trim();
    if (!p) continue;
    const prev = out[out.length - 1];
    if (prev !== undefined && /^\p{Ll}/u.test(p) && !/[.!?:;]["”')\]]*$/.test(prev)) out[out.length - 1] = `${prev} ${p}`;
    else out.push(p);
  }
  return out;
}

/** UTC gün → gg.aa.yyyy (karar günü "T00:00:00Z" olarak saklanır; yerel saat dilimi kaydırmasın). */
export function trTarih(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
}

function parseHeader(lines: string[], upto: number): KararHeader {
  const h: KararHeader = { mahkeme: null, mahkemeSayisi: null, ilkDerece: null, ilkDereceSayisi: null };
  let last: "m" | "i" | null = null;
  for (const raw of lines.slice(0, upto)) {
    const line = raw.trim();
    const c = RE_HEADER_COURT.exec(line);
    if (c) {
      const val = (c[2] ?? "").trim();
      if (c[1]) {
        h.ilkDerece = val;
        last = "i";
      } else {
        h.mahkeme = val;
        last = "m";
      }
      continue;
    }
    const n = RE_HEADER_NO.exec(line);
    if (n && last) {
      if (last === "i") h.ilkDereceSayisi = (n[1] ?? "").trim();
      else h.mahkemeSayisi = (n[1] ?? "").trim();
      last = null;
    }
  }
  return h;
}

/** TEMYİZ gövdesinden gerekçe satırları: "Temyiz Sebepleri" harf başlığından SONRAKİ gerekçe/değerlendirme başlığının altı. */
function reasoningLines(body: string[]): string[] {
  const heads: { i: number; title: string }[] = [];
  body.forEach((l, i) => {
    const m = RE_LETTER.exec(l);
    if (m) heads.push({ i, title: m[2] ?? "" });
  });
  const rest = heads.filter((h) => !/^temyiz\s+sebep/.test(tl(h.title)));
  const named = [...rest].reverse().find((h) => /gerekçe|değerlendirme|nitelendirme|inceleme/.test(tl(h.title)));
  const pick = named ?? rest[0];
  return pick ? body.slice(pick.i + 1) : [];
}

function outcomeOf(kararBolumu: string): KararParts["outcome"] {
  const t = tl(kararBolumu);
  const duz = /düzeltilerek\s+onanmas[ıi]na/.test(t);
  const boz = /bozulmas[ıi]na/.test(t);
  const ona = /onanmas[ıi]na/.test(t);
  const kismen = /k[ıi]smen/.test(t);
  if (duz) return boz ? "kismi" : "duzelterek-onama";
  if (boz && (ona || kismen)) return "kismi";
  if (boz) return kismen ? "kismi" : "bozma";
  if (ona) return "onama";
  return null;
}

export function parseKarar(src: KararSource): KararParts {
  const lines = cleanText(src.summary).split("\n");
  const t = RE_TITLE.exec(src.title.trim());
  const iT = lines.findIndex((l) => RE_TEMYIZ.test(l));
  const iK = iT >= 0 ? lines.findIndex((l, i) => i > iT && RE_KARAR.test(l)) : -1;
  const modern = iT >= 0 && iK > iT;

  const firstRoman = lines.findIndex((l) => RE_ROMAN_HEAD.test(l));
  const header = parseHeader(lines, firstRoman >= 0 ? firstRoman : Math.min(lines.length, 12));

  const kararBolumu = modern ? lines.slice(iK + 1).join("\n").trim() : "";
  const paras = modern
    ? cleanParagraphs(
        reasoningLines(lines.slice(iT + 1, iK))
          .map((l) => l.trim())
          .filter((l) => l.length > 0 && !isHeading(l)),
      )
    : [];

  let uyusmazlik: string | null = null;
  const iU = paras.findIndex((p) => /^uyuşmazlık[\s,]/.test(tl(p)));
  if (iU >= 0) {
    const sents = splitSentences(paras[iU] ?? "");
    const first = (sents[0] ?? "").trim();
    if (first.length >= 40 && first.length <= 520 && tl(first).includes("ilişkin")) {
      uyusmazlik = first;
      const remainder = sents.slice(1).join(" ").trim();
      if (remainder) paras.splice(iU, 1, remainder);
      else paras.splice(iU, 1);
    }
  }

  const to = RE_TARIH_OY.exec(tl(kararBolumu)); // küçük harfe katlanmış metinde ara: "OY BİRLİĞİYLE" biçimi de yakalansın
  const pub = typeof src.publishedAt === "string" ? new Date(src.publishedAt) : src.publishedAt;
  const tarih = to?.[1] ?? (Number.isNaN(pub.getTime()) ? null : trTarih(pub));
  const oyRaw = (to?.[2] ?? "").replace(/\s+/g, " ");
  const oy = oyRaw.startsWith("oy birliğ") ? "oy birliği" : oyRaw.startsWith("oy çokluğ") ? "oy çokluğu" : null;

  return {
    daire: t?.[1]?.trim() ?? null,
    esas: t?.[2] ?? null,
    karar: t?.[3] ?? null,
    tarih,
    oy,
    header,
    modern,
    uyusmazlik,
    gerekce: paras,
    kararBolumu,
    outcome: modern ? outcomeOf(kararBolumu) : null,
  };
}

// ── Temalar ───────────────────────────────────────────────────────────────────────────────────────────

export interface ThemeDef {
  key: string;
  label: string;
  /** Kapak başlığı (kendi metnimiz; tarafsız, "kim kazandı" iddiası yok). */
  headline: string;
  hashtag?: string;
  /** Küçük harf (tr-TR katlanmış metinde aranır). */
  patterns: string[];
  /** Her kararda geçen terimlerin (bilirkişi, vekalet sözleşmesi) ağırlığı düşük tutulur — tema ayırt edici olmalı. */
  weight?: number;
}

export const THEMES: readonly ThemeDef[] = [
  { key: "aydinlatilmis-onam", label: "Aydınlatılmış onam", headline: "Aydınlatılmış onam Yargıtay önünde", hashtag: "#AydınlatılmışOnam", patterns: ["aydınlatılmış onam", "aydınlatma yükümlülüğü", "aydınlatılmış rıza", "onam formu", "onam belgesi", "aydınlatılmadığı"] },
  { key: "komplikasyon", label: "Komplikasyon", headline: "Komplikasyon mu, özen kusuru mu?", hashtag: "#Komplikasyon", patterns: ["komplikasyon"] },
  { key: "organizasyon", label: "Hastane sorumluluğu", headline: "Hastanenin organizasyon sorumluluğu", patterns: ["organizasyon hata", "organizasyon kusur", "hizmet kusuru", "hizmet kusurunun", "birlikte sorumlu"] },
  { key: "ozen-borcu", label: "Özen borcu", headline: "Doktorun özen borcu", hashtag: "#ÖzenBorcu", weight: 0.6, patterns: ["özen borcu", "özen yükümlülüğü", "vekalet sözleşmesi", "vekâlet sözleşmesi", "gereken özen"] },
  { key: "bilirkisi", label: "Bilirkişi raporu", headline: "Bilirkişi raporu ve Yargıtay denetimi", hashtag: "#Bilirkişi", weight: 0.4, patterns: ["bilirkişi", "adli tıp kurumu", "ihtisas kurulu", "yüksek sağlık şurası"] },
  { key: "estetik", label: "Estetik müdahale", headline: "Estetik müdahalede sorumluluk", hashtag: "#EstetikCerrahi", patterns: ["estetik", "rinoplasti", "liposuction", "meme büyütme"] },
  { key: "tup-bebek", label: "Tüp bebek tedavisi", headline: "Tüp bebek tedavisinde sorumluluk", hashtag: "#TüpBebek", patterns: ["tüp bebek", "embriyo", "in vitro", "aşılama"] },
  { key: "dogum", label: "Doğum ve gebelik", headline: "Doğum ve gebelik süreçlerinde sorumluluk", hashtag: "#DoğumHukuku", patterns: ["gebelik", "sezaryen", "doğum eylemi", "yenidoğan", "normal doğum", "doğumhane"] },
  { key: "enfeksiyon", label: "Enfeksiyon", headline: "Enfeksiyon ve sorumluluk", patterns: ["enfeksiyon", "hastane enfeksiyonu", "sepsis"] },
  { key: "eser-sozlesmesi", label: "Eser sözleşmesi", headline: "Eser sözleşmesi ve tıbbi müdahale", patterns: ["eser sözleşmesi", "sonuç borcu"] },
  { key: "destekten-yoksun", label: "Destekten yoksun kalma", headline: "Destekten yoksun kalma tazminatı", patterns: ["destekten yoksun"] },
  { key: "dis", label: "Diş tedavisi", headline: "Diş tedavisinde sorumluluk", hashtag: "#DişHukuku", patterns: ["diş hekim", "diş tedavi", "implant", "kanal tedavi", "dişin"] },
];

const GENEL_THEME = { key: "genel", label: "Sağlık hukuku", headline: "Sağlık hukukunda Yargıtay kararı" } as const;

function countHits(hay: string, needle: string): number {
  let n = 0;
  for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + needle.length)) n++;
  return n;
}

interface ThemeScore {
  key: string;
  label: string;
  headline: string;
  hashtag?: string;
  score: number;
}

/** Uyuşmazlık cümlesi ×3 · gerekçe ×1 · geri kalan ×0.4 ağırlıkla tema puanları (yüksekten alçağa). */
function scoreThemes(parts: KararParts, rest: string): ThemeScore[] {
  const u = tl(parts.uyusmazlik ?? "");
  const g = tl(parts.gerekce.join(" "));
  const r = tl(rest);
  return THEMES.map((th) => {
    let s = 0;
    for (const p of th.patterns) s += 3 * countHits(u, p) + countHits(g, p) + 0.4 * countHits(r, p);
    return { key: th.key, label: th.label, headline: th.headline, hashtag: th.hashtag, score: s * (th.weight ?? 1) };
  }).sort((a, b) => b.score - a.score);
}

// ── Gerekçe alıntısı seçimi ──────────────────────────────────────────────────────────────────────────

export const GEREKCE_MAX = 780;
const CONCLUSION = /onanmas[ıi]na karar verilmiştir|bozmay[ıi] gerektirmiştir|bozulmas[ıi] gerek|temyiz itirazlar[ıi]n[ıi]n reddi|usul ve (?:yasaya|kanuna) uygun/;

/** Doktrin atfı ("… 22. Baskı, Ankara 2017, s. 594)") — ana alıntı olarak uygun değil (kaynak künyesi, mahkemenin kendi değerlendirmesi değil). */
const isDoctrine = (p: string): boolean => /Baskı|\bs\.\s*\d{1,4}\)/.test(p);
/** Uzun bilirkişi raporu aktarımı — ana alıntı olarak uygun değil. */
const isReportQuote = (p: string): boolean => p.length > 1100 && /["“”]/.test(p);

/**
 * Olgu yoğunluğu: tıbbi/hukuki özün (rapor, kusur, illiyet, aydınlatma, komplikasyon…) 100 karakterdeki geçiş sayısı. Genel hukuk anlatımı ("zarar
 * kavramı…") ve usul kalıpları düşük çıkar; somut olayı değerlendiren paragraf yükselir. Arama deseni sözlüğüdür (karar METNİNDE aranır) —
 * "hekim" burada veridir, kendi metnimiz değil (CLAUDE.md terim kuralı istisnası).
 */
const OLGU_KOKLERI = ["rapor", "bilirkişi", "kusur", "illiyet", "özen", "aydınlat", "onam", "komplikasyon", "tedavi", "ameliyat", "tıbbi", "endikasyon", "teşhis", "enfeksiyon", "hasta", "doktor", "hekim", "müdahale"];
function olguYogunlugu(p: string): number {
  const t = tl(p);
  let n = 0;
  for (const k of OLGU_KOKLERI) n += countHits(t, k);
  return (n / Math.max(200, p.length)) * 100;
}

/** Kenar düzeltmesi: cümle ortasından başlıyorsa baştaki, noktalamasız bitiyorsa sondaki eksik metin "[…]" ile işaretlenir (dürüst alıntı). */
function kenarDuzelt(t: string): string {
  let s = t;
  if (/^\p{Ll}/u.test(s)) s = `${ELLIPSIS} ${s}`;
  if (!/[.!?]["”')\]]*$/.test(s.trimEnd()) && !s.endsWith(ELLIPSIS)) s = `${s} ${ELLIPSIS}`;
  return s;
}

const sonCumle = (p: string): string => splitSentences(p).at(-1)?.trim() ?? "";

/**
 * Aday gerekçe kesitleri (en iyiden), TEKRARSIZ, en çok 5. Sıra: (1) olgu yoğunluğu en yüksek paragraf — hüküm cümlesi sığıyorsa altına eklenir,
 * (2) hüküm paragrafının kendisi, (3) olgu yoğunluğuna göre sonrakiler. Hepsi paragrafın BİREBİR (başı…sonu) kesitidir.
 * Tek sezgi (yalnız "hüküm cümlesi taşıyan paragraf") çok başlıklı kararlarda alakasız paragrafa düşüyordu → editöre alternatif sunulur (`meta.gerekceAlts`).
 */
export function gerekceOptions(paras: string[]): string[] {
  const usable = paras.map((p, i) => ({ p, i })).filter(({ p }) => p.length >= 80 && !isDoctrine(p) && !isReportQuote(p));
  let conclIdx = -1;
  paras.forEach((p, i) => { if (CONCLUSION.test(tl(p))) conclIdx = i; });
  const byDensity = [...usable].sort((a, b) => olguYogunlugu(b.p) - olguYogunlugu(a.p) || b.i - a.i);
  const order: { p: string; i: number }[] = [];
  const add = (x: { p: string; i: number } | undefined) => { if (x && !order.some((o) => o.i === x.i)) order.push(x); };
  add(byDensity[0]);
  add(usable.find((u) => u.i === conclIdx));
  for (const x of byDensity.slice(1)) add(x);

  const out: string[] = [];
  const push = (s: string) => { if (!out.includes(s)) out.push(s); };
  for (const { p, i } of order.slice(0, 5)) {
    const text = excerptParagraph(p, GEREKCE_MAX);
    const tail = conclIdx >= 0 && conclIdx !== i ? sonCumle(paras[conclIdx] ?? "") : "";
    // hüküm cümlesi (öteki paragraftan) sığıyorsa altına eklenir; kimlik sızıntısı olursa tarayıcı birleşiği eler, yalın hâli ARKADAN gelir
    if (tail && CONCLUSION.test(tl(tail)) && text.length + 2 + tail.length <= GEREKCE_MAX) push(`${kenarDuzelt(text)}\n\n${tail}`);
    push(kenarDuzelt(text));
  }
  return out.slice(0, 5);
}

export interface KararExcerpts {
  uyusmazlik: string;
  /** Birincil kesit (taslağa girer). */
  gerekce: string;
  /** Kimlik taramasından geçmiş TÜM kesitler (birincil dahil, en çok 4) — editör "Başka kesit"le gezer. */
  alts: string[];
}

function chooseExcerpts(parts: KararParts): { excerpts: KararExcerpts | null; hits: IdentityHit[] } {
  if (!parts.uyusmazlik) return { excerpts: null, hits: [] };
  const uHits = scanIdentity(parts.uyusmazlik);
  if (uHits.length) return { excerpts: null, hits: uHits };
  let lastHits: IdentityHit[] = [];
  const clean: string[] = [];
  for (const opt of gerekceOptions(parts.gerekce)) {
    const h = scanIdentity(opt);
    if (h.length === 0) clean.push(opt);
    else lastHits = h;
  }
  const alts = clean.slice(0, 4);
  const first = alts[0];
  if (first === undefined) return { excerpts: null, hits: lastHits };
  return { excerpts: { uyusmazlik: parts.uyusmazlik, gerekce: first, alts }, hits: [] };
}

// ── Analiz + aday seçimi ─────────────────────────────────────────────────────────────────────────────

export type RejectCode = "iskelet" | "dava-turu" | "sonuc" | "uyusmazlik" | "gerekce" | "kisa" | "kimlik";

export const REJECT_LABEL: Record<RejectCode, string> = {
  iskelet: "TEMYİZ/KARAR iskeleti yok (eski biçim ya da kesik metin)",
  "dava-turu": "hukuk dairesi kararı değil",
  sonuc: "sonuç net değil (onama/bozma/düzelterek onama bulunamadı ya da kısmi)",
  uyusmazlik: "“Uyuşmazlık, … ilişkindir.” cümlesi yok",
  gerekce: "alıntılanabilir gerekçe yok",
  kisa: "karar metni çok kısa",
  kimlik: "alıntıda kimlik şüphesi",
};

export interface PickContext {
  /** Son yayınlanan/onaylanan kararların tema anahtarları (en yeni başta) — tekrar eden tema cezalandırılır. */
  recentThemes: string[];
  recentOutcomes: string[];
}

export const EMPTY_CONTEXT: PickContext = { recentThemes: [], recentOutcomes: [] };

export interface KararAnalysis {
  parts: KararParts;
  eligible: boolean;
  why: RejectCode[];
  themeKey: string;
  themeLabel: string;
  themeHeadline: string;
  themeHashtag?: string;
  themes: string[];
  lawRefs: string[];
  score: number;
  reasons: string[];
  excerpts: KararExcerpts | null;
  identityHits: IdentityHit[];
}

const MIN_TOTAL = 3000;
const MIN_GEREKCE = 200;
const MIN_THEME_SCORE = 2;

export function analyzeKarar(src: KararSource, ctx: PickContext = EMPTY_CONTEXT, now: Date = new Date()): KararAnalysis {
  const parts = parseKarar(src);
  const why: RejectCode[] = [];
  if (!parts.modern) why.push("iskelet");
  if (!tl(`${parts.daire ?? ""} ${src.title}`).includes("hukuk")) why.push("dava-turu");
  if (parts.modern && (parts.outcome === null || parts.outcome === "kismi")) why.push("sonuc");
  if (parts.modern && !parts.uyusmazlik) why.push("uyusmazlik");
  if (parts.modern && parts.uyusmazlik && parts.gerekce.join(" ").length < MIN_GEREKCE) why.push("gerekce");
  if (src.summary.length < MIN_TOTAL) why.push("kisa");

  let excerpts: KararExcerpts | null = null;
  let identityHits: IdentityHit[] = [];
  if (why.length === 0) {
    const r = chooseExcerpts(parts);
    excerpts = r.excerpts;
    identityHits = r.hits;
    if (!excerpts) why.push(identityHits.length ? "kimlik" : "gerekce");
  }

  const gerekceText = parts.gerekce.join(" ");
  const ranked = scoreThemes(parts, src.summary);
  const top = ranked[0];
  const theme = top && top.score >= MIN_THEME_SCORE ? top : { ...GENEL_THEME, hashtag: undefined, score: 0 };
  const themes = ranked.filter((t) => t.score >= MIN_THEME_SCORE).slice(0, 3).map((t) => t.key);
  const lawRefs = extractLawRefs(`${gerekceText} ${parts.kararBolumu}`, 3);

  // puan (açıklanabilir: her kalem `reasons`a yazılır, ekranda adayın yanında görünür)
  let score = 0;
  const reasons: string[] = [];
  const pub = typeof src.publishedAt === "string" ? new Date(src.publishedAt) : src.publishedAt;
  const days = Number.isNaN(pub.getTime()) ? Infinity : (now.getTime() - pub.getTime()) / 86_400_000;
  if (days <= 30) { score += 4; reasons.push("son 30 gün içinde karara bağlanmış"); }
  else if (days <= 90) { score += 3; reasons.push("son 3 ay içinde karara bağlanmış"); }
  else if (days <= 180) { score += 2; reasons.push("son 6 ay içinde karara bağlanmış"); }
  else if (days <= 365) { score += 1; reasons.push("son 1 yıl içinde karara bağlanmış"); }
  if (gerekceText.length >= 1200) { score += 2; reasons.push("gerekçesi ayrıntılı"); }
  else if (gerekceText.length >= 600) { score += 1; reasons.push("gerekçesi yeterli uzunlukta"); }
  if (lawRefs.length > 0) { score += 1; reasons.push(`kanun atfı var (${lawRefs.slice(0, 2).join(", ")})`); }
  if (theme.key === "genel") { score -= 1; reasons.push("belirgin bir tema yok"); }
  else if (ctx.recentThemes.slice(0, 3).includes(theme.key)) { score -= 4; reasons.push(`“${theme.label}” teması yakın zamanda işlendi (−4)`); }
  else reasons.push(`tema: ${theme.label}`);
  if (parts.outcome && parts.outcome !== "kismi" && ctx.recentOutcomes[0] === parts.outcome) { score -= 1; reasons.push("son kararla aynı sonuç türü (−1)"); }

  return {
    parts,
    eligible: why.length === 0,
    why,
    themeKey: theme.key,
    themeLabel: theme.label,
    themeHeadline: theme.headline,
    themeHashtag: theme.hashtag,
    themes,
    lawRefs,
    score,
    reasons,
    excerpts,
    identityHits,
  };
}

export interface KararCandidate {
  id: string;
  externalId: string | null;
  title: string;
  daire: string;
  esas: string;
  karar: string;
  tarih: string;
  themeKey: string;
  themeLabel: string;
  outcome: KararOutcome;
  outcomeLabel: string;
  score: number;
  reasons: string[];
  uyusmazlik: string;
  /** Gerekçe alıntısının başı (ekranda önizleme). */
  preview: string;
}

export interface PickResult {
  candidates: KararCandidate[];
  stats: { total: number; eligible: number; rejected: Partial<Record<RejectCode, number>> };
}

/** Havuzdan en iyi `limit` adayı seçer: puana göre, mümkünse farklı temalardan. `sources` kullanılmış kararları İÇERMEMELİ (servis eler). */
export function pickKararCandidates(sources: KararSource[], ctx: PickContext = EMPTY_CONTEXT, now: Date = new Date(), limit = 3): PickResult {
  const rejected: PickResult["stats"]["rejected"] = {};
  const ok: { src: KararSource; a: KararAnalysis }[] = [];
  for (const src of sources) {
    const a = analyzeKarar(src, ctx, now);
    if (a.eligible && a.excerpts && a.parts.outcome && a.parts.outcome !== "kismi") ok.push({ src, a });
    else for (const code of a.why) rejected[code] = (rejected[code] ?? 0) + 1;
  }
  const time = (s: KararSource) => (typeof s.publishedAt === "string" ? new Date(s.publishedAt) : s.publishedAt).getTime();
  ok.sort((x, y) => y.a.score - x.a.score || time(y.src) - time(x.src) || x.src.id.localeCompare(y.src.id));

  const picked: typeof ok = [];
  for (const c of ok) {
    if (picked.length >= limit) break;
    if (c.a.themeKey === "genel" || !picked.some((p) => p.a.themeKey === c.a.themeKey)) picked.push(c);
  }
  for (const c of ok) {
    if (picked.length >= limit) break;
    if (!picked.includes(c)) picked.push(c);
  }

  const candidates: KararCandidate[] = picked.map(({ src, a }) => {
    const outcome = a.parts.outcome as KararOutcome;
    return {
      id: src.id,
      externalId: src.externalId ?? null,
      title: src.title,
      daire: a.parts.daire ?? "",
      esas: a.parts.esas ?? "",
      karar: a.parts.karar ?? "",
      tarih: a.parts.tarih ?? "",
      themeKey: a.themeKey,
      themeLabel: a.themeLabel,
      outcome,
      outcomeLabel: OUTCOME_LABEL[outcome],
      score: a.score,
      reasons: a.reasons,
      uyusmazlik: a.excerpts?.uyusmazlik ?? "",
      preview: (a.excerpts?.gerekce ?? "").replace(/\s+/g, " ").slice(0, 220),
    };
  });
  return { candidates, stats: { total: sources.length, eligible: ok.length, rejected } };
}

// ── Taslak üretici ────────────────────────────────────────────────────────────────────────────────────

/** Mahkeme adındaki anonimleştirme yer tutucusunu ("... Bölge Adliye Mahkemesi" → şehir adı) atar: halka açık kartta özensiz durur, anlam kaybı yok. */
const cleanCourt = (s: string): string => s.replace(/\.{3}\s*/g, "").replace(/\s+/g, " ").trim();

function courtChain(parts: KararParts): string[] {
  const h = parts.header;
  const no = (s: string | null) => (s ? ` · ${s}` : "");
  const out: string[] = [];
  const ilk = h.ilkDerece ? cleanCourt(h.ilkDerece) : "";
  const mah = h.mahkeme ? cleanCourt(h.mahkeme) : "";
  if (ilk) out.push(`İlk derece: ${ilk}${no(h.ilkDereceSayisi)}`);
  if (mah) out.push(`${tl(mah).includes("bölge adliye") ? "İstinaf" : "Mahkeme"}: ${mah}${no(h.mahkemeSayisi)}`);
  if (parts.daire) out.push(`Temyiz: Yargıtay ${parts.daire}${parts.esas ? ` · E. ${parts.esas}, K. ${parts.karar ?? ""}` : ""}`);
  return out;
}

/**
 * Seçilen karardan 7 slaytlık taslak. Uygun değilse (iskelet/sonuç/alıntı/kimlik) null.
 * Slayt metinleri: uyuşmazlık + gerekçe = BİREBİR ALINTI (`quote`); kapak/mahkeme/sonuç/kaynak = metaveriden türeyen kendi metnimiz;
 * "Doktor için çıkarım" BOŞ bırakılır (insan yazar). Tüm slaytlar `auto` — editör dokununca bayrak düşer.
 */
export function buildKararDraft(src: KararSource, now: Date = new Date()): PlanPayload | null {
  const a = analyzeKarar(src, EMPTY_CONTEXT, now);
  const p = a.parts;
  if (!a.eligible || !a.excerpts || !p.outcome || p.outcome === "kismi" || !p.daire || !p.esas || !p.karar || !p.tarih) return null;
  const outcome = p.outcome;
  const dosya = `Yargıtay ${p.daire} · E. ${p.esas}, K. ${p.karar}`;

  const slides: Slide[] = [
    { role: "kapak", title: a.themeHeadline, body: `${dosya} · ${p.tarih}`, auto: true },
    { role: "uyusmazlik", title: SLIDE_ROLE_LABEL.uyusmazlik, body: a.excerpts.uyusmazlik, quote: true, auto: true },
    { role: "mahkeme", title: SLIDE_ROLE_LABEL.mahkeme, body: "", bullets: courtChain(p), auto: true },
    { role: "gerekce", title: SLIDE_ROLE_LABEL.gerekce, body: a.excerpts.gerekce, quote: true, auto: true },
    { role: "sonuc", title: OUTCOME_LABEL[outcome], body: `${OUTCOME_EXPLAIN[outcome]}\n\nKarar tarihi: ${p.tarih}${p.oy ? ` · ${p.oy}` : ""}`, auto: true },
    { role: "cikarim", title: SLIDE_ROLE_LABEL.cikarim, body: "", bullets: [], auto: true },
    {
      role: "kaynak",
      title: SLIDE_ROLE_LABEL.kaynak,
      body: `Kaynak: ${dosya}, T. ${p.tarih}. Uyuşmazlık ve gerekçe slaytları karar metninden aynen alınmıştır.\n\nBu içerik bilgilendirme amaçlıdır; hukuki görüş değildir.`,
      auto: true,
    },
  ];

  const caption =
    `⚖️ Karar masası · ${a.themeHeadline}\n\n` +
    `${dosya} sayılı karar: uyuşmazlık, dosyanın izlediği yol, Yargıtay'ın gerekçesi ve sonuç kaydırmalı görsellerde. Alıntılar karar metninden aynen alınmıştır.\n\n` +
    `Bu içerik bilgilendirme amaçlıdır; hukuki görüş değildir.`;

  const hashtags = ["#KararMasası", "#SağlıkHukuku", "#Yargıtay", a.themeHashtag, "#Doctorium"].filter((h): h is string => !!h).slice(0, 5);

  return {
    v: 1,
    slides,
    caption,
    hashtags,
    sources: [{ label: `Yargıtay ${p.daire}`, ref: `E. ${p.esas}, K. ${p.karar}, T. ${p.tarih}` }],
    meta: {
      court: "Yargıtay",
      daire: p.daire,
      esas: p.esas,
      karar: p.karar,
      tarih: p.tarih,
      theme: a.themeKey,
      themeLabel: a.themeLabel,
      themes: a.themes,
      sonuc: outcome,
      // alternatif gerekçe kesitleri (birincil dahil): editör "Başka kesit"le gezer; hash'e GİRMEZ (yalnız gövde girer)
      ...(a.excerpts.alts.length > 1 ? { gerekceAlts: a.excerpts.alts } : {}),
    },
  };
}
