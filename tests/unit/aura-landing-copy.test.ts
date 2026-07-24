// aura-landing/copy — 9 dil landing sözlüğü bütünlüğü (v5.9.1, 2026-07-12; bg 2026-07-23).
// Emekli landing-copy.test.ts'in yerini alır (PortamedLanding ölü kodla birlikte silindi);
// aynı yapısal-asimetri korumasını CANLI aura landing sözlüğüne uygular: yeni dil eklenirken/
// metin değişirken eksik çeviri veya dizi-boyu kayması (chapters/hiw adımları) derlemede değil
// burada yakalanır. air_lang dil-adı↔kod köprüsü de korunur (landing↔hasta yüzeyi dil taşıması).
import { describe, it, expect } from "vitest";
import { COPY, LANGS, LANG_CODES, langDir, type Lang } from "@/lib/aura-landing/copy";
import { LANGUAGES, LANG_NAME_BY_CODE, langCodeFor } from "@/lib/constants";

// İç içe anahtar kümesini düzleştir (dizilerde uzunluk da imzaya girer).
function shape(o: unknown, prefix = ""): string[] {
  if (Array.isArray(o)) return [`${prefix}[${o.length}]`, ...o.flatMap((v, i) => shape(v, `${prefix}[${i}]`))];
  if (o && typeof o === "object") {
    return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => shape(v, prefix ? `${prefix}.${k}` : k));
  }
  return [`${prefix}:${typeof o}`];
}

describe("aura-landing/copy", () => {
  it("9 locale tanımlı ve COPY ile birebir örtüşür", () => {
    expect(LANG_CODES).toEqual(["en", "tr", "de", "fr", "ru", "ar", "fa", "az", "bg"]);
    expect(Object.keys(COPY).sort()).toEqual([...LANG_CODES].sort());
  });

  it("tüm locale'lerin yapı imzası EN ile birebir aynı (eksik/fazla anahtar veya dizi boyu yok)", () => {
    // EN birincil (landing EN-first): referans yapı imzası.
    const ref = shape(COPY.en).sort();
    for (const code of LANG_CODES) {
      expect(shape(COPY[code]).sort(), `locale=${code}`).toEqual(ref);
    }
  });

  // NOT: "hiçbir metin boş değil" kontrolü BİLİNÇLİ olarak yok — aura landing sözlüğü
  // dile-özgü söz dizimi için çok sayıda kasıtlı-boş parça içerir (hero prefix/suffix,
  // letterform wordBefore/wordAfter/lineAfter, chapter cümle parçaları). Boş-string bir
  // yapısal bütünlük ihlali değil; kasıtlı vs. unutulmuş boş ayırt edilemez → yanlış-pozitif.
  // Gerçek koruma yapı-imzası simetrisidir (eksik/fazla anahtar + dizi boyu).

  it("langDir: ar/fa → rtl, diğerleri ltr", () => {
    const rtl: Lang[] = ["ar", "fa"];
    for (const code of LANG_CODES) {
      expect(langDir(code)).toBe(rtl.includes(code) ? "rtl" : "ltr");
    }
  });

  it("landing kopyasında 'Pro Bono' geçmez (yeni ad: Ücretsiz Sağlık Hizmeti)", () => {
    expect(JSON.stringify(COPY)).not.toMatch(/pro\s*bono/i);
  });
});

// Tek dil anahtarı köprüsü — `air_lang` dil ADI tutar; landing/public sayfalar kod-bazlıdır.
// Eşleme kopuk olursa landing↔hasta yüzeyleri dil taşıması sessizce bozulur.
describe("dil kodu ↔ dil adı köprüsü (air_lang birleştirmesi)", () => {
  it("LANG_NAME_BY_CODE tüm LANGUAGES adlarını birebir kapsar", () => {
    expect(Object.values(LANG_NAME_BY_CODE).sort()).toEqual([...LANGUAGES].sort());
  });

  it("her landing locale kodu geçerli bir dil adına eşlenir ve gidiş-dönüş tutarlıdır", () => {
    for (const { code } of LANGS) {
      const name = LANG_NAME_BY_CODE[code];
      expect(name, `code=${code}`).toBeTruthy();
      expect(LANGUAGES, `code=${code}`).toContain(name);
      expect(langCodeFor(name), `name=${name}`).toBe(code);
    }
  });

  it("langCodeFor: bilinmeyen/boş ad → undefined (air_lang ezilmez, görüntü fallback)", () => {
    expect(langCodeFor("Klingonca")).toBeUndefined();
    expect(langCodeFor(null)).toBeUndefined();
    expect(langCodeFor(undefined)).toBeUndefined();
    expect(langCodeFor("")).toBeUndefined();
  });
});
