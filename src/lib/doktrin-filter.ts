// Doktrin — HUKUK ALAKA SÜZGECİ (v6.99, kullanıcı isteği 2026-08-15).
//
// SORUN (2026-08-15 dev ölçümü, 192 kayıt): Doktrin sekmesi hukukla ilgisiz klinik/sosyal
// çalışmalarla doluydu — "Ankilozan Spondilitli İki Olguda Zor Havayolu Yönetimi", "Kadınların
// Kooperatifleşmesi", "Üroloji Hekimlerinin Perkütan Nefrostomi Deneyimleri", hatta veteriner
// hekim şikâyet dosyaları. Kök neden doktrin-ingest.ts `matchesQuery`: sorgu ibaresini
// başlık+ÖZET+anahtar kelime BİRLEŞİMİNDE arıyordu ve HER klinik araştırmanın yöntem bölümünde
// "katılımcılardan aydınlatılmış onam alınmıştır" cümlesi geçiyor. Yani ibare süzgeci çalışıyordu,
// yanlış yerde arıyordu.
//
// ÇÖZÜM — konuma duyarlı skor (AI yok; hukuk-keywords.ts ilkesinin devamı):
//   · BAŞLIK hukukçunun bildirdiği konudur → hukuk terimi orada geçiyorsa güçlü sinyal (+3).
//   · ANAHTAR KELİME yazarın kendi etiketi → orta sinyal (+2).
//   · ÖZET rutin cümle taşır ("onam alındı", "etik kurul onayı") → zayıf (+1) ve rutin kalıp
//     yakalanırsa o terim hiç sayılmaz. Kirliliğin tamamı bu kanaldan geliyordu.
//   · DERGİ kimliği bağımsız delildir: hukuk fakültesi/baro/tıp hukuku/adli tıp dergisi (+3).
// Kabul: hukuk skoru ≥ LEGAL_MIN_SCORE **VE** tıp/sağlık bağlamı var (saf hukuk makalesi —
// kira, ticaret — Doctorium'a girmez) **VE** dışlama sinyali yok (veteriner/hayvan sağlığı).
//
// Sözlük HUKUKÇUNUN kalemidir (hukuk-keywords.ts ile aynı sözleşme): terim eklemek/çıkarmak
// burada tek satır. ⚠️ Aşırı geniş tek kelime eklenmez ("hasta", "sağlık") — her makalede geçer.
// Eşik değiştirilmeden ÖNCE scripts/temizle-doktrin.ts dry-run'ı koşulur: hangi kayıtların
// düştüğü/kaldığı başlık başlık görünür (2026-08-15'te tam liste kullanıcıya sunuldu).

/**
 * Hukuk sinyali terimleri — küçük harfle, tr-TR katlamayla, BOŞLUK NORMALİZE edilmiş metinde aranır.
 *
 * 🪤 Türkçe SONDAN eklemelidir: desen KÖK biçiminde yazılır ("tıbbi uygulama hata" → hatası/hataları/
 * hatasının hepsini yakalar). 2026-08-15 ilk dry-run'ında "tıbbi uygulama hatası" yazıldığı için
 * "Tıbbi Uygulama Hataları" başlıklı GERÇEK hukuk makaleleri eleniyordu.
 * 🪤 TR-Dizin İngilizce başlık/özet de taşır (aynı makalenin ENG varyantı) → İngilizce karşılıklar
 * ŞART: "Malpractice Education…" makalesi ilk turda skor 0 almıştı.
 */
export const LEGAL_TERMS: string[] = [
  // sorumluluk & yargılama
  "hukuk", "hukukî", "yargı", "yargıtay", "danıştay", "mahkeme", "dava", "davacı",
  "tazminat", "sorumluluk", "kusur", "ihmal", "cezai", "ceza sorumlulu", "suç duyuru",
  "bilirkişi", "arabuluculuk", "uyuşmazlık", "içtihat", "emsal karar", "temyiz", "ehliyet",
  // mevzuat
  "mevzuat", "kanun", "yönetmelik", "tebliğ", "yasal düzenleme", "hukuki düzenleme",
  "sözleşme", "borçlar hukuku", "tüketici", "ombudsman",
  // sağlık hukuku çekirdeği (kök biçim)
  "malpraktis", "tıbbi uygulama hata", "tıbbi hata", "hekim hata", "aydınlatılmış onam",
  "aydınlatma yükümlülü", "özen yükümlülü", "hasta hak", "onam form", "rıza ehliyeti",
  "tıbbi müdahale", "hekimin sorumlulu", "mesleki sorumluluk", "zorunlu sigorta",
  "defansif", "savunmacı tıp", "adli tıp", "adli rapor", "adli bilim", "tıp hukuku",
  "sağlık hukuku", "biyoetik", "tıp eti", "etik ilke", "malpractice",
  // İngilizce karşılıklar (TR-Dizin ENG varyantı)
  "medical error", "medical liability", "informed consent", "patient right", "negligence",
  "malpractice claim", "legal responsibility", "forensic", "jurisprudence", "medical law",
  "health law", "defensive medicine", "litigation", "liability",
];

/**
 * Hukuk dergisi imzaları — dergi adında geçerse yayın hukuk literatürüne aittir (bağımsız delil).
 * ⚠️ "suç"/"adalet" gibi tek kelimeler BİLİNÇLİ yok: "Uluslararası Suçlar ve Tarih" dergisindeki
 * terör makalesi 2026-08-15 ölçümünde doktrin sekmesine düşmüştü.
 */
export const LEGAL_JOURNAL_PATTERNS: string[] = [
  "hukuk fakültesi", "hukuk dergisi", "hukuk araştırmaları", "barosu dergisi", "baro dergisi",
  "barolar birliği", "tıp hukuku", "sağlık hukuku", "adli tıp", "adli bilim",
  "law review", "law journal", "journal of law", "medical law", "hukuk ve",
  // Etik-hukuk ortak dergileri (2026-08-15 dry-run: "Türkiye Klinikleri Tıp Etiği-Hukuku Tarihi
  // Dergisi" hiçbir desene takılmıyordu — alanın Türkiye'deki omurga dergilerinden biri).
  "hukuku", "tıp etiği", "medical ethics", "bioethics", "biyoetik",
];

/**
 * ÖZETTE terimi geçersiz kılan rutin kalıplar — her klinik araştırmanın yöntem/etik paragrafı.
 * Bu kalıbın etrafındaki "onam"/"etik" geçişi konu DEĞİL, prosedürdür.
 */
export const ROUTINE_PATTERNS: string[] = [
  "onam alınmıştır", "onam alındı", "onamı alınmıştır", "onamı alındı", "onamları alın",
  "onam formu imzala", "etik kurul onayı", "etik kurul izni", "etik kuruldan onay",
  "helsinki bildirgesi", "yazılı onam", "sözlü onam", "gönüllü onam",
  // İngilizce özet varyantı aynı rutini taşır (TR-Dizin kayıtları çift dillidir).
  "consent was obtained", "consent were obtained", "written informed consent",
  "ethics committee approval", "approved by the ethics", "declaration of helsinki",
];

/** Tıp/sağlık bağlamı — saf hukuk makalesi (kira, ticaret, vergi) Doctorium'a girmez. */
export const MEDICAL_CONTEXT: string[] = [
  "hekim", "doktor", "tıbbi", "tıp", "sağlık", "hasta", "hastane", "klinik", "tedavi",
  "ameliyat", "cerrah", "diş hekim", "hemşire", "ebe", "eczacı", "tanı", "teşhis",
  // "malpraktis"/"malpractice" TIBBİ bağlamın kendisidir: hukuk fakültesi dergisindeki
  // "Malpraktis Davalarında Bilirkişilik" başlığı başka tıp sözcüğü taşımaz ama tam da
  // aradığımız içeriktir (2026-08-15 birim testi bunu yakaladı).
  "malpraktis", "malpractice", "hekimlik", "medical", "health",
];

/** Kesin dışlama — insan sağlığı hukuku değil (2026-08-15: veteriner oda şikâyetleri girmişti). */
export const EXCLUDE_PATTERNS: string[] = ["veteriner", "hayvan sağlığı", "hayvan hakları", "zootekni"];

/** Kabul eşiği. 3 = tek güçlü sinyal (başlıkta hukuk terimi VEYA hukuk dergisi) yeter. */
export const LEGAL_MIN_SCORE = 3;

const TITLE_WEIGHT = 3;
const KEYWORD_WEIGHT = 2;
const ABSTRACT_WEIGHT = 1;
const JOURNAL_WEIGHT = 3;
const MAX_TITLE = 6; // tek başlıkta terim yığılması skoru şişirmesin
const MAX_KEYWORD = 4;
const MAX_ABSTRACT = 2;

/**
 * Küçük harfe katla + boşlukları tekilleştir. 🪤 Normalizasyon şart: dizin başlıkları satır sonu ve
 * ÇİFT BOŞLUK taşıyor ("Tıbbi Uygulama  Hatası İddiaları" — 2026-08-15'te bu makale eleniyordu).
 */
function fold(s: string | null | undefined): string {
  return (s ?? "").toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");
}

function hits(text: string, terms: string[]): string[] {
  return terms.filter((t) => text.includes(t));
}

export interface LegalRelevance {
  /** Toplam hukuk skoru (eşik: LEGAL_MIN_SCORE). */
  score: number;
  /** Kabul kararı — skor + tıp bağlamı + dışlama birlikte değerlendirilmiş hâli. */
  accepted: boolean;
  /** İnsan-okur gerekçe (dry-run raporu ve hata ayıklama için). */
  reason: string;
}

/**
 * Bir doktrin adayının hukuk alakasını ölçer. Girdi alanları TR-Dizin kaydından gelir; hepsi
 * opsiyoneldir (eksik alan yalnız o kanalın sinyalini sıfırlar, akışı düşürmez).
 */
export function scoreLegalRelevance(input: {
  title: string;
  abstract?: string | null;
  keywords?: string | null;
  journal?: string | null;
}): LegalRelevance {
  const title = fold(input.title);
  const keywords = fold(input.keywords);
  const journal = fold(input.journal);
  let abstract = fold(input.abstract);

  const all = `${title} ${keywords} ${abstract} ${journal}`;
  if (hits(all, EXCLUDE_PATTERNS).length) {
    return { score: 0, accepted: false, reason: "dışlandı: veteriner/hayvan sağlığı" };
  }

  // Rutin kalıp varsa ÖZET kanalı tamamen susar: o metindeki "onam"/"etik" geçişi prosedürdür,
  // konu değildir. (Kirliliğin tek büyük kaynağı buydu — ağırlığı düşürmek yetmiyor, susturmak gerekiyor.)
  const routine = hits(abstract, ROUTINE_PATTERNS);
  if (routine.length) abstract = "";

  const t = hits(title, LEGAL_TERMS);
  const k = hits(keywords, LEGAL_TERMS);
  const a = hits(abstract, LEGAL_TERMS);
  const j = hits(journal, LEGAL_JOURNAL_PATTERNS);

  const score =
    Math.min(t.length * TITLE_WEIGHT, MAX_TITLE) +
    Math.min(k.length * KEYWORD_WEIGHT, MAX_KEYWORD) +
    Math.min(a.length * ABSTRACT_WEIGHT, MAX_ABSTRACT) +
    (j.length ? JOURNAL_WEIGHT : 0);

  const medical = hits(`${title} ${keywords} ${abstract} ${journal}`, MEDICAL_CONTEXT);
  if (score < LEGAL_MIN_SCORE) {
    return {
      score,
      accepted: false,
      reason: `hukuk sinyali zayıf (skor ${score}<${LEGAL_MIN_SCORE}${routine.length ? "; özet rutin onam/etik kalıbı taşıyor" : ""})`,
    };
  }
  if (!medical.length) {
    return { score, accepted: false, reason: `tıp bağlamı yok (skor ${score}, saf hukuk metni)` };
  }
  return {
    score,
    accepted: true,
    reason: `başlık[${t.slice(0, 3).join("/") || "-"}] anahtar[${k.slice(0, 2).join("/") || "-"}] özet[${a.slice(0, 2).join("/") || "-"}] dergi[${j[0] ?? "-"}]`,
  };
}
