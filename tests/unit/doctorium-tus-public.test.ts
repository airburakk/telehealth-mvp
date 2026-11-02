// Herkese açık TUS taban puanları sayfası (doctorium.tr/tus) — sözleşmeler (v6.358, 2026-10-29; 👤 "Önerilerle uygula").
//
// Neden bu sayfa var: "tus taban puanları" ≈12 bin/ay arama (OpenSEO 29.10, KD≈0) — veri Doctorium'da ONAYLI ama portalda girişin
// arkasındaydı. Taslak: vault output/doctorium-tus-herkese-acik-sayfa-taslak-2026-10-29.md.
//
// Kilitlenenler:
//   1) Veri: yalnız onaylı dönem (approvedAt kapısı); bilinmeyen/onaysız ?donem → son dönem; onaylı dönem yoksa "hazırlanıyor", sahte tablo YOK.
//   2) Görünüm: dallar kontenjana göre; son üç dönem satırı seçili dönemle hizalı (eski → yeni); puan iki ondalık Türkçe.
//   3) HTML: tablo sunucuda düz <table> (JS'siz okunur); kaynak bağlantıları noopener; uyarı cümlesi her durumda var.
//   4) İddia disiplini: metinde tahmin/tavsiye/AI/resmî/hekim YOK; onaylı metin (§4) birebir.
//   5) Rota/marka: /tus → /doctorium/tus rewrite yalnız Doctorium deploy'unda; AURA'ya 307 listesinde değil; krom gizli; sitemap yalnız
//      Doctorium'da; proxy kapısı yok; kök /tus sayfası YOK; canonical mutlak doctorium.tr/tus.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { TusPublicPage } from "@/components/aura/doctorium-tus/TusPublicPage";
import { TUS_PUBLIC_COPY, tusPublicAllText } from "@/lib/doctorium-tus-public/copy";
import { buildTusPublicView, formatScore, parsePeriodParam, tusDatasetJsonLd } from "@/lib/doctorium-tus-public/view";
import { approvedTusSummaries, TUS_SNAPSHOTS } from "@/lib/tus-data";
import { hidesGlobalChrome } from "@/lib/chrome-routes";

const periods = approvedTusSummaries();

describe("görünüm modeli", () => {
  it("varsayılan = son onaylı dönem; dönem seçici yeni → eski ve yalnız onaylı dönemler", () => {
    const v = buildTusPublicView(periods, null)!;
    expect(v.period.key).toBe(periods.at(-1)!.key);
    expect(v.isLatest).toBe(true);
    expect(v.options.map((o) => o.key)).toEqual([...periods].reverse().map((p) => p.key));
    expect(v.options.filter((o) => o.selected)).toHaveLength(1);
    const approved = new Set(TUS_SNAPSHOTS.filter((s) => s.approvedAt).map((s) => s.key));
    for (const o of v.options) expect(approved.has(o.key)).toBe(true);
  });

  it("?donem: geçerli anahtar seçilir; bilinmeyen/boş/dizi güvenle çözülür", () => {
    expect(parsePeriodParam("2025-2", periods)).toBe("2025-2");
    expect(parsePeriodParam("1999-1", periods)).toBeNull();
    expect(parsePeriodParam("<script>", periods)).toBeNull();
    expect(parsePeriodParam(undefined, periods)).toBeNull();
    expect(parsePeriodParam(["2024-1", "2025-1"], periods)).toBe("2024-1");
    const v = buildTusPublicView(periods, "2024-1")!;
    expect(v.period.key).toBe("2024-1");
    expect(v.isLatest).toBe(false);
  });

  it("onaylı dönem yoksa null (sayfa 'hazırlanıyor' çizer, sahte tablo yok)", () => {
    expect(buildTusPublicView([], null)).toBeNull();
    expect(tusDatasetJsonLd([], "https://doctorium.tr/tus", { name: "x", description: "y" })).toBeNull();
  });

  it("dallar kontenjana göre azalan; son üç dönem seçili dönemle hizalı (eski → yeni)", () => {
    const v = buildTusPublicView(periods, null)!;
    for (let i = 1; i < v.rows.length; i++) expect(v.rows[i - 1].quota).toBeGreaterThanOrEqual(v.rows[i].quota);
    expect(v.trendKeys.map((k) => k.key)).toEqual(periods.slice(-3).map((p) => p.key));
    const r = v.rows[0];
    expect(r.trend).toHaveLength(3);
    expect(r.trend.at(-1)).toBe(r.minScore);
    // İlk dönem seçilince önceki dönem yok → eğilim tek sütun.
    expect(buildTusPublicView(periods, periods[0].key)!.trendKeys).toHaveLength(1);
  });

  it("puan biçimi iki ondalık Türkçe; null korunur", () => {
    expect(formatScore(45.01831)).toBe("45,02");
    expect(formatScore(50)).toBe("50,00");
    expect(formatScore(null)).toBeNull();
  });

  it("JSON-LD Dataset: kaynak = ÖSYM sayfaları, lisans iddiası YOK, kapsam ilk–son yıl", () => {
    const d = tusDatasetJsonLd(periods, "https://doctorium.tr/tus", { name: TUS_PUBLIC_COPY.datasetName, description: TUS_PUBLIC_COPY.datasetDescription })!;
    expect(d["@type"]).toBe("Dataset");
    expect(d.temporalCoverage).toBe(`${periods[0].year}/${periods.at(-1)!.year}`);
    for (const u of d.isBasedOn as string[]) expect(u).toMatch(/^https:\/\/www\.osym\.gov\.tr\//);
    expect(d).not.toHaveProperty("license");
  });
});

describe("HTML", () => {
  const v = buildTusPublicView(periods, null)!;
  const html = renderToStaticMarkup(createElement(TusPublicPage, { view: v, basePath: "/tus" }));

  it("tablo sunucuda düz <table>; her dal bir satır başlığı; uyarı + kaynak bağlantısı var", () => {
    expect(html).toContain("<table");
    expect(html).toContain(TUS_PUBLIC_COPY.h1);
    expect(html).toContain(TUS_PUBLIC_COPY.warning);
    expect((html.match(/<th scope="row"/g) ?? []).length).toBe(v.rows.length * 2); // ana tablo + son üç dönem
    expect(html).toContain(`href="${v.period.sourcePage}"`);
    for (const m of html.matchAll(/<a [^>]*target="_blank"[^>]*>/g)) expect(m[0]).toMatch(/rel="noopener/);
  });

  it("dönem bağlantıları basePath'e bağlı; son dönem köke gider (parametresiz)", () => {
    expect(html).toContain('href="/tus"');
    expect(html).toContain(`href="/tus?donem=${periods[0].key}"`);
    const aura = renderToStaticMarkup(createElement(TusPublicPage, { view: v, basePath: "/doctorium/tus" }));
    expect(aura).toContain(`href="/doctorium/tus?donem=${periods[0].key}"`);
  });

  it("üyelik çağrısı: öğrenci + doktor kaydı Doctorium kabuğunda", () => {
    expect(html).toContain('href="/doctorium/ogrenci"');
    expect(html).toContain('href="/doctorium/kayit"');
  });

  it("veri yok: hazırlanıyor kutusu, tablo YOK, uyarı yine var", () => {
    const empty = renderToStaticMarkup(createElement(TusPublicPage, { view: null, basePath: "/tus" }));
    expect(empty).toContain(TUS_PUBLIC_COPY.empty.title);
    expect(empty).not.toContain("<table");
    expect(empty).toContain(TUS_PUBLIC_COPY.warning);
  });
});

describe("iddia disiplini — görünür metin + metadata + JSON-LD", () => {
  const text = tusPublicAllText();
  it("yasak ifadeler yok: tahmin dili, tavsiye, AI, resmî/en güncel, hekim, ücret, garanti", () => {
    for (const re of [/\bAI\b/, /yapay zek/i, /resmî/i, /resmi/i, /en güncel/i, /en doğru/i, /hekim/i, /ücret/i, /garanti/i, /akredit/i]) {
      expect(text, String(re)).not.toMatch(re);
    }
  });
  it("tahmin/tavsiye/öneri sözcükleri YALNIZ iki olumsuzlama cümlesinde geçer", () => {
    const c = TUS_PUBLIC_COPY;
    const rest = text.split(c.warning).join("").split(c.lead).join("");
    for (const re of [/tahmin/i, /tavsiye/i, /öneri/i]) expect(rest, String(re)).not.toMatch(re);
    expect(c.lead).toMatch(/tahmin veya tercih önerisi içermez/);
  });
  it("👤 onaylı metin (§4) birebir", () => {
    expect(TUS_PUBLIC_COPY.metaTitle).toBe("TUS Taban Puanları ve Kontenjanları — ÖSYM Verisi · Doctorium");
    expect(TUS_PUBLIC_COPY.h1).toBe("TUS taban puanları ve kontenjanları");
    expect(TUS_PUBLIC_COPY.warning).toBe("Geçmiş dönem verisidir; tercih tavsiyesi veya gelecek dönem puan tahmini değildir.");
    expect(TUS_PUBLIC_COPY.cta.body).toBe("Kurum bazında süzgeç, ek yerleştirme ve sınav takvimi Doctorium üyelerine açık.");
  });
  it("'2021'den bu yana' iddiası ilk onaylı dönemle tutarlı", () => {
    expect(TUS_PUBLIC_COPY.metaDescription).toContain(`${periods[0].year}'den bu yana`);
  });
});

describe("rota / marka sözleşmesi", () => {
  type Rule = { source: string; destination: string };
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
  async function load(brandMode: "" | "doctorium") {
    vi.resetModules();
    vi.stubEnv("BRAND_MODE", brandMode);
    const { default: config } = await import("../../next.config");
    return { rewrites: await config.rewrites!(), redirects: (await config.redirects!()) as Rule[] };
  }

  it("Doctorium deploy'unda /tus → /doctorium/tus rewrite'ı var; AURA'da rewrite yok", async () => {
    const { rewrites } = await load("doctorium");
    expect((rewrites as { beforeFiles: Rule[] }).beforeFiles).toContainEqual({ source: "/tus", destination: "/doctorium/tus" });
    expect((await load("")).rewrites).toEqual([]);
  });

  it("/tus ve /doctorium/tus AURA'ya 307 listesinde DEĞİL", async () => {
    const { redirects } = await load("doctorium");
    expect(redirects.some((r) => r.source === "/tus" || r.source.startsWith("/tus/") || r.source.startsWith("/doctorium/tus"))).toBe(false);
  });

  it("krom: iki yolda da global Header/Footer gizli", () => {
    expect(hidesGlobalChrome("/tus")).toBe(true);
    expect(hidesGlobalChrome("/doctorium/tus")).toBe(true);
  });

  it("sitemap: Doctorium deploy'unda /tus var, AURA'da yok", async () => {
    vi.resetModules(); vi.stubEnv("BRAND_MODE", "doctorium");
    const doctorium = (await import("@/app/sitemap")).default().map((e) => e.url);
    expect(doctorium.some((u) => u.endsWith("/tus"))).toBe(true);
    vi.resetModules(); vi.stubEnv("BRAND_MODE", "");
    const aura = (await import("@/app/sitemap")).default().map((e) => e.url);
    expect(aura.some((u) => u.endsWith("/tus"))).toBe(false);
  });

  it("proxy kapısı yok: matcher /tus ve /doctorium ağacını içermez (herkese açık)", () => {
    const src = readFileSync(join(process.cwd(), "src/proxy.ts"), "utf8");
    const block = src.slice(src.indexOf("matcher: ["), src.indexOf("]", src.indexOf("matcher: [")));
    expect(block).not.toMatch(/"\/tus/);
    expect(block).not.toMatch(/"\/doctorium/);
  });

  it("sayfa /doctorium/tus'tadır; kök /tus sayfası YOK; canonical mutlak doctorium.tr/tus", () => {
    expect(existsSync(join(process.cwd(), "src/app/doctorium/tus/page.tsx"))).toBe(true);
    expect(existsSync(join(process.cwd(), "src/app/tus"))).toBe(false);
    const page = readFileSync(join(process.cwd(), "src/app/doctorium/tus/page.tsx"), "utf8");
    expect(page).toContain("DOCTORIUM_CANONICAL_URL");
    expect(page).toContain("approvedTusSummaries");
  });
});
