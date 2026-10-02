// Eski /care adresleri → modül alan adları (2026-10-02, 👤 "eski /care adreslerini alan adlarına yönlendir").
//
// v6.304 (30.09.2026) üç modül vitrinini + 16 rehberi AURA'da /care/<modül>[/<rehber>] altında yayınlamış, v6.305
// (02.10.2026) kaldırmıştı. İki buçuk gün yayında kalan 19 adres next.config.ts redirects() ile KALICI (308) olarak
// modül alan adlarına yönlenir. Bu nöbet şunları kilitler:
//   (1) config ↔ lib/aura-modules/catalog alan adı sözleşmesi (config '@' alias'ını çözemediği için değer tekrarlanır),
//   (2) v6.304'te yayında olan 19 adresin her biri doğru hedefe düşer; hiç yayınlanmamış adresler yönlenmez,
//   (3) Doctorium deploy'unda /care kuralı yoktur (o adresler doctorium.tr'de hiç yayınlanmadı),
//   (4) sayfalar geri gelmemiştir: yönlendirme vardır, /care rotası yoktur.
// Gerçek eşleşmeyi Next yapar (next start + canlıda ölçüldü); buradaki küçük çözümleyici yalnız bu tabloda kullanılan
// iki kalıbı (sabit yol · sonda tek `:ad` parçası) taklit eder — kural tablosunu tek tek adresle sınamak için.
import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync } from "fs";
import { join } from "path";
import { MODULES, type ModuleKey } from "@/lib/aura-modules/catalog";

type Rule = { source: string; destination: string; permanent?: boolean; has?: unknown };

async function loadRedirects(brandMode: "" | "doctorium"): Promise<Rule[]> {
  vi.resetModules();
  vi.stubEnv("BRAND_MODE", brandMode); // IS_DOCTORIUM_DEPLOY modül yüklenirken çözülür → stubEnv + resetModules + dinamik import
  const { default: config } = await import("../../next.config");
  return (await config.redirects!()) as Rule[];
}

/** İlk eşleşen kuralı uygular (Next sırası). Yalnız sabit yol ve sonda tek `:ad` parçası desteklenir. */
function resolve(rules: Rule[], path: string): { destination: string; permanent: boolean } | null {
  for (const rule of rules) {
    if (rule.has) continue; // host koşullu kurallar bu tablonun konusu değil
    const param = rule.source.match(/^(.*)\/:([a-z]+)$/);
    if (!param) {
      if (rule.source === path) return { destination: rule.destination, permanent: rule.permanent === true };
      continue;
    }
    const [, prefix, name] = param;
    if (!path.startsWith(prefix + "/")) continue;
    const rest = path.slice(prefix.length + 1);
    if (!rest || rest.includes("/")) continue; // `:ad` tek yol parçasıdır
    return { destination: rule.destination.replace(`:${name}`, rest), permanent: rule.permanent === true };
  }
  return null;
}

// v6.304'te yayında olan rehberler (git: 42d8405 src/lib/aura-modules/guide-index.ts GUIDE_INDEX) — tarihsel, DONUK liste.
// Alan adı sitelerinde aynı slug'lar kökte yaşar (2026-10-02 sitemap ölçümü).
const OLD_GUIDES: Record<ModuleKey, readonly string[]> = {
  "second-opinion": ["what-is-a-second-opinion", "how-it-works", "global-examples"],
  "medical-tourism": ["healthcare-in-turkiye", "facts-and-figures", "planning-your-journey"],
  "medical-aesthetics": [
    "aesthetic-surgery", "facial-aesthetics", "rhinoplasty", "breast-surgery", "body-contouring",
    "dental-aesthetics", "hair-transplant", "injectable-treatments", "skin-and-laser", "before-you-decide",
  ],
};
const MODULE_KEYS = Object.keys(MODULES) as ModuleKey[];

describe("eski /care adresleri → modül alan adları (AURA deploy'u)", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

  it("her modül için iki kural vardır; alan adı catalog.ts MODULES ile aynıdır ve yönlendirme kalıcıdır (308)", async () => {
    const rules = await loadRedirects("");
    const care = rules.filter((r) => r.source.startsWith("/care"));
    expect(care).toHaveLength(MODULE_KEYS.length * 2);
    for (const key of MODULE_KEYS) {
      const origin = `https://${MODULES[key].domain}`;
      expect(care, key).toContainEqual({ source: `/care/${key}`, destination: origin, permanent: true });
      expect(care, key).toContainEqual({ source: `/care/${key}/:slug`, destination: `${origin}/:slug`, permanent: true });
    }
  });

  it("v6.304'te yayında olan 19 adresin her biri ilgili alan adındaki karşılığına düşer", async () => {
    const rules = await loadRedirects("");
    let count = 0;
    for (const key of MODULE_KEYS) {
      const origin = `https://${MODULES[key].domain}`;
      expect(resolve(rules, `/care/${key}`), key).toEqual({ destination: origin, permanent: true });
      count++;
      for (const slug of OLD_GUIDES[key]) {
        expect(resolve(rules, `/care/${key}/${slug}`), `${key}/${slug}`).toEqual({ destination: `${origin}/${slug}`, permanent: true });
        count++;
      }
    }
    expect(count).toBe(19); // 3 vitrin + 16 rehber
  });

  it("hiç yayınlanmamış adresler yönlenmez: çıplak /care, tanınmayan modül, iki parçalı alt yol", async () => {
    const rules = await loadRedirects("");
    for (const path of ["/care", "/care/unknown-module", "/care/unknown-module/rhinoplasty", "/care/second-opinion/a/b"]) {
      expect(resolve(rules, path), path).toBeNull();
    }
  });

  it("mevcut kalıcı yönlendirmeler yerinde (yeni blok listeyi ezmedi)", async () => {
    const rules = await loadRedirects("");
    expect(resolve(rules, "/pro-bono")).toEqual({ destination: "/ucretsiz-saglik", permanent: true });
    expect(resolve(rules, "/hekim/abc")).toEqual({ destination: "/doktorlar/abc", permanent: true });
  });
});

describe("eski /care adresleri — Doctorium deploy'u ve sayfa yokluğu", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

  it("Doctorium deploy'unda /care kuralı yoktur (adresler doctorium.tr'de hiç yayınlanmadı)", async () => {
    const rules = await loadRedirects("doctorium");
    expect(rules.filter((r) => r.source.startsWith("/care"))).toHaveLength(0);
  });

  it("/care rotası geri gelmemiştir — yönlendirme sayfa değildir", () => {
    expect(existsSync(join(process.cwd(), "src/app/care"))).toBe(false);
  });
});
