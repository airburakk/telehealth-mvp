import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({ db: {} }));
import { PRACTICE_SETTINGS, isPracticeSetting, parsePracticeSetting } from "@/lib/doctorium-practice";
import { parseViewPrefs } from "@/lib/doctorium";

describe("Doctorium optional work setting", () => {
  it("accepts only the three declared work settings", () => {
    expect(PRACTICE_SETTINGS.map(x => x.key)).toEqual(["asm", "egitim-arastirma", "diger"]);
    for (const option of PRACTICE_SETTINGS) {
      expect(isPracticeSetting(option.key)).toBe(true);
      expect(parseViewPrefs(JSON.stringify({ practice: { setting: option.key } })).practiceSetting).toBe(option.key);
    }
  });
  it("does not infer a work setting from a specialty or malformed data", () => {
    for (const value of [undefined, null, "", "Aile Hekimliği", "aile-hekimligi", "unknown", [], {}, 1]) {
      expect(parsePracticeSetting(value)).toBeNull();
      expect(parseViewPrefs(JSON.stringify({ practice: { setting: value } })).practiceSetting).toBeNull();
    }
    for (const raw of [undefined, null, "", "null", "[]", "invalid", '{}', '{"practice":null}']) {
      expect(parseViewPrefs(raw).practiceSetting).toBeNull();
    }
  });
  it("retains unrelated view choices", () => {
    const prefs = parseViewPrefs('{"practice":{"setting":"asm"},"ilac":{"d":"180"},"tus":{"show":true}}');
    expect(prefs.practiceSetting).toBe("asm");
    expect(prefs.ilac.range).toBe("180");
    expect(prefs.showTus).toBe(true);
  });
});
