// Akademik başlık çevirisi — hiza güvenliği sözleşmeleri (2026-08-31).
//
// Kilitlenen ilke: yanlış eşleşmiş çeviri, İngilizce kalmış başlıktan KÖTÜDÜR. Model beklenen
// sayıda çeviri döndürmezse batch'in tamamı düşer (kaymış hiza asla yayılmaz); tekil bozukluklar
// (boş string, girişle aynı metin) yalnız o öğeyi düşürür.
import { describe, it, expect } from "vitest";
import { alignTranslations, summaryLead } from "@/lib/translate-news";

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
