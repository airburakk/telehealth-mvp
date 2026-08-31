// Kapalı şehir listesi SÖZLEŞMESİ (2026-08-30) — bkz. lib/cities.ts başlık yorumu.
// Amaç: kayıt formlarındaki serbest-metin kirliliğini ("İstanbul"/"Istanbul") kaynağında
// bitirmek. Bu testler listenin yapısını ve doğrulayıcının "kanonik yazımı dayat" davranışını
// kilitler — biri gevşerse kirlilik geri döner.
import { describe, it, expect } from "vitest";
import { TR_PROVINCES, KKTC_CITIES, CITY_ABROAD, CITY_OPTIONS, isAllowedCity } from "@/lib/cities";
import { STAFF_ROLE_CONFIGS } from "@/lib/staff-application-config";

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

  it("CITY_OPTIONS düz listesi gruplu listelerle AYNI kümedir (iki yüzey ayrışamaz)", () => {
    // Başvuru formu düz listeyi, üç kayıt formu gruplu CitySelect'i kullanır. İkisi ayrışırsa
    // aynı şehir iki yüzeyde farklı yazılır ve kapalı listenin amacı ortadan kalkar.
    expect(CITY_OPTIONS).toEqual([...TR_PROVINCES, ...KKTC_CITIES, CITY_ABROAD]);
    expect(CITY_OPTIONS.every(isAllowedCity)).toBe(true);
  });
});

describe("Kurumsal başvuru — şehir alanı sözleşmesi (v6.194)", () => {
  // Alan `select` OLMAZSA sunucu doğrulayıcısı (staff-application.ts) options denetimini
  // atlar ve serbest metin geri döner — kapalı liste sessizce delinir.
  it("Sağlık Uzmanı başvurusundaki şehir alanı kapalı listeye bağlı", () => {
    const field = STAFF_ROLE_CONFIGS.HEALTH_PRO.fields.find((f) => f.key === "city");
    expect(field, "city alanı kayboldu").toBeDefined();
    expect(field!.type).toBe("select");
    expect(field!.options).toEqual(CITY_OPTIONS);
  });

  it("başka bir rolde serbest-metin şehir alanı KALMADI", () => {
    for (const [role, cfg] of Object.entries(STAFF_ROLE_CONFIGS)) {
      const free = cfg.fields.filter((f) => f.key === "city" && f.type !== "select");
      expect(free.map((f) => `${role}.${f.key}`)).toEqual([]);
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
