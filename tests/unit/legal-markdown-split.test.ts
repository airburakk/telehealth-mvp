// Birim — lib/legal-markdown-split (Paket 7, v6.285): hukuki markdown çevrilebilir birimlere ayrılır, yapı (başlık/liste/
// blockquote/tablo/hr) çeviri DIŞINDA kalır; kimlik haritasıyla geri birleştirme ayrıştırıcı düzeyinde AYNI yapıyı verir
// (5 gerçek belge), çeviri haritası önekleri bozmadan uygulanır, haritada olmayan birim özgün kalır (fail-open).
import { describe, it, expect } from "vitest";
import { splitLegalMarkdown, legalUnits, joinLegalMarkdown } from "@/lib/legal-markdown-split";
import { parseLegalMarkdown } from "@/lib/doctorium-legal/markdown";
import { AURA_LEGAL_DOCS } from "@/lib/aura-legal";

const SAMPLE = [
  "## 1. Başlık **kalın**",
  "",
  "İlk paragraf birinci satır",
  "ikinci satır aynı paragraf.",
  "",
  "- madde bir",
  "- madde iki",
  "  devam satırı",
  "1. sıralı bir",
  "",
  "> alıntı paragrafı",
  "> ## alıntı başlığı",
  "> - alıntı maddesi",
  "",
  "| Kanal | Adres |",
  "|---|---|",
  "| Platform içi form | /kvkk-basvuru — yalnız oturumlu |",
  "",
  "---",
  "Son paragraf [bağlantı](https://x.y).",
].join("\n");

describe("split + join", () => {
  it("birimler: başlık, paragraflar, liste maddeleri, alıntı satırları, tablo hücreleri; hr/boş/ayraç ham", () => {
    const seg = splitLegalMarkdown(SAMPLE);
    const units = legalUnits(seg);
    expect(units).toContain("1. Başlık **kalın**");
    expect(units).toContain("İlk paragraf birinci satır ikinci satır aynı paragraf.");
    expect(units).toContain("madde iki devam satırı");
    expect(units).toContain("sıralı bir");
    expect(units).toContain("alıntı başlığı");
    expect(units).toContain("alıntı maddesi");
    expect(units).toContain("Platform içi form");
    expect(units).toContain("Son paragraf [bağlantı](https://x.y).");
    expect(units.some((u) => u.includes("---"))).toBe(false);
    expect(units.some((u) => u.startsWith("#") || u.startsWith("- ") || u.startsWith("> "))).toBe(false);
  });
  it("çeviri haritası uygulanır; önekler ve yapı korunur; haritada olmayan özgün kalır", () => {
    const seg = splitLegalMarkdown(SAMPLE);
    const map = Object.fromEntries(legalUnits(seg).map((u) => [u, `[X]${u}`]));
    delete map["sıralı bir"]; // fail-open örneği
    const out = joinLegalMarkdown(seg, map);
    expect(out).toContain("## [X]1. Başlık **kalın**");
    expect(out).toContain("- [X]madde bir");
    expect(out).toContain("1. sıralı bir");
    expect(out).toContain("> ## [X]alıntı başlığı");
    expect(out).toContain("| [X]Kanal | [X]Adres |");
    expect(out).toContain("|---|---|");
    expect(out).toContain("---\n[X]Son paragraf");
    const a = parseLegalMarkdown(out);
    const b = parseLegalMarkdown(SAMPLE);
    expect(a.map((x) => x.type)).toEqual(b.map((x) => x.type));
  });
  it("5 gerçek belge (TR+EN): kimlik haritasıyla geri birleştirme ayrıştırıcı düzeyinde AYNI yapı", () => {
    for (const d of AURA_LEGAL_DOCS) {
      for (const lang of ["tr", "en"] as const) {
        const md = d.body[lang];
        const seg = splitLegalMarkdown(md);
        const back = joinLegalMarkdown(seg, {});
        expect(parseLegalMarkdown(back), `${d.slug}/${lang}`).toEqual(parseLegalMarkdown(md));
        expect(legalUnits(seg).length, `${d.slug}/${lang}`).toBeGreaterThan(20);
      }
    }
  });
});
