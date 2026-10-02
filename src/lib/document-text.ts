// Haber / mevzuat sayfası → özet zemini DÜZ METİN — SAF (ağ yok), birim testli (tests/unit/document-text.test.ts).
//
// KÖK SORUN (2026-10-02, Günlük Seçki özetleri ölçülürken): KLİMİK kaleminin seçki özeti haber değil site gezinme
// menüsüydü — "IDCM Dergisinin Eylül 2026 Sayısı Yayında! | Klimik Dernek Kurullar Dernek Tüzüğü Etik Kurul Yönergesi …".
// Kaynak RSS ingest DEĞİLDİ: beslemenin <description>'ı "Yeni Sayı İçin Tıklayınız" (temiz). RSS özeti 120 karakterden
// kısa kalan kalemlerde gece 02:56'daki generate-ai-summaries → ensureRegulationSummary kaynak SAYFAYI çekip TÜM HTML'i
// düz metne çeviriyordu (eski fetchDocumentText: `<title>` + gezinme menüsü + alt bilgi) ve sonucu
// NewsArticle.summary'ye YAZIYORDU. Canlı sayfada eski algoritma kanıt JSON'undaki dizgeyi birebir üretti. Aynı kusur
// İTO / OHSAD / TTB satırlarında da var (dev DB: 7–8 bin karakterlik "başlık + menü + alt bilgi" yığını).
//
// ÇÖZÜM — "doğru alan": önce İÇERİK KAPSAYICISI seçilir (itemprop=articleBody › bilinen sınıf belirteci › <article> ›
// <main> › role=main), içinde sayfa kabuğu etiketleri (nav/header/footer/aside…) sökülür ve mümkünse yalnız <p> metni
// alınır (başlık tekrarı, tarih, görüntülenme sayacı, "Yazdır" gibi gürültü <p> dışındadır).
// ⚠️ Kapsayıcı VARSA yalnız o kullanılır: gövdesi kısaysa (KLİMİK "Yeni Sayı İçin Tıklayınız", 25 karakter) sonuç null'dır —
// menüyü özet yapmaktansa dürüst boşluk. Kapsayıcı YOKSA eski davranış (tüm gövde) sürer: Word'den üretilen Resmî Gazete
// belgelerinde sayfanın TAMAMI zaten belgedir.
// Ayrıştırıcı bağımlılığı yok (proje deseni: hedefli regex); kapsayıcı sınırı etiket derinliği sayılarak bulunur.

/** Sonuç alt sınırı (eski fetchDocumentText değeri): daha kısa metin özet zemini sayılmaz → null. */
export const DOCUMENT_TEXT_MIN = 120;
/** Sonuç üst sınırı (eski değer — DB satırı ve AI girdisi şişmesin). */
export const DOCUMENT_TEXT_MAX = 8000;
/** Bir <p>'nin dikkate alınma alt sınırı: "Paylaş", "Yazdır", tarih/yazar satırı gibi kırıntılar elenir. */
const PARAGRAPH_MIN = 25;

// ── HTML varlıkları ─────────────────────────────────────────────────────────
// Gerçek İTO sayfası "n&ouml;roloji", "Odası&rsquo;nın" taşıyor; eski `plain()` adlandırılmış varlıkların çoğunu
// çözmüyordu (özete "n&ouml;roloji" yazılıyordu). TEK GEÇİŞ: çözülmüş çıktı bir daha taranmaz → "&amp;lt;" "<" olmaz.

/** HTML Latin-1 tablosu (U+00A0…U+00FF) — adlar kod sırasındadır (96 öğe; test hizayı kilitler). */
const LATIN1_NAMES =
  ("nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn sup2 sup3 acute micro " +
    "para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil " +
    "Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave " +
    "Uacute Ucirc Uuml Yacute THORN szlig agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml " +
    "igrave iacute icirc iuml eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute " +
    "thorn yuml").split(" ");

const NAMED_ENTITIES = new Map<string, string>([
  ["amp", "&"], ["lt", "<"], ["gt", ">"], ["quot", '"'], ["apos", "'"],
  ["lsquo", "‘"], ["rsquo", "’"], ["sbquo", "‚"], ["ldquo", "“"], ["rdquo", "”"], ["bdquo", "„"],
  ["ndash", "–"], ["mdash", "—"], ["hellip", "…"], ["bull", "•"], ["euro", "€"], ["trade", "™"],
  // Türkçe harfler: ö/ü/ç Latin-1 tablosunda; ğ/ş/ı/İ HTML5 adlarıdır.
  ["gbreve", "ğ"], ["Gbreve", "Ğ"], ["scedil", "ş"], ["Scedil", "Ş"], ["Idot", "İ"], ["imath", "ı"], ["inodot", "ı"],
  ...LATIN1_NAMES.map((name, i): [string, string] => [name, String.fromCharCode(160 + i)]),
  ["nbsp", " "], // normal boşluk: ardından zaten boşluklar tek boşluğa iner
]);

/** Adlandırılmış + sayısal HTML varlıklarını TEK geçişte çözer; bilinmeyen varlık olduğu gibi kalır. */
export function decodeHtmlEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#[0-9]+|[A-Za-z][A-Za-z0-9]*);/gi, (m, body: string) => {
    if (body[0] === "#") {
      const n = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : m;
    }
    return NAMED_ENTITIES.get(body) ?? m;
  });
}

// ── Etiket ayıklama ─────────────────────────────────────────────────────────

/**
 * Satır içi etiketler boşluksuz sökülür: "Meclisi<a>’nin</a>" → "Meclisi’nin" (eski `plain()` her etiketi boşluğa çevirip
 * "Meclisi ’nin" yazıyordu); Word'ün sözcük ortasında böldüğü <span>'lar da birleşir. Geri kalan etiketler boşluk olur.
 */
const INLINE_TAG = /<\/?(?:a|b|strong|i|em|u|span|sup|sub|small|font|mark|abbr|cite|s|strike)\b[^>]*>/gi;
/** Sayfa KABUĞU öğeleri: gezinme / üst-alt bilgi / yan sütun / etkileşim (⚠️ <form> YOK: ASP.NET sayfaları tüm gövdeyi <form> ile sarar). */
const CHROME = /<(nav|header|footer|aside|button|select|iframe|svg|figcaption)\b[^>]*>[\s\S]*?<\/\1>/gi;
/** Word/FrontPage artıkları (RG belgeleri Word'den üretilir): anlamsız belirteçleri at — YALNIZ kapsayıcısız yolda. */
const WORD_ARTIFACTS = /\b(Print|Clean|false|true|MicrosoftInternetExplorer\d*|X-NONE|TR)\b/g;

function htmlToText(html: string): string {
  return decodeHtmlEntities(html.replace(INLINE_TAG, "").replace(/<[^>]*>/g, " "))
    .replace(/[\u200B\uFEFF\u00AD]/g, "") // sıfır genişlikli boşluk, BOM ve yumuşak tire (&shy;): görünmez ama sayıyı ve kesimi bozar (KLİMİK beslemesinde görüldü)
    .replace(/\s+/g, " ")
    .trim();
}

/** <head> (title/meta), script/style/noscript/template ve yorumları atar — `<title>` metni gövdeye SIZMASIN. */
function stripNonContent(html: string): string {
  return html
    .replace(/<head[\s>][\s\S]*?<\/head>/i, " ")
    .replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
}

// ── İçerik kapsayıcısı ──────────────────────────────────────────────────────

/**
 * Makale gövdesini taşıyan bilinen sınıf belirteçleri — TAM belirteç eşleşmesi ("post-content-single" eşleşmez).
 * Canlı ölçüm (2026-10-02): KLİMİK `entry-content` · OHSAD `td-post-content` · TTB `post-content`.
 */
const CONTENT_CLASS_TOKENS = ["entry-content", "td-post-content", "post-content", "article-body", "article-content", "news-content", "post-body"];

/** `openIndex`teki <tag …> açılışının eşlenik kapanışına kadar iç HTML'i; etiketler dengesizse null. */
function balancedInner(html: string, openIndex: number, tag: string): string | null {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi");
  re.lastIndex = openIndex;
  let depth = 0;
  let innerStart = -1;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (m[1] === "") {
      depth++;
      if (innerStart < 0) innerStart = re.lastIndex;
    } else if (--depth === 0) {
      return html.slice(innerStart, m.index);
    }
  }
  return null;
}

/**
 * En iyi içerik kapsayıcısının iç HTML'i (yoksa null). Öncelik grupları: 0 itemprop=articleBody · 1 bilinen sınıf belirteci ·
 * 2 <article> · 3 <main> · 4 role=main. Grup içinde en UZUN olan seçilir (İTO'da ilk <article> haberdir, sonrakiler
 * "ilgili haber" kartlarıdır; <main> ise tüm sayfa kabuğunu taşır — bu yüzden <article> ona tercih edilir).
 */
function findContentContainer(html: string): string | null {
  const groups: string[][] = [[], [], [], [], []];
  for (const m of html.matchAll(/<(div|section|article|main)\b([^>]*)>/gi)) {
    const tag = m[1].toLowerCase();
    const attrs = m[2];
    let group = -1;
    if (/\bitemprop\s*=\s*["']articleBody["']/i.test(attrs)) group = 0;
    else {
      const cls = /\bclass\s*=\s*["']([^"']*)["']/i.exec(attrs)?.[1];
      if (cls && cls.split(/\s+/).some((t) => CONTENT_CLASS_TOKENS.includes(t))) group = 1;
    }
    if (group < 0 && tag === "article") group = 2;
    if (group < 0 && tag === "main") group = 3;
    if (group < 0 && /\brole\s*=\s*["']main["']/i.test(attrs)) group = 4;
    if (group < 0) continue;
    const inner = balancedInner(html, m.index, tag);
    if (inner !== null) groups[group].push(inner);
  }
  for (const g of groups) {
    if (g.length) return g.reduce((best, cur) => (cur.length > best.length ? cur : best));
  }
  return null;
}

/**
 * Sayfanın HTML'inden özet zemini düz metni çıkarır (≤ DOCUMENT_TEXT_MAX); metin DOCUMENT_TEXT_MIN'den kısaysa null.
 * Kapsayıcı varsa yalnız o (kısaysa null — menüye DÜŞMEZ); yoksa eski davranış: tüm gövde, yalnız sayfa kabuğu etiketleri sökülür.
 */
export function extractDocumentText(html: string): string | null {
  const page = stripNonContent(html);
  const container = findContentContainer(page);
  let text: string;
  if (container !== null) {
    const body = container.replace(CHROME, " ");
    // Metin blokları belge sırasıyla: <p> + CÜMLE GİBİ BİTEN alt başlıklar. KLİMİK yazılarında lead cümle <h3>'tedir
    // ("Çin, … kuş gribi infeksiyonu vakası bildirdi.") — yalnız <p> alınsa en bilgilendirici cümle düşerdi. Başlık/etiket
    // noktasız biter (TTB "5 Nisan … Bildirisi", İTO "BENZER HABERLER"), cümle noktalı → o ayrım başlık tekrarını geri getirmez.
    const paragraphs = [...body.matchAll(/<(p|h[2-6])\b[^>]*>([\s\S]*?)<\/\1>/gi)]
      .map((m) => ({ tag: m[1].toLowerCase(), text: htmlToText(m[2]) }))
      .filter((b) => b.text.length >= PARAGRAPH_MIN && (b.tag === "p" || /[.!?…]$/.test(b.text)))
      .map((b) => b.text)
      .join(" ");
    text = paragraphs.length >= DOCUMENT_TEXT_MIN ? paragraphs : htmlToText(body);
  } else {
    text = htmlToText(page.replace(CHROME, " ")).replace(WORD_ARTIFACTS, " ").replace(/\s+/g, " ").trim();
  }
  return text.length >= DOCUMENT_TEXT_MIN ? text.slice(0, DOCUMENT_TEXT_MAX) : null;
}
