// Akademik başlık çevirisi — hiza güvenliği sözleşmeleri (2026-08-31).
//
// Kilitlenen ilke: yanlış eşleşmiş çeviri, İngilizce kalmış başlıktan KÖTÜDÜR. Model beklenen
// sayıda çeviri döndürmezse batch'in tamamı düşer (kaymış hiza asla yayılmaz); tekil bozukluklar
// (boş string, girişle aynı metin) yalnız o öğeyi düşürür.
import { describe, it, expect } from "vitest";
import { alignTranslations } from "@/lib/translate-news";

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
