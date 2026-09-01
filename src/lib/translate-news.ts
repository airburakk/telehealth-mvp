// Akademik başlık çevirisi (2026-08-31, kullanıcı kararı: "bültende İngilizce başlık olmasın").
//
// KÖK SORUN: şemadaki `NewsArticle.titleOriginal` alanı v6.48'den beri duruyordu ama HİÇBİR kod
// doldurmuyordu — "çevrilmişse Türkçe" tasarım niyeti kodda karşılıksızdı; PubMed/EPMC/DOAJ
// başlıkları İngilizce yazılıyordu. Bu modül o hattı kurar: ingest, create'ten önce başlıkları
// TOPLU çevirir → title=Türkçe, titleOriginal=özgün. Portal + Post + sosyal bülten birden düzelir.
//
// FAIL-OPEN: anahtar yoksa / API hata verirse / yanıt hizasızsa null döner ve çağıran ORİJİNAL
// başlığı yazar — çeviri hattı içerik boru hattını ASLA kurutamaz (ingest disipliniyle aynı).
// Eşleşme güvenliği: model N başlığa N çeviri döndürmezse batch'in TAMAMI null sayılır —
// kaymış hizayla yanlış başlık basmaktansa İngilizce kalması yeğdir (alignTranslations, birim testli).
// İçerik PHI DEĞİLDİR (açık literatür başlığı) — AI'a gitmesi serbest (asla-loglama gerekmez).
import Anthropic from "@anthropic-ai/sdk";

// Basit yüksek-hacim iş: düşük efor yeterli (çeviri başına ~2 sn, gece cron'unda koşar).
const MODEL = "claude-opus-5";
const CHUNK = 20; // istek başına başlık — tek istekte tüm gece toplu, hiza riski küçük tutulur

const TRANSLATE_TOOL: Anthropic.Tool = {
  name: "submit_translations",
  description: "Verilen makale başlıklarının Türkçe çevirilerini, AYNI SIRADA ve AYNI SAYIDA döndürür.",
  input_schema: {
    type: "object",
    properties: {
      translations: {
        type: "array",
        items: { type: "string" },
        description: "Türkçe başlıklar — girişle birebir aynı sıra ve sayıda",
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
 * Başlıkları Türkçeye çevirir; sonuç dizisi girişle aynı uzunluktadır (başarısız öğe null).
 * ANTHROPIC_API_KEY yoksa ağa hiç çıkmadan null'lar döner (dormant — masrafsız).
 */
export async function translateTitlesTr(titles: string[]): Promise<(string | null)[]> {
  if (!titles.length) return [];
  if (!process.env.ANTHROPIC_API_KEY) return titles.map(() => null);
  const client = new Anthropic();
  const out: (string | null)[] = [];
  for (let i = 0; i < titles.length; i += CHUNK) {
    const grup = titles.slice(i, i + CHUNK);
    try {
      const res = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        output_config: { effort: "low" },
        system:
          "Sen tıbbi literatür çevirmenisin. Verilen makale başlıklarını Türkçeye çevirirsin. " +
          "Kurallar: tıbbi terminolojiyi Türkçe tıp dilinde karşıla; yerleşik kısaltmaları (DNA, mRNA, COVID-19, MR, BT vb.) aynen bırak; " +
          "başlık formatını koru (cümleye çevirme, açıklama ekleme, UYDURMA yok); başlık zaten Türkçeyse AYNEN döndür. " +
          "Yanıtı DAİMA submit_translations aracıyla, girişle aynı sıra ve sayıda ver.",
        tools: [TRANSLATE_TOOL],
        tool_choice: { type: "tool", name: "submit_translations" },
        messages: [{
          role: "user",
          content: grup.map((t, n) => `${n + 1}. ${t}`).join("\n"),
        }],
      });
      const block = res.content.find((b) => b.type === "tool_use");
      const raw = block && block.type === "tool_use" ? (block.input as { translations?: unknown }).translations : null;
      out.push(...alignTranslations(grup, raw));
    } catch {
      out.push(...grup.map(() => null)); // fail-open: bu grup İngilizce kalır, boru hattı sürer
    }
  }
  return out;
}
