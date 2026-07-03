// landing-copy — 8 dil statik kopya bütünlüğü (FAZ 3, 2026-07-04).
// Amaç: yeni dil eklenirken/metin değişirken anahtar kümesi asimetrisi (eksik çeviri) derlemede
// yakalanmayan yapısal kaymaları (dizi uzunlukları) testte yakalansın.
import { describe, it, expect } from "vitest";
import { LANDING_COPY, LANDING_LOCALES, landingDir, type LandingLocale } from "@/lib/landing-copy";

// İç içe anahtar kümesini düzleştir (dizilerde uzunluk da imzaya girer).
function shape(o: unknown, prefix = ""): string[] {
  if (Array.isArray(o)) return [`${prefix}[${o.length}]`, ...o.flatMap((v, i) => shape(v, `${prefix}[${i}]`))];
  if (o && typeof o === "object") {
    return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => shape(v, prefix ? `${prefix}.${k}` : k));
  }
  return [`${prefix}:${typeof o}`];
}

describe("landing-copy", () => {
  const locales = LANDING_LOCALES.map((l) => l.code);

  it("8 locale tanımlı ve LANDING_COPY ile birebir örtüşür", () => {
    expect(locales).toEqual(["tr", "en", "de", "fr", "ru", "ar", "fa", "az"]);
    expect(Object.keys(LANDING_COPY).sort()).toEqual([...locales].sort());
  });

  it("tüm locale'lerin yapı imzası TR ile birebir aynı (eksik/fazla anahtar veya dizi boyu yok)", () => {
    const ref = shape(LANDING_COPY.tr).sort();
    for (const code of locales) {
      expect(shape(LANDING_COPY[code]).sort(), `locale=${code}`).toEqual(ref);
    }
  });

  it("hiçbir metin boş değil", () => {
    for (const code of locales) {
      const walk = (o: unknown): void => {
        if (Array.isArray(o)) return o.forEach(walk);
        if (o && typeof o === "object") return Object.values(o).forEach(walk);
        if (typeof o === "string") expect(o.trim().length, `locale=${code}`).toBeGreaterThan(0);
      };
      walk(LANDING_COPY[code]);
    }
  });

  it("landingDir: ar/fa → rtl, diğerleri ltr", () => {
    const rtl: LandingLocale[] = ["ar", "fa"];
    for (const code of locales) {
      expect(landingDir(code)).toBe(rtl.includes(code) ? "rtl" : "ltr");
    }
  });

  it("landing kopyasında 'Pro Bono' geçmez (yeni ad: Ücretsiz Sağlık Hizmeti)", () => {
    expect(JSON.stringify(LANDING_COPY)).not.toMatch(/pro\s*bono/i);
  });
});
