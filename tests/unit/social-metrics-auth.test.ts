import { describe, expect, it } from "vitest";
import { normalizeSocialToken, socialTokenMatches } from "@/lib/social-metrics-auth";

const K = "a3f09c1e5b7d2468ace0bdf13579bdf02468ace13579bdf02468ace13579bdf0";

describe("social-metrics-auth — Bearer kapısı (v6.353 tolerans)", () => {
  it.each([
    [`Bearer ${K}`, "standart biçim"],
    [K, "Bearer öneki yok (n8n Value'ya yalın anahtar)"],
    [`bearer ${K}`, "küçük harf önek"],
    [`  Bearer   ${K}  `, "fazla boşluk"],
    [`Bearer ${K}\r\n`, "sonda satır sonu (yapıştırma artığı)"],
  ])("kabul: %s — %s", (header) => {
    expect(socialTokenMatches(header, K)).toBe(true);
  });

  it("env'de kalan boşluk / yanlışlıkla yazılmış 'Bearer ' de ayıklanır", () => {
    expect(socialTokenMatches(`Bearer ${K}`, `${K}\n`)).toBe(true);
    expect(socialTokenMatches(`Bearer ${K}`, `Bearer ${K}`)).toBe(true);
  });

  it.each<[string | null, string]>([
    [`Bearer ${K.slice(0, -1)}`, "eksik karakter"],
    [`Bearer ${K}x`, "fazla karakter"],
    [`Bearer ${K.toUpperCase()}`, "anahtarın kendisi harf duyarlı"],
    [`Basic ${K}`, "başka şema"],
    ["Bearer", "anahtarsız önek"],
    ["", "boş başlık"],
    [null, "başlık yok"],
  ])("red: %s — %s", (header) => {
    expect(socialTokenMatches(header, K)).toBe(false);
  });

  it("boş ya da yalnız boşluk env hiçbir başlıkla eşleşmez", () => {
    expect(socialTokenMatches("Bearer ", "")).toBe(false);
    expect(socialTokenMatches("", "   ")).toBe(false);
    expect(normalizeSocialToken("   ")).toBe("");
    expect(normalizeSocialToken(undefined)).toBe("");
  });
});
