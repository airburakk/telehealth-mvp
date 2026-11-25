// Karusel editoryal — İÇTİHAT ŞABLONU (2026-11-25 · 👤 "normal günlük seçkideki çözümü bul karusele uyarla").
// KAYNAK: infra/kart/karusel/editoryal/ictihat.py — BİREBİR çeviri; eşlik fikstürü tests/unit/karusel-ictihat-eslik.json.
//
// Neden şablon: Yargıtay kararının kalıcı bağlantısı yok (hukuk-ingest url: null) ve ham karar metni kamuya ÇIKMAZ
// (anonimleştirme kusurlu — social-digest 🔒 kuralı). Sabah kartı bu yüzden kararı yalnız künye + sözlükten türeyen
// "Konu: … Dayanak: …" satırıyla çizer (lib/social-digest ictihatTopicLine). Karusel AYNI yolu izler: içtihat öğesine
// model METİN YAZMAZ, kaynak sayfa ÇEKİLMEZ; dört alan edisyondaki künye + konu satırından DETERMİNİSTİK kurulur.
// Böylece "kim kazandı" gibi bir yorum üretilemez (İçerik Takvimi: çıkarımı İNSAN yazar). Kapılar yine koşar; ikinci
// model doğrulaması yerine kalite kapısı (kalite_kapisi.py) metni bu fonksiyonla YENİDEN ÜRETİP birebir karşılaştırır.
import type { Taslak } from "./kapilar";

/** Seçki ucunun akış anahtarı (social-digest STREAMS) — taze ya da "Arşivden İçtihat" fark etmez. */
export const ICTIHAT_STREAM = "ictihat";

export const ICTIHAT_NOTU =
  "Karar metni kişisel veri içerebildiği için paylaşılmaz; tam metne Yargıtay karar arama sisteminden esas ve karar numarasıyla ulaşılabilir.";

const KAYNAK_ONEKI = "Yargıtay — ";
const KAPAK_SINIR = 44;
const DECK_MIN = 30;
const DECK_SINIR = 125;
const BASLIK_SINIR = 72;
const OZET_SINIR = 270;

export type IctihatOgesi = {
  stream?: string | null;
  title: string;
  sourceName: string;
  summaryLong?: string | null;
  summaryLongFallback?: boolean | null;
};

const cp = (s: string) => [...s].length;

export function ictihatMi(item: { stream?: string | null }): boolean {
  return item.stream === ICTIHAT_STREAM;
}

/** "Konu: A, B. Dayanak: TBK m.56." → { konu: "A, B", satir: tüm satır }. Yedek cümle konu bilgisi değildir. */
function konuSatiri(item: IctihatOgesi): { konu: string; satir: string } {
  const satir = item.summaryLongFallback ? "" : (item.summaryLong ?? "").trim();
  const m = /^Konu: ([^.]+)\./u.exec(satir);
  return { konu: m ? m[1].trim() : "", satir };
}

export function ictihatTaslagi(item: IctihatOgesi): Taslak {
  const daire = item.sourceName.startsWith(KAYNAK_ONEKI) ? item.sourceName.slice(KAYNAK_ONEKI.length).trim() : "";
  const kapakDaire = `Yargıtay ${daire} kararı`;
  const coverTitle = daire && cp(kapakDaire) <= KAPAK_SINIR ? kapakDaire : "Yargıtay kararı";

  const { konu, satir } = konuSatiri(item);
  let coverDeck = konu ? `Konu: ${konu}.` : "Künyesi haber kartında yer alan bir Yargıtay kararı.";
  if (cp(coverDeck) < DECK_MIN) coverDeck += " Künyesi haber kartında.";
  if (cp(coverDeck) > DECK_SINIR) coverDeck = "Künyesi haber kartında yer alan bir Yargıtay kararı.";

  let detailTitle = item.title.trim();
  if (cp(detailTitle) > BASLIK_SINIR) detailTitle = detailTitle.replace(" Hukuk Dairesi", " HD").replace(" Ceza Dairesi", " CD");

  const giris = satir || `${coverTitle}.`;
  let detailSummary = `${giris} ${ICTIHAT_NOTU}`;
  if (cp(detailSummary) > OZET_SINIR && konu) detailSummary = `Konu: ${konu}. ${ICTIHAT_NOTU}`;
  return { coverTitle, coverDeck, detailTitle, detailSummary };
}
