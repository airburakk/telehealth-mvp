// v6.328 — `infra/kart/lib/social-rubrik.mjs` (içerik takvimi rubrik slaytları): girdi doğrulaması · şablon güvenliği (girdi HTML'e ham girmez) ·
// çerçevenin kartla/karuselle AYNI kalması · `renderRubrik` (sahte tarayıcı: sıra, sığdırma bayrağı, sayfa kapanışı) · HTTP kapıları
// (Bearer · meşgul 503 · eşzamanlı 429 · gövde sınırı 413 · geçersiz gövde 400 · render hatası 500 İÇ MESAJ SIZDIRMAZ). ffmpeg/Chromium GEREKMEZ.
import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { ROLLER, SABLONLAR, SINIR, createRubrik, renderRubrik, rubrikGovdeDogrula, rubrikSayfaHtml, yetkili } from "../../infra/kart/lib/social-rubrik.mjs";

const KOK = process.cwd();
const oku = (rel: string) => fs.readFileSync(path.join(KOK, rel), "utf8");
const KURE = path.join(KOK, "infra/kart/assets/doctorium-sphere-disk-1024-v3.webp");

type Slayt = { role: string; title: string; body: string; bullets?: string[]; quote?: boolean };
const model = (slides: Slayt[], ek: Record<string, unknown> = {}) => ({ templateKey: "karar-masasi", seriesName: "Karar masası", slotDay: "2026-10-07", slides, ...ek });
const TAM: Slayt[] = [
  { role: "kapak", title: "Komplikasyon mu, özen kusuru mu?", body: "Yargıtay 3. Hukuk Dairesi · E. 1, K. 2 · 13.05.2026" },
  { role: "uyusmazlik", title: "Uyuşmazlık", body: "Uyuşmazlık, tazminat istemine ilişkindir.", quote: true },
  { role: "mahkeme", title: "Mahkeme ve temyiz", body: "", bullets: ["İlk derece: 2. Tüketici Mahkemesi · 1 E.", "Temyiz: Yargıtay 3. Hukuk Dairesi"] },
  { role: "gerekce", title: "Yargıtay gerekçesi", body: "Baş cümle […] son cümle.", quote: true },
  { role: "sonuc", title: "Karar onandı", body: "Onama: Yargıtay, temyiz edilen kararı yerinde bulmuştur.\n\nKarar tarihi: 13.05.2026 · oy birliği" },
  { role: "cikarim", title: "Doktor için çıkarım", body: "", bullets: ["Birinci çıkarım maddesi", "İkinci çıkarım maddesi", "Üçüncü çıkarım maddesi"] },
  { role: "kaynak", title: "Kaynak ve uyarı", body: "Kaynak: Yargıtay.\n\nBu içerik bilgilendirme amaçlıdır; hukuki görüş değildir." },
];

describe("rubrikGovdeDogrula", () => {
  it("geçerli gövdeyi normalize eder (bullets/quote varsayılanları)", () => {
    const g = rubrikGovdeDogrula(model([{ role: "kapak", title: "  Başlık ", body: "Gövde" }]));
    expect(g.ok).toBe(true);
    if (g.ok) expect((g.model as { slides: unknown[] }).slides[0]).toEqual({ role: "kapak", title: "Başlık", body: "Gövde", bullets: [], quote: false });
  });
  it("her şablon anahtarı ve rol kabul edilir; bilinmeyenler 400 nedenine düşer", () => {
    for (const t of SABLONLAR) expect(rubrikGovdeDogrula(model([{ role: "kapak", title: "a", body: "b" }], { templateKey: t })).ok).toBe(true);
    for (const r of ROLLER) expect(rubrikGovdeDogrula(model([{ role: r, title: "a", body: "b" }])).ok).toBe(true);
    expect(rubrikGovdeDogrula(model([{ role: "kapak", title: "a", body: "b" }], { templateKey: "yok" }))).toMatchObject({ ok: false });
    expect(rubrikGovdeDogrula(model([{ role: "yok", title: "a", body: "b" }]))).toMatchObject({ ok: false });
  });
  it("sınır ihlalleri ve geçersiz biçimler reddedilir", () => {
    const bad = (m: unknown) => {
      const g = rubrikGovdeDogrula(m);
      return g.ok ? null : g.hata;
    };
    expect(bad(null)).toMatch(/nesne/);
    expect(bad([])).toMatch(/nesne/);
    expect(bad(model([]))).toMatch(/slides/);
    expect(bad(model(Array.from({ length: SINIR.slayt + 1 }, () => ({ role: "genel", title: "a", body: "b" }))))).toMatch(/slides/);
    expect(bad(model([{ role: "kapak", title: "x".repeat(SINIR.baslik + 1), body: "" }]))).toMatch(/başlık/);
    expect(bad(model([{ role: "kapak", title: "a", body: "x".repeat(SINIR.govde + 1) }]))).toMatch(/gövde/);
    expect(bad(model([{ role: "mahkeme", title: "a", body: "", bullets: Array.from({ length: SINIR.maddeSayisi + 1 }, () => "x") }]))).toMatch(/maddeler/);
    expect(bad(model([{ role: "mahkeme", title: "a", body: "", bullets: [5 as unknown as string] }]))).toMatch(/maddeler/);
    expect(bad(model([{ role: "genel", title: "", body: "" }]))).toMatch(/boş/);
    expect(bad(model([{ role: "kapak", title: "a", body: "b" }], { slotDay: "2026-02-30" }))).toMatch(/slotDay/);
    expect(bad(model([{ role: "kapak", title: "a", body: "b" }], { slotDay: "07.10.2026" }))).toMatch(/slotDay/);
    expect(bad(model([{ role: "kapak", title: "a", body: "b" }], { seriesName: "" }))).toMatch(/seriesName/);
  });
  it("boş çıkarım slaytı (insan henüz yazmadı) önizlemede serbest", () => {
    expect(rubrikGovdeDogrula(model([{ role: "cikarim", title: "Doktor için çıkarım", body: "", bullets: [] }])).ok).toBe(true);
  });
});

describe("şablon güvenliği ve yapı", () => {
  const html = (slides: Slayt[]) => {
    const g = rubrikGovdeDogrula(model(slides));
    if (!g.ok) throw new Error(g.hata);
    return rubrikSayfaHtml(g.model, "data:image/webp;base64,AAAA");
  };
  it("girdi HTML'e ham girmez: başlık/gövde/madde/seri adı kaçışlanır", () => {
    const h = html([
      { role: "kapak", title: "<script>alert(1)</script>", body: "<img src=x onerror=alert(2)>" },
      { role: "cikarim", title: "Doktor için çıkarım", body: "", bullets: ["<b>kalın</b> & tırnak"] },
      { role: "mahkeme", title: "Mahkeme ve temyiz", body: "", bullets: ["Etiket: <i>değer</i>"] },
    ]);
    expect(h).not.toContain("<script>");
    expect(h).not.toContain("<img src=x");
    expect(h).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(h).toContain("&lt;b&gt;kalın&lt;/b&gt; &amp; tırnak");
    expect(h).toContain("<b>Etiket</b>&lt;i&gt;değer&lt;/i&gt;");
    const g = rubrikGovdeDogrula(model([{ role: "kapak", title: "a", body: "b" }], { seriesName: "<u>Rubrik</u>" }));
    if (g.ok) expect(rubrikSayfaHtml(g.model, "x")).toContain("&lt;u&gt;Rubrik&lt;/u&gt;");
  });
  it("lang=tr ŞART (büyük harf etiketler İ ile çıksın); her slayt ayrı bölüm; sıra/rol/indeks doğru", () => {
    const h = html(TAM);
    expect(h).toContain('<html lang="tr">');
    expect(h.match(/<section class="slide"/g)).toHaveLength(7);
    expect(h).toContain('data-role="kapak"');
    expect(h).toContain('data-i="6" data-role="kaynak"');
    expect(h).toContain("1/7");
    expect(h).toContain("7/7");
    expect(h).toContain("7 Ekim 2026");
  });
  it("alıntı slaytı kenar çizgili blok + 'aynen alıntı' notu; atlama işareti vurgulanır; alıntı olmayanda yok", () => {
    const h = html(TAM);
    expect(h).toContain('<div class="alinti">');
    expect(h).toContain("Karar metninden aynen alıntıdır");
    expect(h).toContain('<span class="elip">[…]</span>');
    const duz = html([{ role: "genel", title: "Başlık", body: "Düz metin." }]);
    expect(duz).not.toContain('<div class="alinti">');
    expect(duz).not.toContain("aynen alıntıdır");
  });
  it("mahkeme zinciri etiketi vurgular; çıkarım numaralı; uyarı paragrafı kutulanır; rol başlığı tekrarlanmaz", () => {
    const h = html(TAM);
    expect(h).toContain('<li><span class="no mono">1</span><span class="t"><b>İlk derece</b>');
    expect(h).toContain('<ol class="cikarim">');
    expect(h).toContain('class="metin uyari"');
    expect(h).not.toContain("<h2>Uyuşmazlık</h2>"); // başlık = rol etiketi → künyede zaten var
    expect(h).toContain("<h2>Karar onandı</h2>"); // sonuç başlığı özgün → gösterilir
  });
  it("kod satırlarında \\uXXXX kaçışı ve emoji yok (araçlar kaçışı gerçek karaktere çevirir; imajda emoji yazı tipi yok) — açıklama satırları hariç", () => {
    const kod = oku("infra/kart/lib/social-rubrik.mjs")
      .split("\n")
      .filter((l) => !l.trim().startsWith("//"))
      .join("\n");
    expect(kod).not.toMatch(/\\u[0-9a-fA-F]{4}/);
    expect(kod).not.toMatch(/[\u{1F300}-\u{1FAFF}☀-➿]/u);
  });
});

describe("çerçeve kartla/karuselle AYNI sayılar", () => {
  it("dolgu 72/84/64 · üst çizgi 3px · künye 22px · alt marka çubuğu · .main dikey boşluğu 40 (sığdırma ölçümüyle sözleşmeli)", () => {
    const rub = oku("infra/kart/lib/social-rubrik.mjs");
    const car = oku("infra/kart/lib/social-carousel.mjs");
    const srv = oku("infra/kart/server.mjs");
    for (const parca of ["padding:72px 84px 64px", "border-top:3px solid #18181b", "font-size:22px; letter-spacing:.14em", "padding-top:26px", "font-size:38px; font-weight:600"]) {
      expect(rub, parca).toContain(parca);
      expect(car, parca).toContain(parca);
    }
    expect(rub).toContain("const PAD_ANA = 40");
    expect(car).toContain("const PAD_ANA = 40");
    expect(srv).toContain("padding:72px 84px 64px");
  });
  it("küre görseli aynı dosya; yazı tipi bağlantısı karuselle aynı", () => {
    expect(fs.existsSync(KURE)).toBe(true);
    const link = (s: string) => /<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]+>/.exec(s)?.[0];
    expect(link(oku("infra/kart/lib/social-rubrik.mjs"))).toBe(link(oku("infra/kart/lib/social-carousel.mjs")));
  });
});

describe("renderRubrik (sahte tarayıcı)", () => {
  function sahteTarayici(opts: { bosluk?: number[]; hata?: boolean } = {}) {
    const sayfalar: { kapandi: boolean; html: string; ekranlar: string[] }[] = [];
    return {
      sayfalar,
      newPage: async () => {
        const kayit = { kapandi: false, html: "", ekranlar: [] as string[] };
        sayfalar.push(kayit);
        return {
          setContent: async (h: string) => {
            kayit.html = h;
            if (opts.hata) throw new Error("setContent patladı");
          },
          // argümansız = fonts.ready / yazı tipi kapısı; argümanlı = sığdırma ölçümü (slayt başına dizi döner)
          evaluate: async (_fn: unknown, arg?: { pad: number }) =>
            arg === undefined ? { inter: true, mono: true } : (opts.bosluk ?? []).map((b) => ({ t: 50, b: 30, bosluk: b })).concat(Array.from({ length: 12 }, () => ({ t: 50, b: 30, bosluk: 10 }))),
          locator: (sel: string) => ({ screenshot: async () => { kayit.ekranlar.push(sel); return Buffer.from(`png:${sel}`); } }),
          close: async () => { kayit.kapandi = true; },
        };
      },
    };
  }
  const girdi = () => {
    const g = rubrikGovdeDogrula(model(TAM));
    if (!g.ok) throw new Error(g.hata);
    return g.model;
  };

  it("tek sayfa, tek yükleme; her slayt kendi öğesinden sırayla çekilir; sayfa kapanır", async () => {
    const b = sahteTarayici();
    const r = await renderRubrik({ model: girdi(), browser: b, spherePath: KURE });
    expect(b.sayfalar).toHaveLength(1);
    expect(b.sayfalar[0]?.kapandi).toBe(true);
    expect(b.sayfalar[0]?.ekranlar).toEqual(Array.from({ length: 7 }, (_, i) => `.slide[data-i="${i}"]`));
    expect(r.slides.map((s) => [s.index, s.role])).toEqual(TAM.map((s, i) => [i, s.role]));
    expect(r.slides.every((s) => s.tasma === false)).toBe(true);
    expect(Buffer.isBuffer(r.slides[0]?.png)).toBe(true);
  });
  it("asgari puntoda bile sığmayan slayt tasma:true işaretlenir (editör kısaltsın)", async () => {
    const b = sahteTarayici({ bosluk: [10, 10, 10, -42, 10, 10, 10] });
    const r = await renderRubrik({ model: girdi(), browser: b, spherePath: KURE });
    expect(r.slides.map((s) => s.tasma)).toEqual([false, false, false, true, false, false, false]);
  });
  it("hata yolunda sayfa kapanır ve hata yutulmaz", async () => {
    const b = sahteTarayici({ hata: true });
    await expect(renderRubrik({ model: girdi(), browser: b, spherePath: KURE })).rejects.toThrow(/setContent patladı/);
    expect(b.sayfalar.every((s) => s.kapandi)).toBe(true);
  });
});

describe("yetkili — Bearer karşılaştırması", () => {
  it("yalnız tam eşleşme; boş/eksik/yanlış reddedilir", () => {
    expect(yetkili("Bearer sir-123", "sir-123")).toBe(true);
    expect(yetkili("Bearer sir-124", "sir-123")).toBe(false);
    expect(yetkili("sir-123", "sir-123")).toBe(false);
    expect(yetkili("", "sir-123")).toBe(false);
    expect(yetkili(undefined, "sir-123")).toBe(false);
    expect(yetkili("Bearer sir-123 ", "sir-123")).toBe(false);
  });
});

// ── HTTP kapıları: GERÇEK sunucu + sahte çizici ─────────────────────────────────────────────────────
describe("POST /rubrik/render", () => {
  const TOKEN = "kart-test-jetonu";
  let sunucu: http.Server | null = null;

  async function kur(o: { mesgul?: boolean; render?: (a: unknown) => Promise<unknown>; token?: string } = {}) {
    const log: string[] = [];
    let cagri = 0;
    const rubrik = createRubrik({
      getBrowser: async () => ({}),
      spherePath: KURE,
      token: o.token ?? TOKEN,
      mesgul: () => o.mesgul === true,
      log: (m: string) => log.push(m),
      render:
        o.render ??
        (async () => {
          cagri++;
          return { slides: [{ index: 0, role: "kapak", png: Buffer.from("PNG-BAYT"), tasma: false }, { index: 1, role: "kaynak", png: Buffer.from("PNG-2"), tasma: true }] };
        }),
    });
    sunucu = http.createServer(async (req, res) => {
      if (await rubrik.handle(req, res)) return;
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((r) => sunucu!.listen(0, "127.0.0.1", r));
    const port = (sunucu.address() as AddressInfo).port;
    const post = (govde: unknown, h: Record<string, string> = { authorization: `Bearer ${TOKEN}` }, yol = "/rubrik/render", yontem = "POST") =>
      fetch(`http://127.0.0.1:${port}${yol}`, { method: yontem, headers: { "content-type": "application/json", ...h }, body: yontem === "GET" ? undefined : typeof govde === "string" ? govde : JSON.stringify(govde) });
    return { post, log, cagri: () => cagri };
  }
  afterEach(async () => {
    if (sunucu) {
      sunucu.closeAllConnections();
      await new Promise<void>((r) => sunucu!.close(() => r()));
      sunucu = null;
    }
  });

  it("başarı: slaytlar base64 PNG olarak döner; taşma bayrağı korunur", async () => {
    const t = await kur();
    const res = await t.post(model(TAM));
    expect(res.status).toBe(200);
    const j = (await res.json()) as { slides: { index: number; role: string; png: string; tasma: boolean }[] };
    expect(j.slides.map((s) => [s.index, s.role, s.tasma])).toEqual([[0, "kapak", false], [1, "kaynak", true]]);
    expect(Buffer.from(j.slides[0]!.png, "base64").toString()).toBe("PNG-BAYT");
    expect(t.log.join("\n")).toContain("TAŞMA var");
  });
  it("kimlik: Bearer yok/yanlış → 401 (çizici ÇAĞRILMAZ)", async () => {
    const t = await kur();
    expect((await t.post(model(TAM), {})).status).toBe(401);
    expect((await t.post(model(TAM), { authorization: "Bearer yanlis" })).status).toBe(401);
    expect(t.cagri()).toBe(0);
  });
  it("jeton tanımsızsa uç KAPALI (503) — boş jetonla 'Bearer ' gönderen de geçemez", async () => {
    const t = await kur({ token: "" });
    expect((await t.post(model(TAM), { authorization: "Bearer " })).status).toBe(503);
    expect((await t.post(model(TAM))).status).toBe(503);
    expect(t.cagri()).toBe(0);
  });
  it("yöntem: GET → 405 + Allow; bilinmeyen yol bu modüle ait DEĞİL (404 çağıranda)", async () => {
    const t = await kur();
    const g = await t.post("", undefined, "/rubrik/render", "GET");
    expect(g.status).toBe(405);
    expect(g.headers.get("allow")).toBe("POST");
    expect((await t.post(model(TAM), undefined, "/baska")).status).toBe(404);
  });
  it("sosyal üretim sürerken 503 — sabah akışı bu uç yüzünden aksamaz (çizici çağrılmaz)", async () => {
    const t = await kur({ mesgul: true });
    const res = await t.post(model(TAM));
    expect(res.status).toBe(503);
    expect(((await res.json()) as { hata: string }).hata).toContain("sosyal üretim");
    expect(t.cagri()).toBe(0);
  });
  it("geçersiz gövde → 400 (JSON değil · şema); aşırı büyük gövde → 413", async () => {
    const t = await kur();
    expect((await t.post("{bozuk")).status).toBe(400);
    const sema = await t.post(model([{ role: "yok", title: "a", body: "b" }]));
    expect(sema.status).toBe(400);
    expect(((await sema.json()) as { hata: string }).hata).toMatch(/rol/);
    const dev = await t.post(JSON.stringify({ x: "y".repeat(SINIR.govdeBayt + 10) }));
    expect(dev.status).toBe(413);
    expect(t.cagri()).toBe(0);
  });
  it("eşzamanlı ikinci istek 429 (tek önizleme); ilk biter bitmez yenisi kabul edilir", async () => {
    let serbest!: () => void;
    const engel = new Promise<void>((r) => { serbest = r; });
    const t = await kur({ render: async () => { await engel; return { slides: [{ index: 0, role: "kapak", png: Buffer.from("x"), tasma: false }] }; } });
    const ilk = t.post(model(TAM));
    await new Promise((r) => setTimeout(r, 60)); // ilk istek çiziciye girsin
    const ikinci = await t.post(model(TAM));
    expect(ikinci.status).toBe(429);
    serbest();
    expect((await ilk).status).toBe(200);
    expect((await t.post(model(TAM))).status).toBe(200);
  });
  it("çizici hatası → 500, İÇ MESAJ sızdırılmaz; kilit serbest kalır (sonraki istek çalışır)", async () => {
    let n = 0;
    const t = await kur({ render: async () => { if (n++ === 0) throw new Error("Chromium çöktü: /opt/secret/yol"); return { slides: [{ index: 0, role: "kapak", png: Buffer.from("x"), tasma: false }] }; } });
    const res = await t.post(model(TAM));
    expect(res.status).toBe(500);
    const metin = await res.text();
    expect(metin).not.toContain("Chromium");
    expect(metin).not.toContain("/opt/secret");
    expect(t.log.join("\n")).toContain("render hatası");
    expect((await t.post(model(TAM))).status).toBe(200);
  });
});
