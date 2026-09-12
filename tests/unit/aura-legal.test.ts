// AURA hukuki yayın (kod Paket A, v6.268 · 2026-09-13) — dört sözleşme:
//  1) Kayıt (lib/aura-legal): beş belge, rota = /<slug>, /tele-saglik yayımsız (A03 yayın şartı); gövdeler TR + EN yayına
//     uygun (kimlik etiketi / iç kılavuz atfı / iç-not işareti / vault dosya atıfı / "hekim" SIZMAZ) ve ayrıştırılır.
//  2) Krom + sitemap + marka korkuluğu: AURA_LEGAL_PATHS ⊆ CHROME_FREE_ROUTES; AURA sitemap'i yayımlı dördü içerir,
//     /tele-saglik'i ve Doctorium deploy sitemap'i hiçbirini içermez; next.config AURA_ONLY_PREFIXES beşini de taşır.
//  3) Footer: 9 dilde "Hukuki" grubu anahtarları dolu; AuraFooter bağlantıları yalnız yayımlı rotalar.
//  4) Sentetik kontrol + kayıt formu: yayımlı dört rota izlenir, yayımsız izlenmez; hasta kaydı /aydinlatma'ya bağlanır.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  AURA_LEGAL_DOCS, AURA_LEGAL_PATHS, AURA_LEGAL_PUBLISHED_PATHS, AURA_OPERATOR_LABEL, auraLegalDoc, auraLegalHref, auraLegalLang,
} from "@/lib/aura-legal";
import { parseLegalMarkdown } from "@/lib/doctorium-legal/markdown";
import { CHROME_FREE_ROUTES } from "@/lib/chrome-routes";
import { COPY, LANG_CODES } from "@/lib/aura-landing/copy";

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");
const LANGS = ["tr", "en"] as const;
const BAD = [
  "[İŞLETİCİ", "[MERSİS", "[KEP", "[VERBİS", "[AURA KANAL", "[AB TEMSİLCİSİ]", "[KLİNİK HİZMET", "[USHAŞ", "[TIBBİ", "[SAKLAMA",
  "Kılavuz", "Guide, Section", "👤", "✅", "⏳", "🔴", "(TASLAK)", ".md`", "§", "hekim",
];

describe("hukuki belge kaydı (lib/aura-legal)", () => {
  it("beş belge, sabit sıra, rota = /<slug>; yalnız /tele-saglik yayımsız", () => {
    expect(AURA_LEGAL_DOCS.map((d) => d.slug)).toEqual(["aydinlatma", "kosullar", "tele-saglik", "cerez", "kvkk-basvuru"]);
    for (const d of AURA_LEGAL_DOCS) expect(d.path).toBe(`/${d.slug}`);
    expect(AURA_LEGAL_PUBLISHED_PATHS).toEqual(["/aydinlatma", "/kosullar", "/cerez", "/kvkk-basvuru"]);
    expect(auraLegalDoc("tele-saglik")?.published).toBe(false);
    expect(auraLegalDoc("yok")).toBeNull();
  });

  it("gövdeler TR + EN yayına uygun: kimlik etiketi, iç kılavuz atfı, iç-not işareti, vault atıfı, 'hekim' YOK", () => {
    for (const d of AURA_LEGAL_DOCS) {
      for (const lang of LANGS) {
        const body = d.body[lang];
        expect(body.length, `${d.slug}/${lang}`).toBeGreaterThan(1200);
        for (const bad of BAD) expect(body, `${d.slug}/${lang} içinde '${bad}'`).not.toContain(bad);
        expect(body.startsWith("## "), `${d.slug}/${lang} ilk satır`).toBe(true); // H1/sürüm satırı/kimlik notu düşmüş
      }
      expect(d.title.tr).not.toBe(d.title.en);
      expect(d.description.tr.length).toBeGreaterThan(40);
      expect(d.description.en.length).toBeGreaterThan(40);
    }
  });

  it("aydınlatma: işletici yer tutucusu + platform içi form kanalı (S6) + GDPR + açık rıza kutusu", () => {
    const a = auraLegalDoc("aydinlatma")!;
    expect(a.body.tr).toContain(AURA_OPERATOR_LABEL.tr);
    expect(a.body.en).toContain(AURA_OPERATOR_LABEL.en);
    expect(a.body.tr).toContain("## 1. Veri sorumlusu");
    expect(a.body.tr).toContain("](/kvkk-basvuru)");
    expect(a.body.tr).toContain("GDPR");
    expect(a.body.tr).toContain("açık rızam vardır"); // madde 14 beyanı (kutu ekranda, metinde değil)
    expect(a.body.tr).not.toContain("bilgi@"); // e-posta kanalı kutu açılana dek yayımlanmaz
  });

  it("koşullar: kararlar metinde (İzmir yetkisi · takvim günü · Ek 1 dormant); belge atıfları yayımlı rotalara bağlı", () => {
    const k = auraLegalDoc("kosullar")!;
    expect(k.body.tr).toContain("İzmir");
    expect(k.body.tr).toContain("takvim günü");
    expect(k.body.tr).toContain("[Belge A01](/aydinlatma)");
    expect(k.body.en).toContain("[Document A01](/aydinlatma)");
    expect(k.body.tr).not.toContain("[Belge A03]"); // A03 yayımsız → bağlanmaz
  });

  it("çerez: gerçek çerez adları ve yerel depolama anahtarları", () => {
    const c = auraLegalDoc("cerez")!.body.tr;
    for (const s of ["`session`", "`theme`", "air_lang", "air_preconsult_bigtext"]) expect(c).toContain(s);
  });

  it("KVKK başvurusu: yalnız A bölümü yayımlanır (B iç işleyiş yok), platform içi form rotası anılır", () => {
    const b = auraLegalDoc("kvkk-basvuru")!;
    expect(b.body.tr).toContain("`/kvkk-basvuru`");
    expect(b.body.tr).toContain("## A.1");
    expect(b.body.tr).not.toContain("İÇ İŞLEYİŞ");
    expect(b.body.tr).not.toContain("KvkkApplication");
    expect(b.body.en).not.toContain("INTERNAL OPERATION");
  });

  it("gerçek belgeler ayrıştırılır: başlık + (tablo veya liste); aydınlatma/koşullar/çerez/başvuru tablolu", () => {
    for (const d of AURA_LEGAL_DOCS) {
      for (const lang of LANGS) {
        const blocks = parseLegalMarkdown(d.body[lang]);
        expect(blocks.some((x) => x.type === "h2"), `${d.slug}/${lang}`).toBe(true);
        expect(blocks.some((x) => x.type === "table" || x.type === "ul" || x.type === "ol"), `${d.slug}/${lang}`).toBe(true);
        expect(blocks.filter((x) => x.type === "p").length, `${d.slug}/${lang}`).toBeGreaterThan(3);
      }
    }
    for (const slug of ["aydinlatma", "kosullar", "cerez", "kvkk-basvuru"] as const) {
      expect(parseLegalMarkdown(auraLegalDoc(slug)!.body.tr).some((x) => x.type === "table"), slug).toBe(true);
    }
  });

  it("dil yardımcıları: yalnız 'en' İngilizce, gerisi TR kanonik; EN bağlantısı ?lang=en", () => {
    expect(auraLegalLang("en")).toBe("en");
    expect(auraLegalLang(["en"])).toBe("en");
    expect(auraLegalLang("tr")).toBe("tr");
    expect(auraLegalLang("de")).toBe("tr");
    expect(auraLegalLang(undefined)).toBe("tr");
    expect(auraLegalHref("/cerez", "tr")).toBe("/cerez");
    expect(auraLegalHref("/cerez", "en")).toBe("/cerez?lang=en");
  });
});

describe("krom, sitemap ve marka korkuluğu sözleşmesi", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

  it("AURA_LEGAL_PATHS ⊆ CHROME_FREE_ROUTES — sayfa kendi vitrin kabuğunu taşır (global Header/SiteFooter girmez)", () => {
    for (const p of AURA_LEGAL_PATHS) expect(CHROME_FREE_ROUTES as readonly string[], p).toContain(p);
  });

  it("AURA sitemap'i yayımlı dördü içerir, /tele-saglik'i içermez; Doctorium deploy sitemap'i hiçbirini içermez", async () => {
    vi.resetModules(); vi.stubEnv("BRAND_MODE", "");
    const { default: sitemapAura } = await import("@/app/sitemap");
    const aPaths = sitemapAura().map((e) => new URL(e.url).pathname);
    for (const p of AURA_LEGAL_PUBLISHED_PATHS) expect(aPaths, p).toContain(p);
    expect(aPaths).not.toContain("/tele-saglik");

    vi.resetModules(); vi.stubEnv("BRAND_MODE", "doctorium");
    const { default: sitemapDoctorium } = await import("@/app/sitemap");
    const dPaths = sitemapDoctorium().map((e) => new URL(e.url).pathname);
    for (const p of AURA_LEGAL_PATHS) expect(dPaths, p).not.toContain(p);
  });

  it("next.config AURA_ONLY_PREFIXES beş rotayı da taşır (doctorium.tr → AURA 307)", () => {
    const cfg = read("next.config.ts");
    const block = cfg.slice(cfg.indexOf("const AURA_ONLY_PREFIXES"), cfg.indexOf("];", cfg.indexOf("const AURA_ONLY_PREFIXES")));
    for (const p of AURA_LEGAL_PATHS) expect(block, p).toContain(`"${p}"`);
  });
});

describe("footer, sentetik kontrol ve kayıt formu bağlantıları", () => {
  it("9 dilde footer 'Hukuki' grubu anahtarları dolu", () => {
    for (const lang of LANG_CODES) {
      const f = COPY[lang as keyof typeof COPY].footer as Record<string, string>;
      for (const key of ["legalGroup", "privacyNotice", "terms", "cookies", "dataRequests"]) {
        expect(typeof f[key], `${lang}.footer.${key}`).toBe("string");
        expect(f[key].trim().length, `${lang}.footer.${key}`).toBeGreaterThan(2);
      }
    }
  });

  it("AuraFooter yalnız yayımlı rotalara bağlanır; /tele-saglik yok", () => {
    const src = read("src/components/aura/aura-footer.tsx");
    for (const p of AURA_LEGAL_PUBLISHED_PATHS) expect(src, p).toContain(`href="${p}"`);
    expect(src).not.toContain('href="/tele-saglik"');
  });

  it("sentetik kontrol yayımlı dört rotayı izler, yayımsız rotayı izlemez; doctorium.tr korkuluğu /aydinlatma'yı denetler", () => {
    const src = read("scripts/synthetic-checks.mjs");
    for (const p of AURA_LEGAL_PUBLISHED_PATHS) expect(src, p).toContain(`path: "${p}"`);
    expect(src).not.toContain('path: "/tele-saglik"');
    expect(src).toContain("locationStartsWith: `${AURA_BASE}/aydinlatma`");
  });

  it("hasta kayıt formu aydınlatma ve koşullara bağlanır (KVKK m.10 kayıt anı bilgilendirmesi)", () => {
    const src = read("src/components/PatientSignupForm.tsx");
    expect(src).toContain('href="/aydinlatma"');
    expect(src).toContain('href="/kosullar"');
  });
});
