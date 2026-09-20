// Birim — lib/legal-translate (Paket 7 + 7-C düzeltmesi, v6.286): "çevrildi" = birim ÖNBELLEKTE var (özgün metne ÖZDEŞ olsa da —
// "Vercel", "`session`" gibi özel ad/kod birimlerini model bilinçli aynen bırakır; 2026-09-20'de bunlar yanlışlıkla "eksik" sayılıp
// Rusça aydınlatma metni %96'da "eksik" görünüyor ve onay kilitleniyordu). Haritada OLMAYAN birim TR kalır → complete=false;
// hiç birim yoksa null (EN kanoniğe düşüş); simgesel birimler ("—", tarih) beklenen sayıya girmez; generate:false yalnız peek.
import { describe, it, expect, vi, beforeEach } from "vitest";

const { peek, get } = vi.hoisted(() => ({
  peek: vi.fn(async (_lang: string, _texts: string[]) => ({}) as Record<string, string>),
  get: vi.fn(async (_lang: string, _texts: string[]) => ({}) as Record<string, string>),
}));
vi.mock("@/lib/i18n", async () => {
  const { LANGUAGES } = await import("@/lib/constants");
  return { UI_LANGS: LANGUAGES, legalHash: (s: string) => s, peekLegalTranslations: peek, getLegalTranslations: get };
});

import { assembleLegalMarkdown, isTranslatableLegalLang, legalMarkdownUnits, translateLegalMarkdown } from "@/lib/legal-translate";

const MD = ["# Başlık", "", "Bu bir paragraftır ve çevrilmelidir.", "", "| Sağlayıcı | Rol |", "|---|---|", "| Vercel | barındırma |", "| — | 2026 |", "", "- `session` çerezi oturumu taşır."].join("\n");

beforeEach(() => {
  peek.mockReset().mockResolvedValue({});
  get.mockReset().mockResolvedValue({});
});

describe("assembleLegalMarkdown — tamlık ölçütü", () => {
  it("özdeş çeviri (özel ad/kod) ÇEVRİLMİŞ sayılır; simgesel birimler beklenen sayıya girmez", () => {
    const units = legalMarkdownUnits(MD);
    expect(units).toContain("Vercel");
    expect(units).toContain("—");
    const map: Record<string, string> = {};
    for (const u of units) map[u] = /\p{L}{3,}/u.test(u) && u !== "Vercel" ? `RU ${u}` : u; // Vercel ve simgeler aynen
    const r = assembleLegalMarkdown(MD, map);
    expect(r?.complete).toBe(true);
    expect(r?.translated).toBe(r?.units);
    expect(r?.units).toBeLessThan(units.length); // "—" · "2026" · "|---|---|" beklenenin dışında
    expect(r?.markdown).toContain("RU Bu bir paragraftır");
    expect(r?.markdown).toContain("| Vercel | RU barındırma |");
    expect(r?.markdown).toContain("| — | 2026 |");
  });

  it("haritada OLMAYAN birim TR kalır → complete=false, sayaçlar doğru", () => {
    const units = legalMarkdownUnits(MD);
    const map = Object.fromEntries(units.filter((u) => u !== "Bu bir paragraftır ve çevrilmelidir.").map((u) => [u, `RU ${u}`]));
    const r = assembleLegalMarkdown(MD, map);
    expect(r?.complete).toBe(false);
    expect(r?.translated).toBe((r?.units ?? 0) - 1);
    expect(r?.markdown).toContain("Bu bir paragraftır ve çevrilmelidir.");
  });

  it("hiç birim çevrilmemiş → null (çağıran EN kanoniğe düşer)", () => {
    expect(assembleLegalMarkdown(MD, {})).toBeNull();
  });
});

describe("translateLegalMarkdown — yol seçimi", () => {
  it("varsayılan üretim yolu (getLegalTranslations); generate:false yalnız önbellek (peek)", async () => {
    get.mockResolvedValue({ "Bu bir paragraftır ve çevrilmelidir.": "RU" });
    expect((await translateLegalMarkdown(MD, "Rusça"))?.translated).toBe(1);
    expect(get).toHaveBeenCalledTimes(1);
    expect(peek).not.toHaveBeenCalled();
    peek.mockResolvedValue({ "Bu bir paragraftır ve çevrilmelidir.": "RU" });
    expect((await translateLegalMarkdown(MD, "Rusça", { generate: false }))?.translated).toBe(1);
    expect(peek).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("TR/EN ve tanınmayan dil → null; isTranslatableLegalLang sözleşmesi", async () => {
    expect(await translateLegalMarkdown(MD, "Türkçe")).toBeNull();
    expect(await translateLegalMarkdown(MD, "İngilizce")).toBeNull();
    expect(await translateLegalMarkdown(MD, "Klingonca")).toBeNull();
    expect(isTranslatableLegalLang("Rusça")).toBe(true);
    expect(isTranslatableLegalLang("Türkçe")).toBe(false);
    expect(isTranslatableLegalLang(null)).toBe(false);
    expect(get).not.toHaveBeenCalled();
  });
});
