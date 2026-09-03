// Akademik başlık çevirisi — hiza güvenliği sözleşmeleri (2026-08-31).
//
// Kilitlenen ilke: yanlış eşleşmiş çeviri, İngilizce kalmış başlıktan KÖTÜDÜR. Model beklenen
// sayıda çeviri döndürmezse batch'in tamamı düşer (kaymış hiza asla yayılmaz); tekil bozukluklar
// (boş string, girişle aynı metin) yalnız o öğeyi düşürür.
import { describe, it, expect } from "vitest";
import { alignTranslations, alignById, summaryLead } from "@/lib/translate-news";

const T = ["Alpha study", "Beta trial"];

describe("alignTranslations: hiza güvenliği", () => {
  it("birebir hizalı yanıt aynen geçer", () => {
    expect(alignTranslations(T, ["Alfa çalışması", "Beta denemesi"])).toEqual(["Alfa çalışması", "Beta denemesi"]);
  });
  it("sayı uyuşmazlığı TÜM batch'i düşürür (kaymış hiza yayılmaz)", () => {
    expect(alignTranslations(T, ["Alfa çalışması"])).toEqual([null, null]);
    expect(alignTranslations(T, ["a", "b", "c"])).toEqual([null, null]);
  });
  it("dizi olmayan yanıt (string-sarma dahil) tüm batch'i düşürür", () => {
    expect(alignTranslations(T, '["Alfa","Beta"]')).toEqual([null, null]);
    expect(alignTranslations(T, null)).toEqual([null, null]);
  });
  it("boş/boşluk çeviri yalnız o öğeyi düşürür", () => {
    expect(alignTranslations(T, ["  ", "Beta denemesi"])).toEqual([null, "Beta denemesi"]);
  });
  it("girişle aynı metin null olur — zaten Türkçe başlığa titleOriginal yazılmaz", () => {
    expect(alignTranslations(["Türkçe başlık"], ["Türkçe başlık"])).toEqual([null]);
  });
  it("fazla boşluklar tek boşluğa iner (kart/e-posta yüzeyleri temiz kalır)", () => {
    expect(alignTranslations(["X"], ["Alfa   çalışması\n"])).toEqual(["Alfa çalışması"]);
  });
  it("modelin sızdırdığı sıra numarası sökülür — yalnız KENDİ numarası (dry-run'da ölçülen kusur)", () => {
    expect(alignTranslations(T, ["1. Alfa çalışması", "2) Beta denemesi"])).toEqual(["Alfa çalışması", "Beta denemesi"]);
    // ikinci öğede "1." öneki o öğenin numarası DEĞİL → korunur
    expect(alignTranslations(T, ["1. Alfa", "1. Tip Diyabet"])).toEqual(["Alfa", "1. Tip Diyabet"]);
  });
});

// v6.206 — özet GİRİŞİ kesimi: çevrilen metin cümle sınırında biter; sayı/kısaltma noktası sınır sayılmaz.
describe("summaryLead: özet girişi kesimi", () => {
  it("sınırın altındaki metin aynen geçer (boşluklar normalize)", () => {
    expect(summaryLead("  Kısa   özet.\n", 100)).toBe("Kısa özet.");
  });
  it("uzun metin SON TAM cümlede kesilir — üç nokta eklenmez (cümle bütün)", () => {
    const t = "Birinci cümle burada. İkinci cümle de burada. Üçüncü cümle çok uzun ve sınırı aşar.";
    expect(summaryLead(t, 50)).toBe("Birinci cümle burada. İkinci cümle de burada.");
  });
  it("cümle sınırı yoksa kelime sınırında kesilir ve … eklenir", () => {
    const t = "Bu cümlede hiç nokta yok ve kelimeler uzayıp gidiyor sonuna kadar";
    expect(summaryLead(t, 30)).toBe("Bu cümlede hiç nokta yok ve…");
  });
  it("cümle sınırı çok erkense (sınırın yarısından önce) kelime kesimi tercih edilir", () => {
    const t = "Kısa. Sonra noktasız uzun bir metin gelir ve sınırı aşar";
    expect(summaryLead(t, 40)).toBe("Kısa. Sonra noktasız uzun bir metin…");
  });
  it("kapanış tırnağı cümle sonuna dahil edilir", () => {
    const t = 'He said "Done." Then more text follows here.';
    expect(summaryLead(t, 30)).toBe('He said "Done."');
  });
  it("ondalık sayı noktası cümle sınırı DEĞİLDİR (0.5 bölünmez)", () => {
    const t = "Oran 0.5 idi ve sonra devam eden uzun bir cümle geldi burada";
    expect(summaryLead(t, 30)).toBe("Oran 0.5 idi ve sonra devam…");
  });
});

// v6.208 — KİMLİKLİ hizalama (özet): PROD'da model 8 girişe 7 çeviri döndürüyordu (`hiza:7/8`) ve konumsal
// kural parçanın tamamını düşürüyordu. Kimlikle yalnız eksik öğe düşer; kaymış hiza yine imkânsızdır (n esas).
describe("alignById: kimlikli hizalama", () => {
  const IN = ["Alpha study", "Beta trial", "Gamma review"];
  it("sıra karışık gelse de n'ye göre yerleşir", () => {
    expect(alignById(IN, [{ n: 3, tr: "Gama derleme" }, { n: 1, tr: "Alfa çalışması" }, { n: 2, tr: "Beta denemesi" }]))
      .toEqual(["Alfa çalışması", "Beta denemesi", "Gama derleme"]);
  });
  it("eksik n YALNIZ o öğeyi düşürür (undefined) — parça sürer", () => {
    expect(alignById(IN, [{ n: 1, tr: "Alfa çalışması" }, { n: 3, tr: "Gama derleme" }]))
      .toEqual(["Alfa çalışması", undefined, "Gama derleme"]);
  });
  it("yinelenen n'de ilki kalır; aralık dışı ve bozuk öğeler yok sayılır", () => {
    expect(alignById(IN, [{ n: 2, tr: "Beta denemesi" }, { n: 2, tr: "BAŞKA" }, { n: 9, tr: "x" }, null, { n: "1", tr: "y" }]))
      .toEqual([undefined, "Beta denemesi", undefined]);
  });
  it("dizi olmayan yanıt (string-sarma dahil) tümünü düşürür", () => {
    expect(alignById(IN, '[{"n":1,"tr":"Alfa"}]')).toEqual([undefined, undefined, undefined]);
  });
  it("boş çeviri ve girişle aynı metin null (zaten Türkçe → işlendi); sızan numara sökülür", () => {
    expect(alignById(["Türkçe özet", "Beta trial"], [{ n: 1, tr: "Türkçe özet" }, { n: 2, tr: "2. Beta denemesi" }]))
      .toEqual([null, "Beta denemesi"]);
    expect(alignById(["X"], [{ n: 1, tr: "   " }])).toEqual([null]);
  });
});
