// Doctorium hukuki yayın (v6.210, 2026-09-03) — üç sözleşme:
//  1) Kayıt (lib/doctorium-legal): beş belge, rota = /doctorium/<slug>, gövdeler yayına uygun
//     (taslak ibaresi / kimlik etiketi / iç-not emojisi / vault dosya atıfı SIZMAZ).
//  2) Krom + sitemap: LEGAL_PATHS ⊆ CHROME_FREE_ROUTES (AURA kromu Doctorium belgesine girmez) ve
//     Doctorium deploy sitemap'i beşini içerir.
//  3) Ayrıştırıcı (lib/doctorium-legal/markdown): tablo · liste · blockquote içi liste · bağlantı ·
//     satır içi biçim — metni değiştirmeden yapıya ayırır (1b'de aynı metin hash'lenir).
import { describe, it, expect, vi, afterEach } from "vitest";
import { LEGAL_DOCS, LEGAL_LINKS, LEGAL_PATHS, legalDoc, DOCTORIUM_OPERATOR_LABEL } from "@/lib/doctorium-legal";
import { parseLegalMarkdown, parseInline, headingId } from "@/lib/doctorium-legal/markdown";
import { CHROME_FREE_ROUTES } from "@/lib/chrome-routes";
import { SPONSOR_CONSENT_TEXT, SPONSOR_REVOKE_TEXT } from "@/lib/sponsor";
import { HR_CONTACT_CONSENT_TEXT, HR_CONTACT_REVOKE_TEXT } from "@/lib/hr-consent";
import { SURVEY_TERMS_ITEMS } from "@/lib/doctorium-legal/anket-kosullari";

describe("hukuki belge kaydı", () => {
  it("beş belge, benzersiz slug, rota = /doctorium/<slug>", () => {
    expect(LEGAL_DOCS).toHaveLength(5);
    expect(new Set(LEGAL_DOCS.map((d) => d.slug)).size).toBe(5);
    for (const d of LEGAL_DOCS) expect(d.path).toBe(`/doctorium/${d.slug}`);
    expect(LEGAL_DOCS.map((d) => d.slug)).toEqual(["aydinlatma", "kosullar", "cerez", "icerik-politikasi", "kvkk-basvuru"]);
  });

  it("gövdeler yayına uygun — taslak ibaresi, kimlik etiketi, iç-not işareti, vault atıfı YOK", () => {
    for (const d of LEGAL_DOCS) {
      expect(d.body.length, d.slug).toBeGreaterThan(1500);
      for (const bad of ["(TASLAK)", "[İŞLETİCİ", "[MERSİS", "[KEP", "[VERBİS", "👤", "✅", "⏳", "🔴", ".md`", "Karar gereken"]) {
        expect(d.body, `${d.slug} içinde '${bad}'`).not.toContain(bad);
      }
    }
  });

  it("işletici ifadesi ve iletişim kanalı aydınlatmada yer alır (👤 karar: tüzel kişilik kurulana dek)", () => {
    const a = legalDoc("aydinlatma")!;
    expect(a.body).toContain(DOCTORIUM_OPERATOR_LABEL);
    expect(a.body).toContain("bilgi@doctorium.tr");
    expect(a.body).toContain("## 1. Veri Sorumlusu");
    expect(a.body).toContain("Doctorium'da hasta verisi");
  });

  it("üyelik sözleşmesi kararları metinde: İzmir yetkisi · 15 gün itiraz · 5651 içerik sağlayıcı", () => {
    const k = legalDoc("kosullar")!.body;
    expect(k).toContain("İzmir Mahkemeleri ve İcra Daireleri");
    expect(k).toContain("15 gün");
    expect(k).toContain("içerik sağlayıcı");
    expect(k).not.toContain("[•]");
  });

  it("çerez politikası gerçek çerez adlarını yazar (v6.204 sonrası)", () => {
    const c = legalDoc("cerez")!.body;
    expect(c).toContain("`session`");
    expect(c).toContain("`theme`");
    expect(c).not.toContain("air_session");
    expect(c).not.toContain("aura_theme");
  });

  it("bağlantı listesi kayıtla aynı sırada; bilinmeyen slug null", () => {
    expect(LEGAL_LINKS.map((l) => l.href)).toEqual(LEGAL_PATHS);
    expect(legalDoc("yok")).toBeNull();
  });
});

describe("krom ve sitemap sözleşmesi", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

  it("LEGAL_PATHS ⊆ CHROME_FREE_ROUTES — AURA Header/SiteFooter Doctorium belgesine girmez", () => {
    for (const p of LEGAL_PATHS) expect(CHROME_FREE_ROUTES as readonly string[], p).toContain(p);
  });

  it("Doctorium deploy sitemap'i beş hukuki rotayı içerir; AURA sitemap'i içermez (çift indeks yok)", async () => {
    vi.resetModules(); vi.stubEnv("BRAND_MODE", "doctorium");
    const { default: sitemapDoctorium } = await import("@/app/sitemap");
    const dPaths = sitemapDoctorium().map((e) => new URL(e.url).pathname);
    for (const p of LEGAL_PATHS) expect(dPaths, p).toContain(p);

    vi.resetModules(); vi.stubEnv("BRAND_MODE", "");
    const { default: sitemapAura } = await import("@/app/sitemap");
    const aPaths = sitemapAura().map((e) => new URL(e.url).pathname);
    for (const p of LEGAL_PATHS) expect(aPaths, p).not.toContain(p);
  });
});

describe("markdown ayrıştırıcı", () => {
  it("satır içi: kalın · italik · kod · bağlantı · düz metin sırası korunur", () => {
    const n = parseInline("a **b** *c* `d` [e](/doctorium/cerez) f");
    expect(n.map((x) => x.t)).toEqual(["text", "bold", "text", "italic", "text", "code", "text", "link", "text"]);
    expect(n[7]).toEqual({ t: "link", v: "e", href: "/doctorium/cerez" });
  });

  it("tablo: başlık + satırlar; hücre içi biçim ayrıştırılır", () => {
    const b = parseLegalMarkdown("| A | B |\n|---|---|\n| **x** | y |\n| 1 | `k` |\n");
    expect(b).toHaveLength(1);
    const t = b[0];
    if (t.type !== "table") throw new Error("tablo bekleniyordu");
    expect(t.header.map((h) => h[0].v)).toEqual(["A", "B"]);
    expect(t.rows).toHaveLength(2);
    expect(t.rows[0][0][0]).toEqual({ t: "bold", v: "x" });
    expect(t.rows[1][1][0]).toEqual({ t: "code", v: "k" });
  });

  it("listeler: sırasız/sıralı ayrımı; girintili devam satırı maddeye eklenir", () => {
    const b = parseLegalMarkdown("- bir\n- iki\n  devam\n\n1. üç\n2. dört\n");
    expect(b.map((x) => x.type)).toEqual(["ul", "ol"]);
    const ul = b[0]; if (ul.type !== "ul") throw new Error();
    expect(ul.items[1].map((x) => x.v).join("")).toBe("iki devam");
    const ol = b[1]; if (ol.type !== "ol") throw new Error();
    expect(ol.items).toHaveLength(2);
  });

  it("blockquote içi liste ve paragraf yeniden ayrıştırılır (Word hattının aksine akmaz)", () => {
    const b = parseLegalMarkdown("> **Başlık**\n>\n> - a\n> - b\n");
    expect(b).toHaveLength(1);
    const q = b[0]; if (q.type !== "quote") throw new Error();
    expect(q.blocks.map((x) => x.type)).toEqual(["p", "ul"]);
  });

  it("başlıklar, yatay çizgi ve paragraf birleştirme; çapa kimliği Türkçe katlanır", () => {
    const b = parseLegalMarkdown("## 1. Veri Sorumlusu\n\nsatır bir\nsatır iki\n\n---\n\n### 3.1 Doktor üyeliğinde\n");
    expect(b.map((x) => x.type)).toEqual(["h2", "p", "hr", "h3"]);
    const p = b[1]; if (p.type !== "p") throw new Error();
    expect(p.inline[0].v).toBe("satır bir satır iki");
    const h = b[0]; if (h.type !== "h2") throw new Error();
    expect(headingId(h.inline)).toBe("1-veri-sorumlusu");
    const h3 = b[3]; if (h3.type !== "h3") throw new Error();
    expect(headingId(h3.inline)).toBe("3-1-doktor-uyeliginde");
  });

  it("gerçek belgeler ayrıştırılır: her biri başlık + (tablo veya liste) içerir; aydınlatma/sözleşme/çerez/başvuru tablolu", () => {
    for (const d of LEGAL_DOCS) {
      const blocks = parseLegalMarkdown(d.body);
      expect(blocks.some((x) => x.type === "h2"), d.slug).toBe(true);
      expect(blocks.some((x) => x.type === "table" || x.type === "ul" || x.type === "ol"), d.slug).toBe(true);
      expect(blocks.filter((x) => x.type === "p").length, d.slug).toBeGreaterThan(3);
    }
    // İçerik politikası (04 §A) tablo taşımaz — listeyle anlatır; diğer dördü tablolu.
    for (const slug of ["aydinlatma", "kosullar", "cerez", "kvkk-basvuru"] as const) {
      expect(parseLegalMarkdown(legalDoc(slug)!.body).some((x) => x.type === "table"), slug).toBe(true);
    }
  });
});

describe("canlı rıza/koşul sabitleri nihai (v6.210)", () => {
  it("sponsor rızası: (TASLAK) yok · 'pazar' yok · Tercihler · hizmet şartı değil", () => {
    for (const t of [SPONSOR_CONSENT_TEXT, SPONSOR_REVOKE_TEXT]) expect(t).not.toContain("(TASLAK)");
    expect(SPONSOR_CONSENT_TEXT).not.toContain("pazar");
    expect(SPONSOR_CONSENT_TEXT).toContain("Tercihler");
    expect(SPONSOR_CONSENT_TEXT).toContain("hizmet şartı olmadığını");
    expect(SPONSOR_CONSENT_TEXT).toContain("takip ettiğim branşlar");
  });

  it("İK rızası: 'açık rıza' terimi · platform içi mesaj · iletişim bilgisi aktarılmaz · modül kapalı", () => {
    for (const t of [HR_CONTACT_CONSENT_TEXT, HR_CONTACT_REVOKE_TEXT]) {
      expect(t).not.toContain("(TASLAK)");
      expect(t).not.toMatch(/AÇIK ONAM|açık onam/);
    }
    expect(HR_CONTACT_CONSENT_TEXT).toContain("platform içi mesaj");
    expect(HR_CONTACT_CONSENT_TEXT).toContain("aktarılmayacağını");
    expect(HR_CONTACT_CONSENT_TEXT).toContain("henüz kullanıma açılmamıştır");
  });

  it("anket koşulları: gönüllülük · anonim değil · geri alınamaz · ücretli ankette puan yok · itiraz kanalı", () => {
    const all = SURVEY_TERMS_ITEMS.join(" ");
    expect(SURVEY_TERMS_ITEMS.length).toBeGreaterThanOrEqual(6);
    for (const s of ["gönüllüdür", "anonim değildir", "geri alınamaz", "ayrıca puan verilmez", "bilgi@doctorium.tr"]) expect(all).toContain(s);
    expect(all).not.toContain("(TASLAK)");
  });
});
