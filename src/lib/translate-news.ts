// Haber ÇEVİRİ hattı — başlık (2026-08-31) + özet GİRİŞİ (v6.206, 2026-09-02 gece).
//
// KÖK SORUN (başlık, 2026-08-31, kullanıcı kararı "bültende İngilizce başlık olmasın"): şemadaki
// `NewsArticle.titleOriginal` alanı v6.48'den beri duruyordu ama HİÇBİR kod doldurmuyordu — "çevrilmişse
// Türkçe" tasarım niyeti kodda karşılıksızdı; PubMed/EPMC/DOAJ başlıkları İngilizce yazılıyordu. Bu modül
// o hattı kurar: ingest, create'ten önce başlıkları TOPLU çevirir → title=Türkçe, titleOriginal=özgün.
// Portal + Post + sosyal bülten birden düzelir.
//
// ÖZET GİRİŞİ (v6.206 — kullanıcı bildirimi 2026-09-02 gece: "özet yok, sadece başlıklar çevrilmiş"):
// başlık çevrildikten sonra abstract / briefSummary / RSS açıklaması İngilizce kalıyor; akış kartı, Post ve
// sosyal bülten ona aynen basıyordu (canlıda: Türkçe başlık altında "Talquetamab, a bispecific antibody…").
// Özet çevirisi ingest'in İÇİNDE DEĞİL, ayrı cron'dadır (api/cron/translate-news → lib/translate-summaries):
// abstract çıktısı başlığın ~20 katı; 30 branş × ek istek ingest'in 300 sn bütçesini taşırır ve o günün
// kalan branşları sessizce düşerdi. Yalnız özetin GİRİŞİ çevrilir (summaryLead — ~700 karakter, cümle
// sınırında): hiçbir yüzey 220 karakterden fazlasını göstermiyor (kart 210/130 · Post 220 · bülten 160).
// Özgün tam metin `summaryOriginal`'da kalır; AI özetleri (ensureClinicalSummary / ensureRegulationSummary)
// kaynak olarak ONU okur.
//
// FAIL-OPEN: anahtar yoksa / API hata verirse / yanıt hizasızsa çeviri gelmez ve çağıran ÖZGÜN metni
// yazar ya da yerinde bırakır — çeviri hattı içerik boru hattını ASLA kurutamaz (ingest disipliniyle aynı).
// Eşleşme güvenliği: model N metne N çeviri döndürmezse PARÇANIN tamamı düşer — kaymış hizayla yanlış metin
// basmaktansa İngilizce kalması yeğdir (alignTranslations, birim testli).
// İçerik PHI DEĞİLDİR (açık literatür/haber metni) — AI'a gitmesi serbest (asla-loglama gerekmez).
import Anthropic from "@anthropic-ai/sdk";

// Basit yüksek-hacim iş: düşük efor yeterli (çeviri başına ~2 sn, gece cron'unda koşar).
const MODEL = "claude-opus-5";
const TITLE_CHUNK = 20; // istek başına başlık — tek istekte tüm gece toplu, hiza riski küçük tutulur
// Özet girişi başlığın ~5 katı (≤ ~800 kar.) → küçük parça: istek ~30 sn'de biter, hiza bozulursa düşen küme küçük.
const SUMMARY_CHUNK = 8;
/** Çevrilen özet GİRİŞİ üst sınırı (karakter) — summaryLead cümle sınırında keser. */
export const SUMMARY_LEAD_MAX = 700;

const TRANSLATE_TOOL: Anthropic.Tool = {
  name: "submit_translations",
  description: "Verilen metinlerin Türkçe çevirilerini, AYNI SIRADA ve AYNI SAYIDA döndürür.",
  input_schema: {
    type: "object",
    properties: {
      translations: {
        type: "array",
        items: { type: "string" },
        description: "Türkçe metinler — girişle birebir aynı sıra ve sayıda",
      },
    },
    required: ["translations"],
    additionalProperties: false,
  },
  // Hafıza [[forced-tool-array-string-wrap]]: zorlanmış tool'da model diziyi JSON-string'e
  // sarabiliyor — strict şema doğrulaması bunu keser.
  strict: true,
} as Anthropic.Tool;

/**
 * Özet çevirisi için KİMLİKLİ araç (v6.208): model her çeviriyi {n, tr} döndürür; hizalama konuma değil n'ye
 * göre yapılır (alignById). 2026-09-03 PROD ölçümü: parçaların ~%10'unda model 8 girişe 7 çeviri döndürdü
 * (`hiza:7/8`) ve konumsal kural parçanın TAMAMINI düşürüyordu — kimlikle yalnız eksik öğe düşer.
 */
const TRANSLATE_BY_ID_TOOL: Anthropic.Tool = {
  name: "submit_translations",
  description: "Verilen numaralı metinlerin Türkçe çevirilerini, HER BİRİ kendi numarasıyla (n) döndürür.",
  input_schema: {
    type: "object",
    properties: {
      translations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            n: { type: "integer", description: "girişteki sıra numarası (1'den başlar)" },
            tr: { type: "string", description: "o girişin Türkçe çevirisi" },
          },
          required: ["n", "tr"],
          additionalProperties: false,
        },
        description: "Her giriş için bir öğe — numara girişle birebir",
      },
    },
    required: ["translations"],
    additionalProperties: false,
  },
  strict: true,
} as Anthropic.Tool;

const TITLE_SYSTEM =
  "Sen tıbbi literatür çevirmenisin. Verilen makale başlıklarını Türkçeye çevirirsin. " +
  "Kurallar: tıbbi terminolojiyi Türkçe tıp dilinde karşıla; yerleşik kısaltmaları (DNA, mRNA, COVID-19, MR, BT vb.) aynen bırak; " +
  "başlık formatını koru (cümleye çevirme, açıklama ekleme, UYDURMA yok); başlık zaten Türkçeyse AYNEN döndür. " +
  "Yanıtı DAİMA submit_translations aracıyla, girişle aynı sıra ve sayıda ver.";

const SUMMARY_SYSTEM =
  "Sen tıbbi literatür çevirmenisin. Verilen makale/haber özeti GİRİŞLERİNİ Türkçeye çevirirsin. " +
  "Kurallar: tıbbi terminolojiyi Türkçe tıp dilinde karşıla; yerleşik kısaltmaları (DNA, mRNA, COVID-19, MR, BT, HR, OR vb.) ve sayısal değerleri aynen bırak; " +
  "yapılandırılmış özet etiketlerini (BACKGROUND/METHODS/RESULTS/CONCLUSIONS) Türkçe karşılıklarıyla (ARKA PLAN/YÖNTEM/BULGULAR/SONUÇ) koru; " +
  "metin bir özetin kesilmiş baş kısmı olabilir — kesik yeri TAMAMLAMA, açıklama ya da yorum EKLEME, UYDURMA yok; " +
  "metin zaten Türkçeyse AYNEN döndür. Yanıtı DAİMA submit_translations aracıyla ver: HER giriş için bir öğe, n = girişin numarası.";

/**
 * Model yanıtını giriş listesine SAF hizalar (birim testli):
 *  - sayı uyuşmazlığı → tüm batch null (kaymış hiza asla yayılmaz)
 *  - boş/boşluk çeviri → o öğe null
 *  - girişle birebir aynı metin → null (zaten Türkçe / model çeviremedi → titleOriginal yazılmaz)
 */
export function alignTranslations(titles: string[], out: unknown): (string | null)[] {
  if (!Array.isArray(out) || out.length !== titles.length) return titles.map(() => null);
  return out.map((v, i) => {
    let s = typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
    // Giriş "N. başlık" diye numaralandırılır; model numarayı çeviriye sızdırabiliyor (dry-run'da
    // ölçüldü). YALNIZ kendi sıra numarası sökülür — gerçekten "1." ile başlayan başlık korunur.
    const onek = new RegExp(`^${i + 1}[.)]\\s+`);
    s = s.replace(onek, "");
    if (!s || s === titles[i].trim()) return null;
    return s;
  });
}

/**
 * KİMLİKLİ hizalama (özet, v6.208): model {n, tr} öğeleri döndürür. Sonuç girişle aynı uzunlukta:
 *  - n eksik → o öğe undefined (yalnız o satır sonraki koşuya kalır; parça düşmez)
 *  - yinelenen n → ilki; aralık dışı / bozuk öğe → yok sayılır
 *  - boş çeviri / girişle aynı metin → null (zaten Türkçe → "işlendi")
 *  - dizi değilse (string-sarma dahil) → tümü undefined
 */
export function alignById(inputs: string[], out: unknown): (string | null | undefined)[] {
  const res: (string | null | undefined)[] = inputs.map(() => undefined);
  if (!Array.isArray(out)) return res;
  for (const item of out) {
    if (!item || typeof item !== "object") continue;
    const { n, tr } = item as { n?: unknown; tr?: unknown };
    if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > inputs.length) continue;
    const i = n - 1;
    if (res[i] !== undefined) continue;
    let s = typeof tr === "string" ? tr.replace(/\s+/g, " ").trim() : "";
    s = s.replace(new RegExp(`^${n}[.)]\\s+`), ""); // sızan numara (alignTranslations ile aynı kural)
    res[i] = !s || s === inputs[i].trim() ? null : s;
  }
  return res;
}

/**
 * Özet GİRİŞİ: metnin ilk `max` karakteri, SON TAM CÜMLEDE kesilir (sınırın yarısından erken bir cümle
 * sonu sayılmaz — tek kelimelik giriş olmasın); cümle sonu yoksa kelime sınırında kesilir ve "…" eklenir.
 * Cümle sonu = . ! ? (+ isteğe bağlı kapanış tırnağı/parantez) ardından boşluk → "0.5" / "p<0.05" bölünmez;
 * "e.g. " gibi kısaltma noktası mükemmel ayrışmaz (giriş metni için kabul edilen sınır). Birim testli.
 */
export function summaryLead(text: string, max = SUMMARY_LEAD_MAX): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  let end = -1;
  const re = /[.!?]["')\]]?\s/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cut))) end = m.index + m[0].length - 1; // noktalama (+tırnak) dahil, boşluk hariç
  if (end >= max * 0.5) return cut.slice(0, end).trimEnd();
  const sp = cut.lastIndexOf(" ");
  return `${cut.slice(0, sp > max * 0.6 ? sp : max).trimEnd()}…`;
}

/**
 * Ortak toplu çevirici. Dönen dizi girişle aynı uzunluktadır:
 *   string    → çeviri
 *   null      → TEKİL düşüş (boş yanıt / girişle aynı metin = zaten Türkçe) — öğe "işlendi" sayılabilir
 *   undefined → PARÇA düştü (API hatası / sayı uyuşmazlığı / anahtar yok) — öğeye dokunulmadı, tekrar denenebilir
 * Ayrım özet cron'u için gerekir (lib/translate-summaries): API hatasında satır işaretlenmez, sonraki gece yeniden.
 */
async function translateBatchTr(
  texts: string[],
  cfg: {
    system: string; chunk: number; maxTokens: number; sep: string;
    /** "konum" = translations: string[] (başlık) · "kimlik" = {n, tr}[] (özet, v6.208). */
    mode: "konum" | "kimlik";
    onFail?: (reason: string) => void;
  },
): Promise<(string | null | undefined)[]> {
  if (!texts.length) return [];
  if (!process.env.ANTHROPIC_API_KEY) return texts.map(() => undefined); // dormant — ağa hiç çıkmaz, masrafsız
  const client = new Anthropic();
  const out: (string | null | undefined)[] = [];
  for (let i = 0; i < texts.length; i += cfg.chunk) {
    const grup = texts.slice(i, i + cfg.chunk);
    try {
      const res = await client.messages.create({
        model: MODEL,
        max_tokens: cfg.maxTokens,
        output_config: { effort: "low" },
        system: cfg.system,
        tools: [cfg.mode === "kimlik" ? TRANSLATE_BY_ID_TOOL : TRANSLATE_TOOL],
        tool_choice: { type: "tool", name: "submit_translations" },
        messages: [{
          role: "user",
          content: grup.map((t, n) => `${n + 1}. ${t}`).join(cfg.sep),
        }],
      });
      const block = res.content.find((b) => b.type === "tool_use");
      const raw = block && block.type === "tool_use" ? (block.input as { translations?: unknown }).translations : null;
      if (cfg.mode === "kimlik") {
        if (!block) { cfg.onFail?.(`stop:${res.stop_reason ?? "?"}`); out.push(...grup.map(() => undefined)); continue; }
        const hizali = alignById(grup, raw);
        const eksik = hizali.filter((v) => v === undefined).length;
        if (eksik) cfg.onFail?.(`eksik:${eksik}/${grup.length}`); // yalnız eksik öğeler düşer, parça sürer
        out.push(...hizali);
        continue;
      }
      if (!Array.isArray(raw) || raw.length !== grup.length) {
        // Neden sayacı (PHI yok, yalnız kod): "stop:refusal" = Opus 5 güvenlik sınıflandırıcısı reddetti (araç
        // bloğu gelmez) · "hiza:N/M" = model sayıyı tutturamadı. 2026-09-03 PROD ilk koşularında parçaların
        // ~%30'u düşüyordu (DEV provasında 0) — nedeni ayırt etmeden çözüm seçilemez (refusal → fallbacks;
        // hiza → parça küçült; api → hız/yük).
        cfg.onFail?.(!block ? `stop:${res.stop_reason ?? "?"}` : `hiza:${Array.isArray(raw) ? raw.length : "-"}/${grup.length}`);
        out.push(...grup.map(() => undefined)); // hiza yok → parça düştü (kaymış hiza asla yayılmaz)
        continue;
      }
      out.push(...alignTranslations(grup, raw));
    } catch (e) {
      // "api:<HTTP durum | hata adı>" — 429/529 vb. (SDK 2 kez denedikten sonra). Fail-open: parça özgün dilde kalır.
      const st = (e as { status?: number }).status;
      cfg.onFail?.(`api:${st ?? (e instanceof Error ? e.name : "?")}`);
      out.push(...grup.map(() => undefined));
    }
  }
  return out;
}

/**
 * Başlıkları Türkçeye çevirir; sonuç dizisi girişle aynı uzunluktadır (başarısız öğe null).
 * ANTHROPIC_API_KEY yoksa ağa hiç çıkmadan null'lar döner (dormant — masrafsız).
 */
export async function translateTitlesTr(titles: string[]): Promise<(string | null)[]> {
  const out = await translateBatchTr(titles, { system: TITLE_SYSTEM, chunk: TITLE_CHUNK, maxTokens: 4096, sep: "\n", mode: "konum" });
  return out.map((t) => t ?? null);
}

/**
 * Özet GİRİŞLERİNİ (summaryLead çıktısı) Türkçeye çevirir. Üçlü sonuç (string / null / undefined) —
 * bkz. translateBatchTr; çağıran (lib/translate-summaries) null'u "işlendi", undefined'ı "sonra yeniden" sayar.
 */
export async function translateSummariesTr(
  leads: string[],
  onFail?: (reason: string) => void,
): Promise<(string | null | undefined)[]> {
  return translateBatchTr(leads, { system: SUMMARY_SYSTEM, chunk: SUMMARY_CHUNK, maxTokens: 8192, sep: "\n\n", mode: "kimlik", onFail });
}
