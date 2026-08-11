// Hukuk/İçtihat — deterministik çıkarım sözleşmeleri (v6.87). Örnek kesitler 2026-08-06'da
// çekilen GERÇEK Yargıtay kararlarından (12. CD 2014/9296 · 3. HD 2024/2458) kısaltılarak alındı;
// desenler bu gerçek biçimlere karşı kilitlenir (uydurma test metniyle kendini kandırma olmasın).
import { describe, it, expect } from "vitest";
import {
  HUKUK_KEYWORDS, keywordByKey, extractKeywords, extractLawRefs, extractExcerpt,
} from "@/lib/hukuk-keywords";

const CEZA_KESIT = `12. Ceza Dairesi 2014/9296 E. , 2015/5790 K.
"İçtihat Metni"
Mahkemesi :Asliye Ceza Mahkemesi
Suç : Taksirle öldürme
Hüküm : TCK'nın 85/1, 62, 50/4-1a, 52/2-4. maddeleri gereğince mahkumiyet
... İhtisas Kurulu'nun 27/10/2010 tarihli raporunda; ... meydana gelen ölümle tedavi ve teşhisteki
eksiklik arasında illiyet bağı bulunması halinde bunun komplikasyon olarak değil malpraktis olarak
değerlendirilmesi gerektiği ... 5271 sayılı CMK'nın 232/6. maddesine ve TCK'nın 52/3. maddelerine
aykırı davranılması ... 5320 sayılı Kanunun 8. maddesi gereğince ...`;

const HUKUK_KESIT = `3. Hukuk Dairesi 2024/2458 E. , 2025/1975 K.
"İçtihat Metni" MAHKEMESİ : Samsun Bölge Adliye Mahkemesi 5. Hukuk Dairesi
SAYISI : 2024/504 E., 2024/894 K.
I. DAVA
Davacı vekili; müvekkilinin sol koltuk altında küçük bir kistin tedavisi için davalı hastaneye
müracaat ettiğini, hatalı tanı ve bu tanıya dayalı ameliyat nedeniyle zarar gördüğünü ileri sürerek
100,00 TL maddi tazminat, 250.000,00 TL manevi tazminatın davalıdan tahsiline karar verilmesini
talep etmiştir. Taraflar arasındaki ilişki vekalet sözleşmesidir; 6098 sayılı Türk Borçlar
Kanunu'nun 49 uncu maddesi ve 818 sayılı BK.nun 41. maddesi uyarınca hekimin özen yükümlülüğü
kapsamında bilirkişi raporu alınmıştır.
II. CEVAP
Davalı vekili; davanın reddini istemiştir.`;

describe("sözlük disiplini", () => {
  it("desenler küçük harf (karşılaştırma tr-TR lower ile yapılır — büyük desen asla eşleşmez)", () => {
    for (const kw of HUKUK_KEYWORDS) {
      for (const p of kw.patterns) expect(p, `${kw.key}: ${p}`).toBe(p.toLocaleLowerCase("tr-TR"));
    }
  });
  it("key'ler benzersiz (URL kimliği çakışmaz)", () => {
    const keys = HUKUK_KEYWORDS.map((k) => k.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("keywordByKey bilinmeyen/boş değeri null yapar (filtresiz liste — URL kurcalanması kırmaz)", () => {
    expect(keywordByKey("malpraktis")?.label).toBe("Malpraktis");
    expect(keywordByKey("yok-boyle")).toBeNull();
    expect(keywordByKey(undefined)).toBeNull();
  });
});

describe("extractKeywords — gerçek kesitlere karşı", () => {
  it("ceza kararı: taksir + komplikasyon + malpraktis + bilirkişi (İhtisas Kurulu) yakalanır", () => {
    const keys = extractKeywords(CEZA_KESIT, 10).map((k) => k.key);
    expect(keys).toEqual(expect.arrayContaining(["malpraktis", "komplikasyon", "bilirkisi", "taksir"]));
  });
  it("hukuk kararı: yanlış tanı + tazminat + manevi tazminat + vekâlet + özen yükümlülüğü", () => {
    const keys = extractKeywords(HUKUK_KESIT, 10).map((k) => k.key);
    expect(keys).toEqual(
      expect.arrayContaining(["yanlis-tedavi", "tazminat", "manevi-tazminat", "vekalet", "ozen-yukumlulugu", "bilirkisi"]),
    );
  });
  it("limit çip enflasyonunu keser", () => {
    expect(extractKeywords(HUKUK_KESIT, 2)).toHaveLength(2);
  });
  it("BÜYÜK harfli metinde de eşleşir (tr-TR katlama: İ→i)", () => {
    expect(extractKeywords("TIBBİ MALPRAKTİS NEDENİYLE TAZMİNAT", 10).map((k) => k.key))
      .toEqual(expect.arrayContaining(["malpraktis", "tazminat"]));
  });
});

describe("extractLawRefs — gerçek atıf biçimleri", () => {
  it('"TCK\'nın 85/1" normalize edilir; CMK 232 (gerekçe usulü) çip OLMAZ', () => {
    const refs = extractLawRefs(CEZA_KESIT);
    expect(refs).toContain("TCK m.85/1");
    expect(refs).toContain("TCK m.52/3"); // esasa dair ikinci atıf da yakalanır
    expect(refs.every((r) => !r.startsWith("CMK m.232"))).toBe(true);
  });
  it('"6098 sayılı ... Kanunu\'nun 49 uncu maddesi" → TBK m.49 · "818 sayılı BK.nun 41" → BK m.41', () => {
    const refs = extractLawRefs(HUKUK_KESIT);
    expect(refs).toContain("TBK m.49");
    expect(refs).toContain("BK m.41");
  });
  it('dosya numarası satırları ("SAYISI : 2024/504") kanun maddesi SANILMAZ', () => {
    const refs = extractLawRefs(HUKUK_KESIT);
    for (const r of refs) expect(r).not.toMatch(/2024|2025/);
  });
  it("tekrarsız ve limitli", () => {
    const refs = extractLawRefs(`${CEZA_KESIT}\n${CEZA_KESIT}\n${HUKUK_KESIT}`);
    expect(new Set(refs).size).toBe(refs.length);
    expect(refs.length).toBeLessThanOrEqual(4);
  });

  it("temyiz USUL maddeleri çip OLMAZ (HMK m.370/1 her kararda geçer — gürültü; esas maddeler kalır)", () => {
    const refs = extractLawRefs(
      "TBK'nın 49. maddesi uyarınca ... HMK'nın 370/1 inci maddesi gereğince ONANMASINA, HMK'nın 371. maddesi ...",
    );
    expect(refs).toContain("TBK m.49");
    expect(refs.every((r) => !r.startsWith("HMK m.370") && !r.startsWith("HMK m.371"))).toBe(true);
  });
});

describe("extractExcerpt — kart alıntısı (AI'sız özet; kullanıcı kararı 2026-08-06)", () => {
  it("ceza kararında Suç + Hüküm satırları birleşir (en bilgilendirici özet)", () => {
    const e = extractExcerpt(CEZA_KESIT);
    expect(e).toContain("Suç: Taksirle öldürme");
    expect(e).toContain("Hüküm:");
  });
  it('hukuk kararında "I. DAVA" bölümünün başı alınır (mahkeme/sayı künyesi atlanır)', () => {
    const e = extractExcerpt(HUKUK_KESIT);
    expect(e.startsWith("Davacı vekili;")).toBe(true);
    expect(e).not.toContain("MAHKEMESİ");
  });
  it("uzun metin '…' ile kesilir ve tavanı aşmaz", () => {
    const e = extractExcerpt(HUKUK_KESIT, 120);
    expect(e.endsWith("…")).toBe(true);
    expect(e.length).toBeLessThanOrEqual(120);
  });
  it("boş/başlıksız metin çökmez", () => {
    expect(extractExcerpt("")).toBe("");
  });

  it('yeni format (2024+) "Uyuşmazlık, … ilişkindir." cümlesi öncelik alır (en damıtılmış özet)', () => {
    const e = extractExcerpt(
      "II. UYUŞMAZLIK\nUyuşmazlık, hekim hatasına dayalı maddi ve manevi tazminat istemine ilişkindir.\nIII. GEREKÇE ...",
    );
    expect(e).toBe("Uyuşmazlık, hekim hatasına dayalı maddi ve manevi tazminat istemine ilişkindir.");
  });
});
