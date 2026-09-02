// PWA kabuğu marka sözleşmesi (Faz E, 2026-09-03) — manifest · iOS ikonu · push ikonu marka-duyarlı.
//
// NEDEN TEST: PWA kabuğu React ağacının DIŞINDADIR (ikon/manifest/sw) — derleyici ve mevcut testler
// onu görmez; 2026-08-19'da ikonlar 2 ay eski amblemle, 2026-09-02'de doctorium.tr manifest'i "AURA
// Health" adıyla bulundu (QA marka sızıntısı ailesi). Bu test üç sızıntı eksenini kilitler:
//   1) app/manifest.ts marka-duyarlı ve public/manifest.webmanifest YOK (aynı yolu gölgelerdi).
//   2) Doctorium yüzeyleri (üç layout) + Doctorium deploy'unun kök layout'u zümrüt iOS ikonu bağlar.
//   3) sw.js push bildirimi host'a göre marka ikonu/adı kullanır; yeni ikonlar PRECACHE'te, VERSION artmış.
//
// ⚠️ IS_DOCTORIUM_DEPLOY modül yüklenirken hesaplanır → her senaryo stubEnv + resetModules + dinamik
// import ister (brand-home.test deseni).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, afterEach, vi } from "vitest";

const root = process.cwd();
const pub = (p: string) => join(root, "public", p.replace(/\?.*$/, "").replace(/^\//, ""));
const src = (p: string) => readFileSync(join(root, "src", p), "utf8");

async function loadManifest(brandMode: string) {
  vi.resetModules();
  vi.stubEnv("BRAND_MODE", brandMode);
  const m = await import("@/app/manifest");
  return m.default();
}

describe("app/manifest.ts — marka-duyarlı PWA manifest", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("public/manifest.webmanifest YOK — app/manifest.ts'i gölgelerdi (Faz E'de silindi)", () => {
    expect(existsSync(join(root, "public", "manifest.webmanifest"))).toBe(false);
  });

  it("Doctorium deploy: ad Doctorium, zümrüt ikon seti, dosyalar public'te var", async () => {
    const m = await loadManifest("doctorium");
    expect(m.name).toBe("Doctorium");
    expect(m.short_name).toBe("Doctorium");
    expect(m.icons?.length).toBeGreaterThanOrEqual(4);
    for (const ic of m.icons ?? []) {
      expect(ic.src, ic.src).toContain("icon-doctorium-");
      expect(existsSync(pub(ic.src)), `${ic.src} public'te yok — scripts/gen-icons.py koş`).toBe(true);
    }
    expect(m.description).not.toContain("sağlık turizmi"); // AURA metni sızmaz
  });

  it("AURA deploy: 'AURA Health' + turkuaz ikonlar — davranış değişmedi", async () => {
    const m = await loadManifest("");
    expect(m.name).toBe("AURA Health");
    expect(m.short_name).toBe("AURA");
    for (const ic of m.icons ?? []) {
      expect(ic.src).toMatch(/^\/icon-(192|512)\.png\?v=3$/);
      expect(existsSync(pub(ic.src))).toBe(true);
    }
  });

  it("iki manifest'te de 'uçtan uca' YOK (vitrin iddia disiplini v6.8)", async () => {
    for (const mode of ["doctorium", ""]) {
      expect(JSON.stringify(await loadManifest(mode))).not.toContain("uçtan uca");
    }
  });
});

describe("iOS ikonu + push ikonu — Doctorium yüzeyleri zümrüt", () => {
  it("üç Doctorium layout'u apple-touch-icon-doctorium bağlar", () => {
    for (const f of ["app/doctorium/layout.tsx", "app/doktor/doctorium/layout.tsx", "app/admin/layout.tsx"]) {
      expect(src(f), f).toContain("/apple-touch-icon-doctorium.png");
      expect(src(f), f).not.toContain('apple: "/apple-touch-icon.png');
    }
    expect(existsSync(pub("/apple-touch-icon-doctorium.png"))).toBe(true);
  });

  it("kök layout: Doctorium deploy'unda zümrüt favicon + iOS ikonu, AURA'da turkuaz", () => {
    const code = src("app/layout.tsx");
    expect(code).toMatch(/icon:\s*IS_DOCTORIUM_DEPLOY\s*\?\s*"\/icon-doctorium\.ico/);
    expect(code).toMatch(/apple:\s*IS_DOCTORIUM_DEPLOY\s*\?\s*"\/apple-touch-icon-doctorium\.png/);
  });

  it("sw.js: host'a göre push ikonu/adı; zümrüt ikonlar PRECACHE'te; VERSION v7'den ileri", () => {
    const sw = readFileSync(join(root, "public", "sw.js"), "utf8");
    expect(sw).toMatch(/hostname\.includes\("doctorium"\)/);
    expect(sw).toContain("/icon-doctorium-192.png");
    expect(sw).toMatch(/PRECACHE = \[[^\]]*icon-doctorium-192\.png/);
    expect(sw).not.toContain('VERSION = "air-pwa-v7"');
  });
});
