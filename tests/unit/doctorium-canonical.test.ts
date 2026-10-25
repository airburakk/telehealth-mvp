// Doctorium canonical sözleşmesi (2026-10-26, Search Console ölçümü):
//   1) Landing'in canonical'ı + og:url + JSON-LD adresleri DAİMA mutlak doctorium.tr KÖKÜ — "/doctorium" deyince Google
//      rewrite'lı kökü seçip sayfayı "kopya" saymıştı; göreli adres AURA host'unda auraglobalcare.com'a çözülüyordu.
//   2) /doctorium/kayit canonical'ı mutlak doctorium.tr adresi.
//   3) Doctorium sitemap'i kökü listeler (/doctorium'u değil); AURA sitemap'i iki Doctorium adresini İÇERMEZ (çift indeks yok).
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("Doctorium canonical", () => {
  it("landing: canonical/og/JSON-LD mutlak doctorium.tr kökü; göreli \"/doctorium\" ve SITE_URL yok", () => {
    const page = read("src/app/doctorium/page.tsx");
    expect(page).toMatch(/const CANONICAL = `\$\{DOCTORIUM_CANONICAL_URL\}\/`;/);
    expect(page).toContain("canonical: CANONICAL");
    expect(page).toContain("url: CANONICAL");
    expect(page).not.toMatch(/canonical: "\/doctorium"/);
    expect(page).not.toContain("SITE_URL");
  });

  it("kayıt: canonical mutlak doctorium.tr/doctorium/kayit", () => {
    const page = read("src/app/doctorium/kayit/page.tsx");
    expect(page).toContain("canonical: `${DOCTORIUM_CANONICAL_URL}/doctorium/kayit`");
  });
});

describe("sitemap: Doctorium adresleri yalnız Doctorium deploy'unda", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

  it("Doctorium deploy'u kökü listeler, /doctorium'u listelemez; kayıt sayfası kalır", async () => {
    vi.resetModules(); vi.stubEnv("BRAND_MODE", "doctorium");
    const paths = (await import("@/app/sitemap")).default().map((e) => new URL(e.url).pathname);
    expect(paths).toContain("/");
    expect(paths).not.toContain("/doctorium");
    expect(paths).toContain("/doctorium/kayit");
  });

  it("AURA deploy'u /doctorium ve /doctorium/kayit'ı içermez", async () => {
    vi.resetModules(); vi.stubEnv("BRAND_MODE", "");
    const paths = (await import("@/app/sitemap")).default().map((e) => new URL(e.url).pathname);
    expect(paths).not.toContain("/doctorium");
    expect(paths).not.toContain("/doctorium/kayit");
    expect(paths).toContain("/");
  });
});
