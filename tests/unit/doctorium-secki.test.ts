// Doctorium "Günlük Seçki" sayfası (doctorium.tr/secki) — sözleşmeler (v6.315, 2026-10-02; 👤 "bio'daki seçki sayfasını yapalım").
//
// Neden bu sayfa var: Instagram'da tıklanabilir link YOK (API'de parametre yok, uygulamada ücretli Meta Verified) → Reels/hikâye/altyazıdaki
// "Detaylar bio'daki bağlantıda" cümlesinin hedefi, günün başlıklarını KAYNAK LİNKLERİYLE gösteren kararlı bir sayfadır.
//
// Kilitlenenler:
//   1) SABİT AN: sayfa sabah kartıyla (07:45 TR) AYNI seçkiyi gösterir — gün içinde saat ilerleyince başlıklar KAYMAZ; anchor SONRASI
//      ingest edilen satır dışlanır; 07:45'ten önce açılan sayfa dünkü seçkiyi gösterir.
//   2) Veri: DB hatası bir kez yeniden denenir, ikincisi çağırana fırlar; sayfa hata/boş durumunu SAHTE içerik göstermeden çizer.
//   3) Görünüm modeli: yalnız http(s) bağlantı, alan adı "www."sız, boş özet null; sayfa HTML'i kaçışlıdır (XSS) ve dış bağlantılar noopener.
//   4) İddia disiplini: metinlerde "ücretsiz/akredite/uçtan uca/hekim…" YOK; platform tanımı kullanıcı-onaylı mevcut cümle.
//   5) Yönlendirme/marka: Doctorium deploy'unda /secki → /doctorium/secki rewrite'ı VAR, AURA deploy'unda YOK; AURA'ya 307 listesinde değil;
//      krom gizli; sitemap yalnız Doctorium'da; proxy kapısı yok (herkese açık); kök /secki sayfası YOK (marka ayrışması).
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SeckiPage } from "@/components/aura/doctorium-secki/SeckiPage";
import { SECKI_COPY, seckiAllText } from "@/lib/doctorium-secki/copy";
import { buildSeckiView, hostOf, safeHttpUrl, trDateLabel } from "@/lib/doctorium-secki/view";
import { hidesGlobalChrome } from "@/lib/chrome-routes";
import { loadPublicDigest, socialDigestAnchor, SOCIAL_ANCHOR_UTC } from "@/lib/social-digest-public";
import type { SocialArticle } from "@/lib/social-digest";

// ── DB taklidi (gerçek DB'ye dokunulmaz): findMany, where.createdAt gte/lte'yi gerçekten uygular ──
const h = vi.hoisted(() => ({ rows: [] as unknown[], calls: [] as unknown[], failNext: 0 }));
vi.mock("@/lib/db", () => ({
  db: {
    newsArticle: {
      findMany: async (args: { where: { createdAt: { gte: Date; lte?: Date } } }) => {
        h.calls.push(args);
        if (h.failNext > 0) { h.failNext--; throw new Error("db down"); }
        const { gte, lte } = args.where.createdAt;
        return (h.rows as SocialArticle[])
          .filter((r) => r.createdAt >= gte && (!lte || r.createdAt <= lte))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1));
      },
    },
  },
}));

const H = 3_600_000;
const art = (over: Partial<SocialArticle>): SocialArticle => ({
  id: "a", source: "pubmed", module: "akademik", kind: "makale", title: "Başlık", sourceName: "Kaynak", summary: "Özet.",
  url: "https://doi.org/10.1/x", branchSlugs: "[]", publishedAt: new Date("2026-09-30T06:00:00Z"), createdAt: new Date("2026-10-02T02:00:00Z"), ...over,
});

describe("socialDigestAnchor: son 07:45 TR (04:45 UTC) ≤ now", () => {
  const iso = (s: string) => socialDigestAnchor(new Date(s)).toISOString();
  it("sabit saat 04:45 UTC'dir (Türkiye'de yaz saati yok)", () => {
    expect(SOCIAL_ANCHOR_UTC).toEqual({ hour: 4, minute: 45 });
  });
  it("07:45'ten SONRA → aynı günün anchor'ı", () => {
    expect(iso("2026-10-02T04:45:00Z")).toBe("2026-10-02T04:45:00.000Z"); // tam anchor anı dahildir
    expect(iso("2026-10-02T04:45:01Z")).toBe("2026-10-02T04:45:00.000Z");
    expect(iso("2026-10-02T16:00:00Z")).toBe("2026-10-02T04:45:00.000Z");
    expect(iso("2026-10-02T23:59:59Z")).toBe("2026-10-02T04:45:00.000Z");
  });
  it("07:45'ten ÖNCE → dünün anchor'ı (o sabahın kartı henüz çıkmadı)", () => {
    expect(iso("2026-10-02T04:44:59Z")).toBe("2026-10-01T04:45:00.000Z");
    expect(iso("2026-10-02T00:30:00Z")).toBe("2026-10-01T04:45:00.000Z"); // 03:30 TR
  });
  it("ay/yıl sınırında doğru gün", () => {
    expect(iso("2026-11-01T02:00:00Z")).toBe("2026-10-31T04:45:00.000Z");
    expect(iso("2027-01-01T01:00:00Z")).toBe("2026-12-31T04:45:00.000Z");
  });
});

describe("loadPublicDigest: sabah kartıyla AYNI seçki", () => {
  afterEach(() => { vi.useRealTimers(); h.rows = []; h.calls = []; h.failNext = 0; });
  const MORNING = new Date("2026-10-02T04:50:00Z"); // 07:50 TR
  const EVENING = new Date("2026-10-02T17:00:00Z"); // 20:00 TR
  const ANCHOR = new Date("2026-10-02T04:45:00Z");

  it("gün etiketi anchor gününün TR tarihidir; sorgu penceresi [anchor−48s, anchor]", async () => {
    h.rows = [art({ id: "x1" })];
    const d = await loadPublicDigest(EVENING);
    expect(d.day).toBe("2026-10-02");
    const where = (h.calls[0] as { where: { createdAt: { gte: Date; lte: Date } } }).where.createdAt;
    expect(where.lte.toISOString()).toBe(ANCHOR.toISOString());
    expect(where.gte.toISOString()).toBe(new Date(ANCHOR.getTime() - 48 * H).toISOString());
  });

  it("SABİT: sabah ve akşam aynı başlıkları gösterir — saat ilerleyince 'bayatlayıp' donöre kaymaz", async () => {
    h.rows = [
      // anchor'da TAZE (21 sa önce), akşama kalsa 33 saatlik olup bayatlardı
      art({ id: "ak", createdAt: new Date(ANCHOR.getTime() - 21 * H), title: "Akademik" }),
      art({ id: "il", module: "ilac", kind: "ilac", createdAt: new Date(ANCHOR.getTime() - 3 * H), title: "İlaç" }),
    ];
    const sabah = await loadPublicDigest(MORNING);
    const aksam = await loadPublicDigest(EVENING);
    expect(aksam.items).toEqual(sabah.items);
    expect(sabah.items.map((i) => i.title)).toEqual(["Akademik", "İlaç"]);
    expect(sabah.items.every((i) => i.stale === false && i.replaces === null)).toBe(true);
  });

  it("anchor SONRASI ingest edilen satır dışlanır (kartta yoktu, sayfada da olmaz)", async () => {
    h.rows = [
      art({ id: "ak", title: "Sabahtan", createdAt: new Date(ANCHOR.getTime() - 2 * H) }),
      art({ id: "gec", title: "Öğleden sonra düştü", createdAt: new Date(ANCHOR.getTime() + 5 * H) }),
    ];
    const d = await loadPublicDigest(EVENING);
    expect(d.items.map((i) => i.title)).toEqual(["Sabahtan"]);
  });

  it("07:45'ten önce açılan sayfa DÜNKÜ seçkiyi gösterir", async () => {
    const dunAnchor = new Date("2026-10-01T04:45:00Z");
    h.rows = [
      art({ id: "dun", title: "Dünkü", createdAt: new Date(dunAnchor.getTime() - 2 * H) }),
      art({ id: "bugun", title: "Bugünkü", createdAt: new Date(ANCHOR.getTime() - 2 * H) }),
    ];
    const d = await loadPublicDigest(new Date("2026-10-02T03:00:00Z")); // 06:00 TR — bugünün kartı yok
    expect(d.day).toBe("2026-10-01");
    expect(d.items.map((i) => i.title)).toEqual(["Dünkü"]);
  });

  it("boş gün → items: [] (sahte içerik yok)", async () => {
    h.rows = [];
    const d = await loadPublicDigest(MORNING);
    expect(d.items).toEqual([]);
  });

  it("DB hatası bir kez yeniden denenir", async () => {
    vi.useFakeTimers();
    h.rows = [art({ id: "x1" })];
    h.failNext = 1;
    const p = loadPublicDigest(MORNING);
    await vi.advanceTimersByTimeAsync(500);
    const d = await p;
    expect(d.items).toHaveLength(1);
    expect(h.calls).toHaveLength(2);
  });

  it("ikinci hata çağırana fırlar (sayfa kendi hata durumunu çizer)", async () => {
    vi.useFakeTimers();
    h.failNext = 2;
    const assertion = expect(loadPublicDigest(MORNING)).rejects.toThrow("db down");
    await vi.advanceTimersByTimeAsync(500);
    await assertion;
    expect(h.calls).toHaveLength(2);
  });
});

describe("görünüm modeli (saf)", () => {
  it("trDateLabel: gün etiketi → '2 Ekim 2026'; biçimsiz girdi olduğu gibi", () => {
    expect(trDateLabel("2026-10-02")).toBe("2 Ekim 2026");
    expect(trDateLabel("2026-01-09")).toBe("9 Ocak 2026");
    expect(trDateLabel("2026-12-31")).toBe("31 Aralık 2026");
    expect(trDateLabel("bozuk")).toBe("bozuk");
    expect(trDateLabel("2026-13-01")).toBe("2026-13-01");
  });

  it("safeHttpUrl: yalnız http/https; javascript:/data:/boş reddedilir", () => {
    expect(safeHttpUrl("https://doi.org/10.1/x")).toBe("https://doi.org/10.1/x");
    expect(safeHttpUrl("http://example.org/a")).toBe("http://example.org/a");
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "ftp://x.org/a", "not a url", "", null, undefined]) {
      expect(safeHttpUrl(bad as string | null | undefined), String(bad)).toBeNull();
    }
  });

  it("hostOf: 'www.' atılır, yol/parametre taşınmaz", () => {
    expect(hostOf("https://www.klimik.org.tr/2026/10/01/x/")).toBe("klimik.org.tr");
    expect(hostOf("https://clinicaltrials.gov/study/NCT06200207")).toBe("clinicaltrials.gov");
    expect(hostOf("https://doi.org/10.1016/j.neurot.2026.e01089")).toBe("doi.org");
  });

  it("buildSeckiView: kart alanları aynen taşınır; kötü URL href'siz; ÖZET taşınmaz", () => {
    const view = buildSeckiView({
      day: "2026-10-02",
      rotation: { key: "radyasyon-onkolojisi", label: "Radyasyon Onkolojisi" },
      items: [
        { id: "1", stream: "akademik", streamLabel: "Akademik", title: "T1", sourceName: "Europe PMC", summary: "Kısa özet.", summaryLong: "Kısa özet. Uzun açıklama.", summaryLongFallback: false, url: "https://doi.org/10.1/x",
          publishedAt: "2026-10-01T00:00:00.000Z", branch: { key: "radyasyon-onkolojisi", label: "Radyasyon Onkolojisi" }, replaces: null, stale: false },
        { id: "2", stream: "mevzuat", streamLabel: "Mevzuat", title: "T2", sourceName: "T.C. Resmî Gazete", summary: "  ", summaryLong: "T.C. Resmî Gazete kaynağında 2 Ekim 2026 tarihinde yayımlandı; ayrıntı kaynak bağlantısında.", summaryLongFallback: true, url: "javascript:alert(1)",
          publishedAt: "2026-10-02T00:00:00.000Z", branch: null, replaces: null, stale: false },
      ],
    });
    expect(view.dateLabel).toBe("2 Ekim 2026");
    expect(view.rotationLabel).toBe("Radyasyon Onkolojisi");
    expect(view.items[0]).toMatchObject({ kicker: "Akademik", branchLabel: "Radyasyon Onkolojisi", href: "https://doi.org/10.1/x", host: "doi.org" });
    expect(view.items[1]).toMatchObject({ kicker: "Mevzuat", branchLabel: null, href: null, host: null });
    // Özet GÖSTERİLMEZ: seçki ucundaki teaser özetin veri kalitesi sayfaya uygun değil (İngilizce / site menüsü artığı / boş).
    expect(view.items[0]).not.toHaveProperty("summary");
    // v6.317: hikâye açıklaması (`summaryLong`) jetonlu uç içindir — halka açık görünüm modeline SIZMAZ.
    expect(view.items[0]).not.toHaveProperty("summaryLong");
    expect(view.items[0]).not.toHaveProperty("summaryLongFallback");
  });
});

describe("SeckiPage: sunucu tarafı HTML", () => {
  const view = buildSeckiView({
    day: "2026-10-02",
    rotation: { key: "radyasyon-onkolojisi", label: "Radyasyon Onkolojisi" },
    items: [
      { id: "1", stream: "akademik", streamLabel: "Akademik", title: "Gaz yakma ve kanser", sourceName: "Europe PMC", summary: "Ekolojik çalışma.", summaryLong: "Ekolojik çalışma. Uzun açıklama metni.", summaryLongFallback: false, url: "https://doi.org/10.1/x",
        publishedAt: "2026-10-01T00:00:00.000Z", branch: { key: "radyasyon-onkolojisi", label: "Radyasyon Onkolojisi" }, replaces: null, stale: false },
      { id: "2", stream: "ilac", streamLabel: "İlaç & Cihaz", title: "<script>alert(1)</script> Faz 3", sourceName: "ClinicalTrials.gov", summary: "", summaryLong: "ClinicalTrials.gov kaynağında 1 Ekim 2026 tarihinde yayımlandı; ayrıntı kaynak bağlantısında.", summaryLongFallback: true, url: null,
        publishedAt: "2026-10-01T00:00:00.000Z", branch: null, replaces: null, stale: false },
    ],
  });
  const html = renderToStaticMarkup(createElement(SeckiPage, { view }));

  it("h1, künye (tarih + <time>), günün branşı ve her içerik çizilir", () => {
    expect(html).toContain("<h1");
    expect(html).toContain(SECKI_COPY.h1);
    expect(html).toContain('<time dateTime="2026-10-02">2 Ekim 2026</time>');
    expect(html).toContain("Radyasyon Onkolojisi");
    expect(html.match(/<li /g)).toHaveLength(2);
  });

  it("bağlantılı kalemde başlık VE 'Kaynağa git' aynı hedefe gider; yeni sekme + noopener; alan adı görünür", () => {
    expect(html.match(/href="https:\/\/doi\.org\/10\.1\/x"/g)).toHaveLength(2);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener"');
    expect(html).toContain("Kaynağa git · doi.org");
  });

  it("özetler sayfada GÖRÜNMEZ — veri kalitesi (02.10: İngilizce özet, 'BackgroundGas' yapışık başlık, KLİMİK menü artığı) düzelene dek", () => {
    expect(html).not.toContain("Ekolojik çalışma."); // fixture'ın birinci kalemindeki özet
    expect(html).not.toContain("Uzun açıklama metni."); // v6.317: hikâye açıklaması (summaryLong) sayfaya da girmez
    expect(html).not.toContain("ayrıntı kaynak bağlantısında"); // dürüst yedek cümle de yalnız jetonlu uçta
    expect(html).not.toMatch(/<p class="mt-3 text-\[14\.5px\]/); // özet paragrafı sınıfı bile yok
  });

  it("bağlantısız kalemde başlık düz metin (anchor yok), HTML KAÇIŞLI", () => {
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt; Faz 3");
    expect(html).not.toContain("<script>alert");
    // Yalnız LİSTE içinde say: ortak footer'ın sosyal bağlantıları da yeni sekmede açılır (listeyle ilgisiz).
    const list = html.slice(html.indexOf("<ol"), html.indexOf("</ol>"));
    expect(list.match(/target="_blank"/g)).toHaveLength(2); // yalnız birinci kalemin iki bağlantısı
  });

  it("Doctorium tanımı (onaylı cümle) + içerik politikası bağlantısı + üyelik hedefleri", () => {
    expect(html).toContain("e-Devlet doğrulamalı doktorlar ve tıp öğrencilerine özel bir platformdur");
    expect(html).toContain('href="/doctorium/icerik-politikasi"');
    expect(html).toContain('href="/doctorium/kayit"');
    expect(html).toContain('href="/doctorium/ogrenci"');
  });

  it("boş gün: bilgi kutusu, liste YOK", () => {
    const empty = renderToStaticMarkup(createElement(SeckiPage, { view: { ...view, items: [] } }));
    expect(empty).toContain(SECKI_COPY.empty.title);
    expect(empty).not.toContain("<ol");
  });

  it("DB hatası (view=null): hata kutusu, tarih/liste YOK — sahte içerik çizilmez", () => {
    const failed = renderToStaticMarkup(createElement(SeckiPage, { view: null }));
    expect(failed).toContain(SECKI_COPY.failed.title);
    expect(failed).not.toContain("<ol");
    expect(failed).not.toContain("<time");
  });
});

describe("iddia disiplini — görünür metin + metadata", () => {
  const text = seckiAllText();
  it("yasak ifadeler yok: ücret, akreditasyon, uçtan uca, hekim, ölçülmemiş hız", () => {
    for (const re of [/ücretsiz/i, /ücret/i, /akredit/i, /uçtan uca/i, /hekim/i, /dakikalar içinde/i, /garanti/i]) {
      expect(text, String(re)).not.toMatch(re);
    }
  });
  it("platform tanımı kullanıcı-onaylı mevcut cümledir (X 04.09 + Instagram başlığı) — yeni iddia eklenmedi", () => {
    expect(SECKI_COPY.about.body).toBe(
      "Doctorium, e-Devlet doğrulamalı doktorlar ve tıp öğrencilerine özel bir platformdur. Akışınız seçtiğiniz branş ve bölümlere göre kurulur.",
    );
  });
  it("içerik sorumluluğu notu var: kaynağın yayını, otomatik çeviri olabilir, yayıncı değiliz", () => {
    expect(SECKI_COPY.note).toMatch(/otomatik olarak Türkçeleştirilmiş olabilir/);
    expect(SECKI_COPY.note).toMatch(/yayıncısı değildir/);
  });
});

describe("rota / marka sözleşmesi", () => {
  type Rule = { source: string; destination: string };
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
  async function load(brandMode: "" | "doctorium") {
    vi.resetModules();
    vi.stubEnv("BRAND_MODE", brandMode); // IS_DOCTORIUM_DEPLOY modül yüklenirken çözülür
    const { default: config } = await import("../../next.config");
    return {
      rewrites: await config.rewrites!(),
      redirects: (await config.redirects!()) as Rule[],
    };
  }

  it("Doctorium deploy'unda /secki → /doctorium/secki rewrite'ı var; kök rewrite'ı bozulmadı", async () => {
    const { rewrites } = await load("doctorium");
    const before = (rewrites as { beforeFiles: Rule[] }).beforeFiles;
    expect(before).toContainEqual({ source: "/secki", destination: "/doctorium/secki" });
    expect(before).toContainEqual({ source: "/", destination: "/doctorium" });
  });

  it("AURA deploy'unda rewrite YOK (Doctorium içeriği AURA kökünde yaşamaz)", async () => {
    const { rewrites } = await load("");
    expect(rewrites).toEqual([]);
  });

  it("/secki AURA'ya 307 listesinde DEĞİL (doctorium.tr'de servis edilir)", async () => {
    const { redirects } = await load("doctorium");
    expect(redirects.some((r) => r.source === "/secki" || r.source.startsWith("/secki/"))).toBe(false);
  });

  it("krom: iki yolda da global Header/Footer gizli (görünen yol /secki, iç yol /doctorium/secki)", () => {
    expect(hidesGlobalChrome("/secki")).toBe(true);
    expect(hidesGlobalChrome("/doctorium/secki")).toBe(true);
  });

  it("sitemap: Doctorium deploy'unda /secki var, AURA'da yok", async () => {
    vi.resetModules(); vi.stubEnv("BRAND_MODE", "doctorium");
    const doctorium = (await import("@/app/sitemap")).default().map((e) => e.url);
    expect(doctorium.some((u) => u.endsWith("/secki"))).toBe(true);
    vi.resetModules(); vi.stubEnv("BRAND_MODE", "");
    const aura = (await import("@/app/sitemap")).default().map((e) => e.url);
    expect(aura.some((u) => u.endsWith("/secki"))).toBe(false);
  });

  it("proxy kapısı yok: matcher /secki ve /doctorium ağacını içermez (herkese açık)", () => {
    const src = readFileSync(join(process.cwd(), "src/proxy.ts"), "utf8");
    const block = src.slice(src.indexOf("matcher: ["), src.indexOf("]", src.indexOf("matcher: [")));
    expect(block).not.toMatch(/"\/secki/);
    expect(block).not.toMatch(/"\/doctorium/);
  });

  it("sayfa /doctorium/secki'dir; kök /secki sayfası YOK (marka ayrışması — AURA kökünde Doctorium sayfası olmaz)", () => {
    expect(existsSync(join(process.cwd(), "src/app/doctorium/secki/page.tsx"))).toBe(true);
    expect(existsSync(join(process.cwd(), "src/app/secki"))).toBe(false);
  });

  it("canonical daima doctorium.tr/secki; ISR 10 dk (landing ile aynı desen)", () => {
    const page = readFileSync(join(process.cwd(), "src/app/doctorium/secki/page.tsx"), "utf8");
    expect(page).toContain("DOCTORIUM_CANONICAL_URL");
    expect(page).toMatch(/export const revalidate = 600;/);
  });
});
