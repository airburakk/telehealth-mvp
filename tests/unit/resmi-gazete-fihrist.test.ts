// Resmî Gazete ana sayfa fihristi — başlık temizliği sözleşmesi (2026-09-02).
//
// Kilitlenen kusur: 02.09.2026 sabah bülteninde mevzuat başlığı "…Dair Yönetmelik İLÂN BÖLÜMÜ"
// çıktı. Ayrıştırıcı fihrist bloğunu bir SONRAKİ kaleme kadar okuyor, arada kalan bölüm başlığını
// (`card-title` — "İLÂN BÖLÜMÜ") ve sayfa altı tanıtım metnini başlığa yapıştırıyordu.
// Fixture, canlı HTML'in (2026-09-02) birebir yapısıdır — kurgusal örnek aynı kusuru yakalamazdı.
import { describe, it, expect } from "vitest";
import { parseGazetteTodayHtml, stripGazetteSectionSuffix } from "@/lib/doctorium-sources";

const USAK =
  "Uşak Üniversitesi Diş Hekimliği Fakültesi Eğitim-Öğretim ve Sınav Yönetmeliğinde Değişiklik Yapılmasına Dair Yönetmelik";
const TOROS =
  "Toros Üniversitesi Yenilenebilir Enerji Teknolojileri Eğitimi Uygulama ve Araştırma Merkezi Yönetmeliğinde Değişiklik Yapılmasına Dair Yönetmelik";
const TCMB = "T.C. Merkez Bankasınca Belirlenen Döviz Kurları ve Devlet İç Borçlanma Senetlerinin Günlük Değerleri";

// Not: canlı sayfada TCMB kalemi /ilanlar/ altındadır (fihrist süzgeci dışı); burada /eskiler/
// altına alındı ki "sayfa altı metni SON kaleme yapışır" kusuru da kapsansın.
const HTML = `
<div class="card-title html-title" tabindex='0'> YÜRÜTME VE İDARE BÖLÜMÜ </div>
<div class="fihrist-item mb-1"><a href="https://www.resmigazete.gov.tr/eskiler/2026/09/20260902-3.htm" data-modal="True">–– ${TOROS}</a></div>
<div class="fihrist-item mb-1"><a href="https://www.resmigazete.gov.tr/eskiler/2026/09/20260902-4.htm" data-modal="True">–– ${USAK}</a></div>
<div class="card-title html-title" tabindex='0'> İLÂN BÖLÜMÜ </div>
<div class="fihrist-item mb-1"><a href="https://www.resmigazete.gov.tr/ilanlar/eskiilanlar/2026/09/20260902-2.htm" data-modal="True">a - Yargı İlânları</a></div>
<div class="fihrist-item mb-1"><a href="https://www.resmigazete.gov.tr/eskiler/2026/09/20260902-9.htm" data-modal="True">– ${TCMB}</a></div><hr>Resmî Gazete'nin kurumsal mobil uygulaması Android ve Apple marketlerde "T.C. Resmî Gazete" adıyla yerini almıştır.<hr> </div>
`;

describe("parseGazetteTodayHtml: fihrist kalemi = bağlantı metni, artık yapışmaz", () => {
  const items = parseGazetteTodayHtml(HTML);

  it("yalnız /eskiler/ kalemleri alınır, ilan bölümü bağlantıları süzülür", () => {
    expect(items.map((i) => i.id)).toEqual(["20260902-3.htm", "20260902-4.htm", "20260902-9.htm"]);
  });

  it("bölümün son kalemine card-title başlığı ('İLÂN BÖLÜMÜ') YAPIŞMAZ — bültende görülen kusur", () => {
    expect(items[1].title).toBe(USAK);
    expect(items[0].title).toBe(TOROS);
  });

  it("sayfanın son kalemine alt tanıtım metni yapışmaz; '––' öneki sökülür", () => {
    expect(items[2].title).toBe(TCMB);
    for (const i of items) expect(i.title.startsWith("–")).toBe(false);
  });

  it("aynı dosya iki kez listelenirse tek kalem döner (idempotent id)", () => {
    const twice = parseGazetteTodayHtml(HTML + HTML);
    expect(twice.map((i) => i.id)).toEqual(["20260902-3.htm", "20260902-4.htm", "20260902-9.htm"]);
  });
});

describe("stripGazetteSectionSuffix: eski kayıtların onarımı (ingest-tr-sources 'başlık onarımı')", () => {
  it("bölüm başlığı SONEK olarak sökülür", () => {
    expect(stripGazetteSectionSuffix(`${USAK} İLÂN BÖLÜMÜ`)).toBe(USAK);
    expect(stripGazetteSectionSuffix(`${USAK} YARGI BÖLÜMÜ`)).toBe(USAK);
    expect(stripGazetteSectionSuffix(`${USAK} YÜRÜTME VE İDARE BÖLÜMÜ`)).toBe(USAK);
  });
  it("üst üste yapışmış birden fazla bölüm başlığı da sökülür", () => {
    expect(stripGazetteSectionSuffix(`${USAK} YARGI BÖLÜMÜ İLÂN BÖLÜMÜ`)).toBe(USAK);
  });
  it("sayfa altı tanıtım metni sökülür", () => {
    expect(stripGazetteSectionSuffix(`${TCMB} Resmî Gazete'nin kurumsal mobil uygulaması Android ve Apple marketlerde yerini almıştır.`)).toBe(TCMB);
  });
  it("başlığın ORTASINDAKİ 'Bölümü' kelimesine ve temiz başlığa dokunulmaz (idempotent)", () => {
    const t = "Sağlık Bilimleri Fakültesi Hemşirelik Bölümü Yönetmeliğinde Değişiklik Yapılmasına Dair Yönetmelik";
    expect(stripGazetteSectionSuffix(t)).toBe(t);
    expect(stripGazetteSectionSuffix(USAK)).toBe(USAK);
  });
});
