// Hukuk/İçtihat — DETERMİNİSTİK anahtar kelime · kanun maddesi · alıntı çıkarımı (v6.87, 2026-08-06).
//
// Kullanıcı kararı (2026-08-06): İçtihat kartlarındaki özet/etiketler AI'sız üretilir — metinde
// GERÇEKTEN GEÇEN terimler etiketlenir, filtre buna dayanır ("uydurma içerik yok" ilkesinin
// filtre hâli: AI'nin etiket üretmediği karar filtreden kaybolmaz, üretim maliyeti sıfırdır).
//
// Sözlük HUKUKÇUNUN kalemidir: terim eklemek/çıkarmak = bu dosyada tek satır. Desenler küçük
// harfle yazılır; karşılaştırma toLocaleLowerCase("tr-TR") ile yapılır (İ→i doğru katlansın).
// ⚠️ Çok geniş tek kelime ekleme ("hasta", "doktor" gibi) — her kararda geçer, filtre anlamsızlaşır.

export interface HukukKeyword {
  key: string; // URL'de taşınan kimlik (?k=) — kebab-case, değiştirme (paylaşılan linkler kırılır)
  label: string; // çipte görünen ad
  patterns: string[]; // metinde aranan küçük-harf parçalar (substring; herhangi biri yeter)
}

export const HUKUK_KEYWORDS: HukukKeyword[] = [
  { key: "malpraktis", label: "Malpraktis", patterns: ["malpraktis", "tıbbi uygulama hatası", "hekim hatası"] },
  { key: "yanlis-tedavi", label: "Yanlış tedavi/tanı", patterns: ["yanlış tedavi", "hatalı tedavi", "tedavi hatası", "yanlış tanı", "hatalı tanı", "yanlış teşhis", "hatalı teşhis"] },
  { key: "tazminat", label: "Tazminat", patterns: ["tazminat"] },
  { key: "manevi-tazminat", label: "Manevi tazminat", patterns: ["manevi tazminat"] },
  { key: "aydinlatilmis-onam", label: "Aydınlatılmış onam", patterns: ["aydınlatılmış onam", "aydınlatma yükümlülüğü", "aydınlatılmış rıza", "hastanın rızası"] },
  { key: "ozen-yukumlulugu", label: "Özen yükümlülüğü", patterns: ["özen yükümlülüğü", "özen borcu", "özen yükümü"] },
  { key: "komplikasyon", label: "Komplikasyon", patterns: ["komplikasyon"] },
  { key: "bilirkisi", label: "Bilirkişi/ATK", patterns: ["bilirkişi", "adli tıp kurumu", "yüksek sağlık şurası", "ihtisas kurulu"] },
  { key: "taksir", label: "Taksirle öldürme/yaralama", patterns: ["taksirle öldürme", "taksirle yaralama", "taksirle ölüm", "bilinçli taksir"] },
  { key: "eser-sozlesmesi", label: "Eser sözleşmesi", patterns: ["eser sözleşmesi"] },
  { key: "vekalet", label: "Vekâlet sözleşmesi", patterns: ["vekalet sözleşmesi", "vekâlet sözleşmesi", "vekalet akdi", "vekâlet akdi"] },
  { key: "estetik", label: "Estetik", patterns: ["estetik"] },
  { key: "dis", label: "Diş hekimliği", patterns: ["diş hekim", "diş tedavi", "implant"] },
  { key: "dogum", label: "Doğum/gebelik", patterns: ["doğum", "gebelik", "sezaryen", "gebeliğin"] },
  { key: "enfeksiyon", label: "Enfeksiyon", patterns: ["enfeksiyon"] },
  { key: "destekten-yoksun", label: "Destekten yoksun kalma", patterns: ["destekten yoksun"] },
];

const KEY_SET = new Set(HUKUK_KEYWORDS.map((k) => k.key));

/** ?k= paramı → sözlük girdisi; bilinmeyen değer null (filtresiz liste — URL kurcalanması kırmaz). */
export function keywordByKey(raw: string | undefined | null): HukukKeyword | null {
  if (!raw || !KEY_SET.has(raw)) return null;
  return HUKUK_KEYWORDS.find((k) => k.key === raw) ?? null;
}

/** Metinde geçen sözlük terimleri (sözlük sırasıyla). limit: kartta çip enflasyonu olmasın. */
export function extractKeywords(text: string, limit = 5): HukukKeyword[] {
  const t = text.toLocaleLowerCase("tr-TR");
  const out: HukukKeyword[] = [];
  for (const kw of HUKUK_KEYWORDS) {
    if (kw.patterns.some((p) => t.includes(p))) {
      out.push(kw);
      if (out.length >= limit) break;
    }
  }
  return out;
}

// ── Branş çıkarımı (v6.93, kullanıcı isteği 2026-08-14) ─────────────────────
// İçtihat kararları ve Doktrin makaleleri metinden BRANŞLARA etiketlenir — bir içerik birden çok
// branşı etkileyebilir (branchSlugs zaten dizi). Sözlükle aynı ilke: DETERMİNİSTİK — yalnız metinde
// GEÇEN branş sinyali etiket olur, AI çıkarımı yok. Slug'lar lib/triage BRANCHES ile birebir
// (branş çipleri + Akışım eşleşmesi bu slug'larla çalışır — sözleşme birim testte kilitli).
// ⚠️ Tek başına aşırı geniş kelimeler bilinçli DESEN DEĞİL: "göz" (göz önünde), "doğum" (doğum
// tarihi!), "kanser", "ameliyat", "bebek" ("tüp bebek" IVF'tir, pediatri değil), "enfeksiyon"
// (her komplikasyonda geçer — uzmanlık adı "enfeksiyon hastalıkları" desendir).

export interface BranchPattern {
  slug: string; // lib/triage BRANCHES key'i
  patterns: string[]; // küçük-harf parçalar (tr-TR katlamayla aranır)
}

export const BRANCH_PATTERNS: BranchPattern[] = [
  { slug: "onkoloji", patterns: ["onkoloji", "onkolog", "kemoterapi"] },
  { slug: "kardiyoloji", patterns: ["kardiyoloji", "kardiyolog", "kalp krizi", "miyokard", "anjiyografi"] },
  { slug: "ortopedi", patterns: ["ortopedi", "ortopedik", "ortopedist", "menisküs", "eklem protezi"] },
  { slug: "norosirurji", patterns: ["nöroşirürji", "beyin cerrahi", "beyin ameliyat", "omurga cerrahisi", "hidrosefali"] },
  { slug: "sac-ekimi", patterns: ["saç ekimi", "saç nakli"] },
  { slug: "estetik", patterns: ["estetik cerrahi", "estetik ameliyat", "estetik operasyon", "estetik müdahale", "rinoplasti", "burun estetiği", "meme estetiği", "liposuction", "silikon implant", "botoks"] },
  { slug: "ivf", patterns: ["tüp bebek", "in vitro fertilizasyon", "embriyo transferi", "kısırlık tedavisi"] },
  { slug: "dis", patterns: ["diş hekim", "diş tedavi", "diş çek", "ortodonti", "kanal tedavisi", "diş implant", "implant uygulan"] },
  { slug: "goz", patterns: ["göz hastalık", "göz ameliyat", "göz hekimi", "göz doktoru", "oftalmoloji", "katarakt", "retina", "glokom", "lazer göz"] },
  { slug: "genel-cerrahi", patterns: ["genel cerrahi", "apandis", "safra kesesi", "fıtık ameliyat", "tiroidektomi"] },
  { slug: "dahiliye", patterns: ["dahiliye", "iç hastalıkları"] },
  { slug: "noroloji", patterns: ["nöroloji", "nörolog", "epilepsi", "inme geçir", "felç"] },
  { slug: "gastroenteroloji", patterns: ["gastroenteroloji", "endoskopi", "kolonoskopi", "gastroskopi"] },
  { slug: "endokrinoloji", patterns: ["endokrinoloji", "diyabet", "tiroid", "guatr"] },
  { slug: "nefroloji", patterns: ["nefroloji", "diyaliz", "böbrek yetmezliği"] },
  { slug: "gogus-hastaliklari", patterns: ["göğüs hastalıkları", "akciğer", "astım", "koah", "tüberküloz"] },
  { slug: "hematoloji", patterns: ["hematoloji", "lösemi", "lenfoma"] },
  { slug: "romatoloji", patterns: ["romatoloji", "romatizma", "romatoid"] },
  { slug: "enfeksiyon", patterns: ["enfeksiyon hastalıkları", "menenjit", "sepsis", "hastane enfeksiyonu"] },
  { slug: "dermatoloji", patterns: ["dermatoloji", "dermatolog", "cilt hastalık"] },
  { slug: "psikiyatri", patterns: ["psikiyatri", "psikiyatrist", "ruh sağlığı", "şizofreni"] },
  { slug: "fizik-tedavi", patterns: ["fizik tedavi", "fiziksel tıp", "rehabilitasyon"] },
  { slug: "cocuk-sagligi", patterns: ["çocuk sağlığı", "çocuk hastalık", "çocuk hasta", "pediatri", "pediatrik", "yenidoğan"] },
  { slug: "uroloji", patterns: ["üroloji", "ürolojik", "ürolog", "prostat", "mesane", "nefrostomi", "böbrek taşı"] },
  { slug: "kbb", patterns: ["kulak burun boğaz", "kbb", "bademcik", "septum deviasyonu", "timpanoplasti"] },
  { slug: "kadin-dogum", patterns: ["kadın doğum", "kadın hastalıkları", "jinekoloji", "jinekolog", "obstetri", "sezaryen", "gebelik", "doğum eylemi"] },
  { slug: "kvc", patterns: ["kalp ve damar cerrahisi", "kalp damar cerrah", "açık kalp", "bypass", "by-pass"] },
  { slug: "gogus-cerrahisi", patterns: ["göğüs cerrahisi"] },
  { slug: "organ-nakli", patterns: ["organ nakli", "böbrek nakli", "karaciğer nakli", "transplantasyon", "organ bağışı"] },
  { slug: "radyasyon-onkolojisi", patterns: ["radyasyon onkolojisi", "radyoterapi", "ışın tedavisi"] },
];

/** Metindeki desen geçiş sayısı (örtüşmesiz). */
function countHits(hay: string, needle: string): number {
  let n = 0;
  for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + needle.length)) n++;
  return n;
}

/**
 * Metinden branş etiketleri (çok-branş; sıra BRANCH_PATTERNS sırası). `minHits`: İçtihat gibi UZUN
 * metinlerde tek yan-cümle geçişi ("KBB uzmanına sevk edildi") topikal sayılmaz → 2 istenir;
 * Doktrin başlık+özeti kısa/odaklı olduğundan 1 yeter. Hiç eşleşme yoksa boş dizi = genel içerik.
 */
export function extractBranches(text: string, opts: { minHits?: number; limit?: number } = {}): string[] {
  const { minHits = 1, limit = 4 } = opts;
  const t = text.toLocaleLowerCase("tr-TR");
  const out: string[] = [];
  for (const b of BRANCH_PATTERNS) {
    let hits = 0;
    for (const p of b.patterns) {
      hits += countHits(t, p);
      if (hits >= minHits) break;
    }
    if (hits >= minHits) {
      out.push(b.slug);
      if (out.length >= limit) break;
    }
  }
  return out;
}

// ── Kanun maddesi atıfları ──────────────────────────────────────────────────
// Kararlardaki iki yaygın atıf biçimi yakalanır (2026-08-06 gerçek metin kesitlerinden):
//   1) "6098 sayılı Türk Borçlar Kanunu'nun 49 uncu maddesi"  → TBK m.49
//   2) "TCK'nın 85/1. maddesi", "BK.nun 41. maddesi"          → TCK m.85/1 · BK m.41
// Bilinmeyen kanun numarası "5510 sayılı K. m.12" biçiminde gösterilir (uydurma ad üretilmez).

const LAW_ABBR: Record<string, string> = {
  "6098": "TBK", "818": "BK", "5237": "TCK", "765": "eTCK", "6502": "TKHK",
  "4077": "eTKHK", "6100": "HMK", "1086": "HUMK", "4721": "TMK", "5271": "CMK",
  "1219": "1219 s. Tababet K.", "3359": "3359 s. Sağlık Hizmetleri K.", "5510": "5510 s. SSGSS K.",
};
const ABBR_SET = new Set(["TBK", "BK", "TCK", "TKHK", "HMK", "HUMK", "TMK", "CMK", "İYUK", "TTK"]);

// (1) "<no> sayılı … Kanun*'un/nun <madde>" — kanun adı ile madde arası en fazla ~80 karakter
// (nokta geçmeden); "uncu/üncü/inci" ekleri ve devam eden fıkra (85/1) yakalanır.
const RE_SAYILI = /(\d{3,4})\s+sayılı\s+[^.]{0,80}?kanun\S{0,6}\s*(?:ile|'?n[ıiuü]n|un|ün)?\s+(\d{1,3}(?:\/\d{1,2})?)/gi;
// (2) "TCK'nın 85/1", "TCK.nun 85", "BK m. 41", "TBK md.49" — kısaltma + (ek|m.) + sayı(/fıkra).
const RE_ABBR = /\b([A-ZİÇĞÖŞÜ]{2,5})\s*(?:['’.]|\s)\s*(?:n[ıiuü]n|nun|nün|m(?:d|adde)?\.?)\s*(\d{1,3}(?:\/\d{1,2})?)/g;

// Temyiz USUL maddeleri her kararın hüküm fıkrasında geçer (onama/bozma kalıbı) — esasa dair
// bilgi taşımaz, çip olarak salt gürültüdür (2026-08-06 canlı gözlem: HMK m.370/1 her kartta).
const RE_USUL = /^(HMK m\.(36[6-9]|37[0-3])|HUMK m\.(42[8-9]|43\d|440)|CMK m\.(23[12]|30[2-9]))(\/|$)/;

/** Metindeki kanun-maddesi atıfları, normalize ve tekrarsız (ör. "TCK m.85/1"). Usul maddeleri elenir. */
export function extractLawRefs(text: string, limit = 4): string[] {
  const out: string[] = [];
  const push = (s: string) => {
    if (!RE_USUL.test(s) && !out.includes(s) && out.length < limit) out.push(s);
  };
  for (const m of text.matchAll(RE_SAYILI)) {
    const abbr = LAW_ABBR[m[1]] ?? `${m[1]} s. K.`;
    push(`${abbr} m.${m[2]}`);
  }
  for (const m of text.matchAll(RE_ABBR)) {
    if (!ABBR_SET.has(m[1])) continue; // "SAYISI 2024/504" gibi yakalamalar elenir
    push(`${m[1]} m.${m[2]}`);
  }
  return out;
}

// ── Kart alıntısı ───────────────────────────────────────────────────────────
// AI'sız "özet": kararın DAVA bölümünün ilk cümleleri (hukuk) ya da Suç/Hüküm satırları (ceza).
// Hiçbiri bulunamazsa dosya başlığı satırları atlanıp metnin başı alınır. Alıntı olduğu bellidir
// (kesme "…" ile biter); özet İDDİASI taşımaz — arayüz "karar metninden" der.

const HEADER_LINE = /^(MAHKEMES[İI]|SAYISI|[İI]LK DERECE|BÖLGE ADL[İI]YE|DAVA TAR[İI]H[İI]|KARAR|TEMY[İI]Z|"[İI]çtihat Metni"|Taraflar|[İI]NCELENEN|DAVANIN)/i;

export function extractExcerpt(text: string, max = 220): string {
  // Ceza kararı deseni: "Suç : Taksirle öldürme" + "Hüküm : …" satırları en bilgilendirici özet.
  const suc = /Suç\s*:\s*([^\n]+)/i.exec(text)?.[1]?.trim();
  const hukum = /Hüküm\s*:\s*([^\n]+)/i.exec(text)?.[1]?.trim();
  if (suc) {
    const s = `Suç: ${suc}${hukum ? ` · Hüküm: ${hukum}` : ""}`;
    return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
  }

  // Yeni format (2024+) "UYUŞMAZLIK" bölümü: "Uyuşmazlık, … ilişkindir." cümlesi kararın en
  // damıtılmış özeti — varsa ve yeterince bilgilendiriciyse tek başına alınır.
  const uyusmazlik = /Uyuşmazlık,?\s[^.]{20,300}\./.exec(text)?.[0]?.replace(/\s+/g, " ").trim();
  if (uyusmazlik && uyusmazlik.length >= 60) {
    return uyusmazlik.length > max ? `${uyusmazlik.slice(0, max - 1).trimEnd()}…` : uyusmazlik;
  }

  // Hukuk kararı deseni: "I. DAVA" bölümü (yoksa "Davacı" ile başlayan ilk paragraf).
  const davaIdx = text.search(/\bI\.?\s*DAVA\b/);
  const fromDava = davaIdx >= 0 ? text.slice(davaIdx).replace(/^\s*I\.?\s*DAVA\s*/, "") : null;
  const davaci = fromDava ?? /Davac[ıi][^]*$/.exec(text)?.[0] ?? null;
  const base =
    davaci ??
    // Fallback: başlık/tesmiye satırlarını atla, ilk anlamlı satırdan başla.
    text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 40 && !HEADER_LINE.test(l))
      .join(" ");
  const flat = base.replace(/\s+/g, " ").trim();
  if (!flat) return "";
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}
