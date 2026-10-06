// İçerik takvimi — metin yardımcıları (v6.328, 2026-10-06). SAF: DB/ağ/ortam yok; birim testte doğrudan koşar.
//
// Üç ihtiyaç: (1) kaynak metindeki garip boşlukları/görünmez karakterleri temizlemek (gerçek Yargıtay metninde ` ` var),
// (2) BİREBİR ALINTI doğrulaması (kapak/çıkarım/kaynak kendi metnimiz; uyuşmazlık/gerekçe slaytı karar metninden aynen — kapı bunu kanıtlar),
// (3) cümle bölme (Türkçe hukuk metninde "Dr." · "3. Hukuk" · "md." gibi nokta tuzakları).
// Alıntıda "[…]" (hukuk yazımındaki "atlanan metin" işareti) PARÇA AYIRICIDIR: baş + son cümle gibi kesintili alıntılar parça parça doğrulanır.
// Düz "…" (U+2026) ve boş satır da ayırıcıdır. Üç nokta "..." ayırıcı DEĞİL — karar metninde anonimleştirme yer tutucusudur ("...'in"),
// olduğu gibi kalır; bu yüzden atlama işareti kasıtlı olarak ona BENZEMEYEN "[…]"dır.

const INVISIBLE = /[­​-‍⁠﻿]/g;
const ODD_SPACES = /[   -   　]/g;

/** Alıntıda atlanan metnin işareti. Üretici bunu yazar; doğrulayıcı bunu parça ayırıcı sayar. */
export const ELLIPSIS = "[…]";

/** Türkçe küçük harf (İ→i, I→ı doğru katlanır). Büyük/küçük harf duyarsız karşılaştırmanın TEK yolu. */
export const tl = (s: string): string => s.toLocaleLowerCase("tr-TR");

/** Yazım/karşılaştırma için güvenli temizlik: görünmez karakterleri at, alışılmadık boşlukları tek boşluğa indir, satır sonlarını \n yap. */
export function cleanText(s: string): string {
  return s.normalize("NFC").replace(INVISIBLE, "").replace(ODD_SPACES, " ").replace(/\r\n?/g, "\n");
}

/**
 * Birebir alıntı doğrulaması için normalize: tırnak/kesme/tire varyantlarını eşitler, boşlukları tek boşluğa indirir.
 * Büyük/küçük harf KORUNUR (alıntı aynen olmalı); yalnız tipografi farkı affedilir.
 */
export function normText(s: string): string {
  return cleanText(s)
    .replace(/[‘’‚‛′`´]/g, "'")
    .replace(/[“”„‟″«»]/g, '"')
    .replace(/''/g, '"') // metinde ''...'' biçimli çift kesme tırnak olarak kullanılıyor
    .replace(/[–—‒―]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/** Alıntı gövdesini "[…]" / "…" ve boş satır (paragraf sınırı) ayırıcılarından parçalara böler (boş parçalar atılır, her parça normalize edilir). */
export function quoteFragments(body: string): string[] {
  return cleanText(body)
    .split(/\[…\]|…|\n\s*\n/)
    .map((f) => normText(f))
    .filter((f) => f.length > 0);
}

export interface QuoteCheck {
  ok: boolean;
  /** Kaynakta bulunamayan parçalar (ekranda gösterilir; en çok 3, 80 karaktere kısaltılmış). */
  missing: string[];
}

/** Gövdenin HER parçası kaynak metinde aynen (tipografi farkı hariç) geçiyor mu. */
export function verifyQuote(body: string, source: string): QuoteCheck {
  const frags = quoteFragments(body);
  if (frags.length === 0) return { ok: false, missing: ["(boş alıntı)"] };
  const src = normText(source);
  const missing = frags.filter((f) => !src.includes(f)).map((f) => (f.length > 80 ? `${f.slice(0, 79)}…` : f));
  return { ok: missing.length === 0, missing: missing.slice(0, 3) };
}

// ── Cümle bölme ─────────────────────────────────────────────────────────────────────────────────────────

// Noktadan sonra cümle BİTMEZ sayılan kısaltmalar (küçük harf). Tek harf ve 1–2 haneli sayılar (sıra/madde numarası) ayrıca elenir.
const ABBR = new Set([
  "dr", "prof", "doç", "yrd", "uzm", "op", "av", "sn", "no", "md", "m", "mad", "s", "vd", "vb", "bkz", "tl", "bşk", "mah", "cad", "sok", "apt",
  "nr", "örn", "krş", "hmk", "humk", "tck", "tbk", "bk", "cmk", "tmk", "tkhk", "ykd", "ytk", "ayk", "sy", "c", "cilt", "bs", "çev", "ed",
]);

/** Paragrafı cümlelere böler. Sonuç cümlelerinin birleşimi (boşlukla) paragrafı verir; metin DEĞİŞTİRİLMEZ, yalnız kesilir. */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  const re = /([.!?]+)(["”')\]]*)(\s+)/g;
  for (let m = re.exec(text); m !== null; m = re.exec(text)) {
    const before = text.slice(start, m.index);
    const lastTok = tl(/(\S+)$/.exec(before)?.[1] ?? "");
    const next = text.charAt(m.index + m[0].length);
    const nonTerminal = m[1] === "." && (ABBR.has(lastTok) || /^\d{1,2}$/.test(lastTok) || /^\p{L}$/u.test(lastTok));
    const upperNext = /[\p{Lu}\d"“'‘(]/u.test(next);
    if (nonTerminal || !upperNext) continue;
    out.push(text.slice(start, m.index + m[1].length + m[2].length).trim());
    start = m.index + m[0].length;
  }
  const tail = text.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}

/**
 * Uzun bir paragrafı ≤ `max` karakterlik BİREBİR alıntıya indirir.
 * Sığıyorsa aynen döner. Sığmıyorsa "baş ELLIPSIS son" biçimi: ilk cümle(ler) + ELLIPSIS + son cümle(ler) (hüküm cümlesi genelde sondadır).
 * Tek cümle bile sığmıyorsa (Türkçe gerekçelerde 1500+ karakterlik tek cümle yaygın) virgül/noktalı virgül sınırından kesilir.
 */
export function excerptParagraph(p: string, max: number): string {
  const text = p.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const budget = max - ELLIPSIS.length - 2; // " [Ellipsis] "
  const headMax = Math.floor(budget * 0.55);
  const tailMax = budget - headMax;

  const sents = splitSentences(text);
  let head = "";
  let i = 0;
  while (i < sents.length && (head ? `${head} ${sents[i]}` : sents[i]).length <= headMax) {
    head = head ? `${head} ${sents[i]}` : sents[i];
    i++;
  }
  let tail = "";
  let j = sents.length - 1;
  while (j >= i && (tail ? `${sents[j]} ${tail}` : sents[j]).length <= tailMax) {
    tail = tail ? `${sents[j]} ${tail}` : sents[j];
    j--;
  }
  if (!head) head = clauseCut(text, headMax, "head");
  if (!tail) tail = clauseCut(text, tailMax, "tail");
  return `${head} ${ELLIPSIS} ${tail}`.trim();
}

/** Cümle sığmadığında: dilim sınırını virgül/noktalı virgül/iki nokta'ya hizalar (kelime ortasında kesmez). */
function clauseCut(text: string, max: number, side: "head" | "tail"): string {
  if (side === "head") {
    const slice = text.slice(0, max);
    const cut = Math.max(slice.lastIndexOf(", "), slice.lastIndexOf("; "), slice.lastIndexOf(": "));
    return (cut > max * 0.4 ? slice.slice(0, cut + 1) : slice.slice(0, slice.lastIndexOf(" "))).trim();
  }
  const slice = text.slice(text.length - max);
  const cands = [slice.indexOf(", "), slice.indexOf("; "), slice.indexOf(": ")].filter((k) => k >= 0);
  const cut = cands.length ? Math.min(...cands) : -1;
  return (cut >= 0 && cut < max * 0.6 ? slice.slice(cut + 2) : slice.slice(slice.indexOf(" ") + 1)).trim();
}
