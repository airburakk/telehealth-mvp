// Kapalı şehir listesi SÖZLEŞMESİ (2026-08-30) — bkz. lib/cities.ts başlık yorumu.
// Amaç: kayıt formlarındaki serbest-metin kirliliğini ("İstanbul"/"Istanbul") kaynağında
// bitirmek. Bu testler listenin yapısını ve doğrulayıcının "kanonik yazımı dayat" davranışını
// kilitler — biri gevşerse kirlilik geri döner.
import { describe, it, expect } from "vitest";
import { TR_PROVINCES, KKTC_CITIES, CITY_ABROAD, isAllowedCity } from "@/lib/cities";

describe("Şehir listesi — yapısal sözleşme", () => {
  it("Türkiye tam 81 il (eksik il o ilin doktorunu bloke eder, fazlası uydurmadır)", () => {
    expect(TR_PROVINCES.length).toBe(81);
  });

  it("listelerde yinelenen ad yok (select'te çift satır + sayımda bölünme olurdu)", () => {
    const all = [...TR_PROVINCES, ...KKTC_CITIES, CITY_ABROAD];
    expect(new Set(all).size).toBe(all.length);
  });

  it("hiçbir kayıt baş/son boşluk taşımaz (trim'li sunucu karşılaştırması sessizce düşerdi)", () => {
    for (const c of [...TR_PROVINCES, ...KKTC_CITIES, CITY_ABROAD]) {
      expect(c, c).toBe(c.trim());
      expect(c.length).toBeGreaterThan(1);
    }
  });
});

describe("isAllowedCity — kanonik yazım dayatması", () => {
  it("kanonik yazımları kabul eder (il + KKTC + yurt dışı)", () => {
    expect(isAllowedCity("İstanbul")).toBe(true);
    expect(isAllowedCity("Şanlıurfa")).toBe(true);
    expect(isAllowedCity("Lefkoşa")).toBe(true);
    expect(isAllowedCity(CITY_ABROAD)).toBe(true);
  });

  it("kanonik OLMAYAN yazımları reddeder — katlama yapılsaydı kirlilik DB'ye geri dönerdi", () => {
    expect(isAllowedCity("Istanbul")).toBe(false); // ASCII I — kirliliğin ana örneği
    expect(isAllowedCity("istanbul")).toBe(false);
    expect(isAllowedCity("izmir")).toBe(false);
    expect(isAllowedCity(" İstanbul")).toBe(false); // trim çağıranın işi (route'lar trim'liyor)
  });

  it("serbest metni ve boşu reddeder (curl ile eski davranışa dönüş kapalı)", () => {
    expect(isAllowedCity("")).toBe(false);
    expect(isAllowedCity("Almanya/Berlin")).toBe(false);
    expect(isAllowedCity("Test City")).toBe(false);
  });
});
