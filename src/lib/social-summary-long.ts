// "Uzun özet" — Instagram hikâye/Reels açıklaması için ~400 karakterlik metin (v6.317, 2026-10-03).
//
// Neden var: `/api/social-digest` öğesinin `summary` alanı 160 karakterlik TEASER'dır (sabah kartı + X/LinkedIn; telif çizgisi
// "başlık + kaynak + kısa özet + link"). Hikâye serisi her başlık için daha geniş bir açıklama ister. 👤 kararları:
//   · 02.10.2026 (AskUserQuestion): "~400 karakter, kısa özet" — tam metin/AI özeti DEĞİL; teaser çizgisini bilerek genişletir.
//   · 03.10.2026 (AskUserQuestion): açıklama KAYNAĞI = "DB özeti + dürüst yedek". Haiku yeniden yazımı ve `aiSummary` REDDEDİLDİ:
//     halka açık tıbbi metinde LLM çarpıtma/yeni iddia riski var, "aynı gün aynı çıktı" garantisi yok, denetimi zor.
// Bu yüzden metin KAYNAĞIN KENDİ özetidir (ingest'te Türkçeleşmiş hâli), yalnız CÜMLE sınırından kırpılır; uydurma/yeniden yazım YOK.
//
// Özet kullanılamıyorsa — boş ya da çok kısa (Resmî Gazete PDF'inde metin katmanı yok, yalnız-bağlantı dernek duyuruları) YA DA
// ÇEVRİLMEMİŞ/İNGİLİZCE kalmışsa (Türkçe hikâyede İngilizce paragraf çıkmasın; 👤 kararı "Türkçeleşmiş özet") — metin UYDURULMAZ:
// bilinen üç şey söylenir (kaynak adı, tarih, "ayrıntı kaynak bağlantısında") ve `summaryLongFallback: true` döner — hikâye tarafı
// isterse farklı sunar. Bu metin politikası (halka açık söylem) kodda, testle kilitlidir; render/n8n tarafı aptal kalır.
// Kaynak artıkları (HTML etiketi, WordPress "The post … first appeared on …" kuyruğu, "Devamını oku/Read more/[…]") metinden ayıklanır:
// ingest bunları her zaman temizlemez (02–03.10 dev örneklemi: Medscape `<br />`, ÖHSAD WordPress kuyruğu).
//
// KULLANIM SINIRI: yalnız jetonlu makine ucu (`/api/social-digest`) → n8n/kart. Halka açık /secki sayfası bunu GÖSTERMEZ
// (veri kalitesi + teaser çizgisi; bkz. doctorium-secki/view.ts "ÖZET YOK" notu).
import { trDayString, trimSummary } from "./daily-digest";
import { trDateLabel } from "./tr-date-label";

/** Hikâye açıklaması üst sınırı (karakter) — 👤 02.10.2026. */
export const SUMMARY_LONG_MAX = 400;
/** Bu uzunluğun altındaki özet "kullanılamaz" sayılır (boş / menü artığı / tek kelime) → dürüst yedek. */
export const SUMMARY_LONG_MIN = 30;
/** Cümle sınırında kesince bütçenin en az bu kadarı dolmalı; aksi hâlde (kısa ilk cümle + çok uzun ikincisi) kelime sınırında kırp. */
const SENTENCE_FILL_MIN = 0.3;

/** Cümle sonu SAYILMAYAN kısaltmalar (küçük harf, noktasız). Uzun bir liste değil: özetlerde görülen kalıplar. */
const ABBREVIATIONS = new Set([
  // Türkçe
  "ör", "örn", "vb", "vs", "vd", "bkz", "krş", "sn", "dk", "dr", "prof", "doç", "yrd", "uzm", "op", "dt", "av", "no", "nr", "st", "cad", "mah", "sok", "tel",
  // İngilizce (çevrilmemiş kalan özetler)
  "al", "fig", "figs", "approx", "inc", "ltd", "co", "mr", "mrs", "ms", "jr", "sr", "cf", "ca", "resp", "ref", "refs", "est", "dept",
]);

/**
 * Kaynak artıklarını ayıklar (hikâye metni halka açık): görünmez karakterler (yumuşak tire U+00AD, sıfır genişlikli boşluk U+200B,
 * kelime birleştirici U+2060, U+FEFF — 03.10 canlı ölçüm: KLİMİK metninde "tarihleri" ile "arasında" arasında iki U+200B), HTML etiketleri (`<br />`, `<p>`, `<a …>`),
 * WordPress'in "The post … first appeared on …" kuyruğu, metnin SONUNDAKİ "Devamını oku / Read more / Continue reading / […]". SAF.
 * Etiket deseni yalnız `<` + HARF ile başlar → "p<0.05", "n<30" gibi karşılaştırmalar etkilenmez. Orta metindeki "Read more" dokunulmaz.
 * ZWJ/ZWNJ (U+200D/U+200C) bilerek SİLİNMEZ: emoji dizilerini ve bazı yazıları bozar; Türkçe/İngilizce özetlerde gerekmez.
 */
export function cleanSummary(raw: string): string {
  return raw
    .replace(/[\u00AD\u200B\u2060\uFEFF]/g, "")
    .replace(/<\/?[a-z][^>]*>/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*The post .*? (?:first appeared|appeared first) on .*$/i, "")
    .replace(/\s*(?:\[\s*(?:…|\.{3})\s*\]|Devamını oku\w*|Read more|Continue reading)\s*»?\s*$/i, "")
    .trim();
}

/**
 * İngilizce işlev sözcükleri — dil kapısı için. YALNIZ Türkçe düzyazıda pratikte görülmeyenler: "a", "in", "on", "an", "as", "at",
 * "can", "no", "it", "be" bilerek YOK (Türkçe'de harf etiketi "A grubu", "in vitro", "on iki", "can", "at", "No:" gibi kullanımlar var).
 */
const EN_STOPWORDS = new Set([
  "the", "of", "and", "with", "was", "were", "is", "are", "for", "that", "this", "which", "from", "these", "between", "than",
  "we", "our", "patients", "study", "results", "methods", "background", "conclusion", "conclusions", "however", "using",
  "after", "been", "has", "have", "had", "not", "also", "among", "to", "by", "or", "may", "will", "should", "when", "who",
  "into", "such", "each", "other", "during", "within", "their", "its", "while", "both", "only", "because", "but",
]);

/**
 * Metin İNGİLİZCE mi (çevrilmemiş)? Muhafazakâr, SAF sezgi: ≥ 6 sözcük VE sözcüklerin ≥ %10'u İngilizce işlev sözcüğü VE
 * Türkçe'ye özgü harf (ç ğ ı ö ş ü) oranı < %1. Kısa metinde karar VERMEZ (false). Yanlışı hedefler: Türkçe metin İngilizce
 * sanılıp yedeğe düşmesin. Sözcükler BOŞLUKLA ayrılır (noktalama kırpılır) — harf kümesiyle bölünseydi "Parkinson'in" gibi Türkçe ek
 * parçaları ("in") İngilizce işlev sözcüğü sayılırdı. İlaç/etken adları ve kısaltmalar işlev sözcüğü değildir.
 */
export function looksEnglish(text: string): boolean {
  const words = text
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "").toLocaleLowerCase("en"))
    .filter(Boolean);
  if (words.length < 6) return false;
  const hits = words.filter((w) => EN_STOPWORDS.has(w)).length;
  const letters = text.replace(/[^\p{L}]/gu, "").length;
  const trLetters = (text.match(/[çğıöşüÇĞİÖŞÜ]/g) ?? []).length;
  return hits / words.length >= 0.1 && trLetters / Math.max(1, letters) < 0.01;
}

/**
 * Resmî Gazete'nin HAM belge metni mi (künye + başlık tekrarı + madde metni)? 03.10.2026 canlı ölçüm: RG kaleminin `summary`'si bir özet
 * DEĞİL, belgenin ham metni ("3 Ekim 2026 CUMARTESİ Resmî Gazete Sayı : 33389 YÖNETMELİK … MADDE 1- …"). Hikâye açıklaması olarak
 * uygun değil (başlık zaten ekranda; madde metni okura yük) → 👤 03.10 kararı: RG için DÜRÜST YEDEK cümle. Tanı: metin künyeyle
 * ("[gün ay yıl HAFTA GÜNÜ] Resmî Gazete Sayı :") başlar. Gövde kaynağı değişirse (özet üretimi) bu kural gözden geçirilir.
 * SAF. "Resmî Gazete'de yayımlanan …" gibi ORTADAKİ anmalar eşleşmez (yalnız metnin başı).
 */
export function looksLikeRawGazetteText(text: string): boolean {
  return /^(?:\d{1,2}\s+\p{L}+\s+\d{4}\s+\p{L}+\s+)?Resm(?:[i\u00EE]|i\u0302)\s+Gazete\s+Say[ıi]\s*:/iu.test(text);
}

/** `before` (sonlandırıcı noktadan ÖNCEKİ metin) bir cümle sonunu mu YOKSA kısaltma/liste numarasını mı bitiriyor? */
function isNonTerminalPeriod(before: string): boolean {
  // "1. Yöntem" / "2. Grup" — tek başına duran 1–2 haneli sayı liste numarasıdır ("0.03." gibi ondalık sonu DEĞİL: öncesinde nokta var).
  if (/(?:^|\s)\d{1,2}$/.test(before)) return true;
  if (/\b(?:e\.g|i\.e)$/i.test(before)) return true;
  const tok = /(\p{L}+)$/u.exec(before)?.[1];
  return tok ? ABBREVIATIONS.has(tok.toLocaleLowerCase("tr")) : false;
}

/**
 * Cümle sonlarının (sonlandırıcı + kapanış tırnak/parantezi DAHİL, boşluk HARİÇ) indisleri — artan sıra. SAF.
 * Sınır = `.` `!` `?` `…` + boşluk + (büyük harf | rakam | açılış tırnak/parantezi). Kısaltma ve liste numarası sınır DEĞİLDİR.
 * Metnin SON cümlesi (ardında boşluk yok) listeye girmez — kesim adayı değildir.
 */
export function sentenceEnds(text: string): number[] {
  const ends: number[] = [];
  const re = /([.!?…]+)(["”’)\]]*)\s+(?=["“‘(\[]?[A-ZÇĞİÖŞÜ0-9])/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m[1].endsWith(".") && !m[2] && isNonTerminalPeriod(text.slice(0, m.index))) continue;
    ends.push(m.index + m[1].length + m[2].length);
  }
  return ends;
}

/**
 * `max` karakteri aşan metni TAM CÜMLE(ler) bırakarak kırpar (her zaman ≤ max):
 *  · sığıyorsa aynen (boşluklar tek boşluğa iner);
 *  · aksi hâlde `max` içindeki SON cümle sonunda keser (sonuna "…" eklenmez — cümle tamdır);
 *  · tam cümle yoksa ya da kesim bütçenin %30'undan azını dolduruyorsa (kısa ilk cümle + çok uzun ikincisi) KELİME sınırında kırpar
 *    ve "…" ekler (ortada kesildiği okura söylenir).
 */
export function trimToSentences(raw: string, max: number = SUMMARY_LONG_MAX): string {
  const flat = raw.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  let cut = 0;
  for (const end of sentenceEnds(flat)) {
    if (end > max) break;
    cut = end;
  }
  if (cut >= Math.ceil(max * SENTENCE_FILL_MIN)) return flat.slice(0, cut).trimEnd();
  return trimSummary(flat, max - 1); // "…" dahil ≤ max
}

/** Yedek cümleye girebilecek en uzun kaynak adı (karakter). */
const FALLBACK_SOURCE_NAME_MAX = 40;

/**
 * Özet kullanılamadığında söylenecek DÜRÜST yedek cümle: yalnız bilinenler (kaynak adı + yayın günü + "ayrıntı kaynakta").
 * Uzun kaynak adı (PubMed/Europe PMC'de dergi adı: "Genetics in medicine : official journal of the American College of …")
 * cümleyi hantallaştırır ve hikâye kaynak adını zaten ayrıca gösterir → yalnız KISA adlar cümleye girer.
 */
export function summaryLongFallback(sourceName: string, publishedAt: Date): string {
  const day = trDateLabel(trDayString(publishedAt));
  const name = sourceName.replace(/\s+/g, " ").trim();
  return name && name.length <= FALLBACK_SOURCE_NAME_MAX
    ? `${name} kaynağında ${day} tarihinde yayımlandı; ayrıntı kaynak bağlantısında.`
    : `${day} tarihinde yayımlandı; ayrıntı kaynak bağlantısında.`;
}

export interface SummaryLong {
  text: string;
  /** true → özet kullanılamadı, `text` dürüst yedek cümle. */
  fallback: boolean;
}

/**
 * Bir seçki öğesinin hikâye açıklaması. `summary` ÖNCEDEN HTML-varlıktan arındırılmış olmalı (`decodeFeedText`) — kırpma gerçek
 * harfleri saysın, yarım varlık kuyruğu kalmasın. Kaynak artıkları ayıklanır (`cleanSummary`); sonuç ≥ SUMMARY_LONG_MIN karakter,
 * İngilizce değil VE Resmî Gazete ham belge metni değilse cümle sınırından ≤ SUMMARY_LONG_MAX; aksi hâlde dürüst yedek.
 */
export function buildSummaryLong(input: { summary: string; sourceName: string; publishedAt: Date }): SummaryLong {
  const cleaned = cleanSummary(input.summary);
  if (cleaned.length >= SUMMARY_LONG_MIN && !looksEnglish(cleaned) && !looksLikeRawGazetteText(cleaned)) {
    return { text: trimToSentences(cleaned), fallback: false };
  }
  return { text: summaryLongFallback(input.sourceName, input.publishedAt), fallback: true };
}
