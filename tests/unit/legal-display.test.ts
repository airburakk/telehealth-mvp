// Birim — lib/aura-legal/display + consent-lang parseShownTranslation (Paket 7, v6.285): gösterim dili çözümü (kod/ad/
// fallback), kanonik dil kuralı (TR/EN dışı → EN kanonik + çeviri), bağlantı üretimi, rtl, `shown` gövde doğrulaması.
import { describe, it, expect } from "vitest";
import { resolveLegalDisplay, auraLegalHrefFor, legalDir } from "@/lib/aura-legal/display";
import { auraLegalLang } from "@/lib/aura-legal/routes";
import { parseShownTranslation } from "@/lib/consent-lang";

describe("resolveLegalDisplay", () => {
  it("kod ve ad kabul; tr/en kanonik; diğerleri EN kanonik + çeviri", () => {
    expect(resolveLegalDisplay("ru")).toEqual({ canonical: "en", display: "Rusça", code: "ru", translated: true });
    expect(resolveLegalDisplay("Almanca")).toEqual({ canonical: "en", display: "Almanca", code: "de", translated: true });
    expect(resolveLegalDisplay("en")).toEqual({ canonical: "en", display: "İngilizce", code: "en", translated: false });
    expect(resolveLegalDisplay("tr")).toEqual({ canonical: "tr", display: "Türkçe", code: "tr", translated: false });
    expect(resolveLegalDisplay(["ar"]).code).toBe("ar");
  });
  it("değer yoksa fallback (hasta profil dili); ikisi de yoksa/bilinmiyorsa TR", () => {
    expect(resolveLegalDisplay(undefined, "Farsça")).toMatchObject({ display: "Farsça", code: "fa", translated: true });
    expect(resolveLegalDisplay(undefined, null)).toMatchObject({ canonical: "tr", translated: false });
    expect(resolveLegalDisplay("xx", "yy")).toMatchObject({ canonical: "tr", display: "Türkçe" });
    expect(resolveLegalDisplay("", "İngilizce")).toMatchObject({ canonical: "en", translated: false });
  });
  it("auraLegalLang (eski sözleşme) kanonik döner; href kod ile", () => {
    expect(auraLegalLang("ru")).toBe("en");
    expect(auraLegalLang("en")).toBe("en");
    expect(auraLegalLang(undefined)).toBe("tr");
    expect(auraLegalHrefFor("/aydinlatma", "Türkçe")).toBe("/aydinlatma");
    expect(auraLegalHrefFor("/aydinlatma", "İngilizce")).toBe("/aydinlatma?lang=en");
    expect(auraLegalHrefFor("/aydinlatma", "Rusça")).toBe("/aydinlatma?lang=ru");
    expect(legalDir("ar")).toBe("rtl");
    expect(legalDir("fa")).toBe("rtl");
    expect(legalDir("ru")).toBe("ltr");
  });
});

describe("parseShownTranslation", () => {
  const h = "a".repeat(64);
  it("tanınan TR/EN dışı dil + iki 64-hex hash → kabul; aksi null", () => {
    expect(parseShownTranslation({ lang: "Rusça", aydinlatmaHash: h, kosullarHash: h })).toEqual({ lang: "Rusça", aydinlatmaHash: h, kosullarHash: h });
    expect(parseShownTranslation({ lang: "Türkçe", aydinlatmaHash: h, kosullarHash: h })).toBeNull();
    expect(parseShownTranslation({ lang: "İngilizce", aydinlatmaHash: h, kosullarHash: h })).toBeNull();
    expect(parseShownTranslation({ lang: "Klingonca", aydinlatmaHash: h, kosullarHash: h })).toBeNull();
    expect(parseShownTranslation({ lang: "Rusça", aydinlatmaHash: "zz", kosullarHash: h })).toBeNull();
    expect(parseShownTranslation({ lang: "Rusça", aydinlatmaHash: h })).toBeNull();
    expect(parseShownTranslation(null)).toBeNull();
    expect(parseShownTranslation("x")).toBeNull();
  });
});
