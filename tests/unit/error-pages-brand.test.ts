// Hata/404 sayfaları — marka-duyarlı CTA sözleşmesi (v6.203, QA ISSUE-001 / Design D-2 kalıntısı).
//
// Kilitlenen kusur (02.09.2026 QA): Doctorium deploy'unda 404 sayfası T2 ile Doctorium kromuna
// geçmişti ama "Ana sayfaya dön" düğmesi hâlâ AURA'nın turkuaz aksanını (`--c-accent`, gece
// #28c8d8) taşıyordu. not-found/error sayfaları "use client" olduğu için BRAND_MODE'u
// okuyamaz; marka kök layout'tan <body data-brand> ile iner ve CSS token'ı (`--c-cta`) oradan
// çözülür. Bu test kaynak dosyaları OKUR (nöbet): biri düğmeyi tekrar --c-accent'e döndürürse
// ya da layout data-brand'i düşürürse kırılır — kusur kolayca geri gelirdi.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const src = (p: string) => readFileSync(join(process.cwd(), "src", p), "utf8");

describe("404 / hata sayfaları: CTA marka token'ından gelir, AURA aksanından değil", () => {
  for (const file of ["app/not-found.tsx", "app/error.tsx"]) {
    it(`${file} — düğme var(--c-cta) kullanır, bg-[var(--c-accent)] KULLANMAZ`, () => {
      const code = src(file);
      expect(code).toContain("bg-[var(--c-cta)]");
      expect(code).toContain("text-[var(--c-cta-ink)]");
      expect(code).not.toContain("bg-[var(--c-accent)]");
    });
  }

  it("kök layout gövdeye data-brand basar (client bileşenler markayı buradan alır)", () => {
    const layout = src("app/layout.tsx");
    expect(layout).toMatch(/data-brand=\{IS_DOCTORIUM_DEPLOY \? "doctorium" : "aura"\}/);
  });

  it("globals.css: --c-cta varsayılanı AURA aksanı, Doctorium gövdesinde zümrüt", () => {
    const css = src("app/globals.css");
    expect(css).toMatch(/--c-cta:\s*var\(--c-accent\)/);
    expect(css).toMatch(/body\[data-brand="doctorium"\]\s*\{[^}]*--c-cta:\s*#047857/);
    expect(css).toMatch(/body\[data-brand="doctorium"\]\s*\{[^}]*--c-cta-ink:\s*#ffffff/i);
  });
});
