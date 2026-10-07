import { describe, expect, it } from "vitest";
import { LANG_CODES, LANGS, langDir } from "@/lib/aura-landing/locales";
import * as previousApi from "@/lib/aura-landing/copy";
import { hidesGlobalChrome } from "@/lib/chrome-routes";

describe("landing locale metadata remains compatible", () => {
  it("retains the existing exports and ordered nine-language set", () => {
    expect(LANG_CODES).toEqual(["en", "tr", "de", "fr", "ru", "ar", "fa", "az", "bg"]);
    expect(previousApi.LANG_CODES).toBe(LANG_CODES);
    expect(previousApi.LANGS).toBe(LANGS);
    expect(previousApi.langDir).toBe(langDir);
    for (const code of LANG_CODES) expect(previousApi.COPY[code]).toBeTruthy();
  });
  it("preserves locale route and RTL behavior", () => {
    for (const code of LANG_CODES) {
      expect(hidesGlobalChrome(`/${code}`)).toBe(true);
      expect(langDir(code)).toBe(code === "ar" || code === "fa" ? "rtl" : "ltr");
    }
  });
});
