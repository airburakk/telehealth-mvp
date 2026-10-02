// Regresyon nöbeti (2026-10-02) — Doctorium landing üst barı mobilde de KONUMLANDIRILMIŞ olmalı.
//
// Neden: z-index yalnız konumlandırılmış öğede işler. Header mobilde statikti (`md:sticky`), `z-20` etkisizdi; hemen
// ardından gelen Hero `relative isolate` olduğu için hamburger paneli hero'nun ALTINDA boyanıyordu — düğme X'e dönüyor,
// panel görünmüyor, "Giriş yap" dahil hiçbir menü satırı tıklanamıyordu (768 px altı; canlıda Playwright ile ölçüldü:
// elementFromPoint menü satırı yerine hero'nun <p>/<h1>'ini döndürüyordu). Düzeltme: header'a `relative`.
// Bu test kaynak sınıflarını kilitler; gerçek katman davranışı tarayıcıda (390 px) doğrulanmıştır.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("Doctorium landing — mobil menü paneli hero'nun üstünde kalır", () => {
  const header = read("src/components/aura/doctorium-v3/LandingHeader.tsx");
  const headerClass = header.match(/<header className="([^"]+)"/)?.[1] ?? "";
  const classes = headerClass.split(/\s+/);

  it("header mobilde konumlandırılmış (relative) ve z-index taşır", () => {
    expect(classes, "header className bulunamadı ya da değişti").not.toHaveLength(0);
    expect(classes).toContain("relative");
    expect(classes.some((c) => /^z-(\d+|\[\d+\])$/.test(c)), "konum sınıfsız z-index etkisizdir; ikisi birlikte olmalı").toBe(true);
  });

  it("md ve üstünde yapışkan kalır (mobilde yapışmaz kararı korunur)", () => {
    expect(classes).toContain("md:sticky");
    expect(classes).not.toContain("sticky");
    expect(classes).not.toContain("fixed");
  });

  it("menü paneli header'ın içinde mutlak konumlu ve header'dan yüksek katmanda", () => {
    const menu = read("src/components/aura/doctorium-mobile-menu.tsx");
    expect(menu).toMatch(/absolute inset-x-0 top-full z-30/);
  });

  it("Hero konumlandırılmış kalırsa header'ın z-index'i ondan büyük olmalı", () => {
    const hero = read("src/components/aura/doctorium-v3/sections/Hero.tsx");
    // Hero bugün `relative isolate` (z-index'siz = auto). Biri Hero'ya z-index verirse header'ınkinden küçük kalmalı.
    const heroZ = Number(hero.match(/className="relative isolate[^"]*\bz-(\d+)\b/)?.[1] ?? 0);
    const headerZ = Number(classes.find((c) => /^z-\d+$/.test(c))?.slice(2) ?? 0);
    expect(headerZ).toBeGreaterThan(heroZ);
  });
});

// 👤 2026-10-02 ("menü panelini tamamen opak yap"): panel hero'nun üstüne açılır; yarı saydam zeminde hero başlığı menü
// satırlarının arasından seçiliyordu. Zemin tek ve opak bir token olmalı — alfa, color-mix ya da bulanıklık geri gelmesin.
describe("Doctorium landing — mobil menü paneli zemini tam opak", () => {
  const menu = read("src/components/aura/doctorium-mobile-menu.tsx");
  const panel = menu.match(/id=\{menuId\}\s+className=\{`([^`]+)`\}/)?.[1] ?? "";
  const panelClasses = panel.split(/\s+/);

  it("panel tek bir zemin sınıfı taşır: bg-[var(--dl-bg)]", () => {
    expect(panel, "panel className bulunamadı ya da değişti").not.toBe("");
    expect(panelClasses.filter((c) => c.startsWith("bg-"))).toEqual(["bg-[var(--dl-bg)]"]);
  });

  it("zeminde alfa / color-mix / saydamlık / backdrop-blur yok", () => {
    expect(panel).not.toMatch(/transparent|color-mix|backdrop-|opacity-|bg-\S+\/\d/);
  });

  it("landing paletinde --dl-bg opak bir renk (alfa kanalı yok)", () => {
    const palette = read("src/components/aura/doctorium-v3/palette.ts");
    const bg = palette.match(/"--dl-bg":\s*"([^"]+)"/)?.[1] ?? "";
    expect(bg).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});
