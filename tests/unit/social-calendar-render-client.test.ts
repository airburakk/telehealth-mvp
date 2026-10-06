// İçerik takvimi — PNG önizleme istemcisi (render-client.ts) sözleşmeleri (v6.328, 2026-10-06): yapılandırma kapısı · gövdenin yalnız görsele yarayan
// alanları taşıması (auto/meta SIZMAZ) · Bearer başlığı · durum kodu eşlemesi (kart 401→502 · 503/429→503 · zaman aşımı 504) · yanıt doğrulaması.
import { describe, expect, it, vi } from "vitest";
import type { PlanPayload } from "@/lib/social-calendar/payload";
import { parseRenderResponse, renderRequestBody, renderRubrik } from "@/lib/social-calendar/render-client";
import { seriesByKey } from "@/lib/social-calendar/series";

const SERIES = seriesByKey("karar-masasi")!;
const PNG = "iVBORw0KGgoAAAANSUhEUg==";
const payload: PlanPayload = {
  v: 1,
  slides: [
    { role: "kapak", title: "Başlık", body: "Gövde", auto: true },
    { role: "uyusmazlik", title: "Uyuşmazlık", body: "Alıntı", quote: true },
    { role: "cikarim", title: "Doktor için çıkarım", body: "", bullets: ["bir", "iki", "üç"] },
  ],
  caption: "Altyazı burada yazılı.",
  hashtags: [],
  sources: [],
  meta: { theme: "komplikasyon", daire: "3. Hukuk Dairesi" },
};
const girdi = { series: SERIES, payload, slotDay: "2026-10-07" };
const OK_URL = "https://n8n.example/webhook/rubrik";

const resp = (status: number, body: unknown = {}) => new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
const okBody = { slides: [{ index: 0, role: "kapak", png: PNG }, { index: 1, role: "uyusmazlik", png: PNG, tasma: true }] };

describe("renderRequestBody", () => {
  it("yalnız görsele yarayan alanlar: auto/meta/hashtag/kaynak gitmez; bullets/quote varsayılanları dolu", () => {
    const b = renderRequestBody(SERIES, payload, "2026-10-07");
    expect(b).toEqual({
      templateKey: "karar-masasi",
      seriesName: "Karar masası",
      slotDay: "2026-10-07",
      slides: [
        { role: "kapak", title: "Başlık", body: "Gövde", bullets: [], quote: false },
        { role: "uyusmazlik", title: "Uyuşmazlık", body: "Alıntı", bullets: [], quote: true },
        { role: "cikarim", title: "Doktor için çıkarım", body: "", bullets: ["bir", "iki", "üç"], quote: false },
      ],
    });
    expect(JSON.stringify(b)).not.toContain("komplikasyon");
    expect(JSON.stringify(b)).not.toContain("auto");
  });
});

describe("renderRubrik — yapılandırma ve istek", () => {
  it("URL ya da jeton yoksa 503 (ağa HİÇ çıkılmaz); slayt yoksa 400", async () => {
    const f = vi.fn();
    expect(await renderRubrik(girdi, { fetchImpl: f as unknown as typeof fetch, url: "", token: "t" })).toMatchObject({ ok: false, status: 503 });
    expect(await renderRubrik(girdi, { fetchImpl: f as unknown as typeof fetch, url: OK_URL, token: "" })).toMatchObject({ ok: false, status: 503 });
    expect(await renderRubrik({ ...girdi, payload: { ...payload, slides: [] } }, { fetchImpl: f as unknown as typeof fetch, url: OK_URL, token: "t" })).toMatchObject({ ok: false, status: 400 });
    expect(f).not.toHaveBeenCalled();
  });
  it("POST + Bearer + JSON gövde; başarıda slaytlar (tasma bayrağıyla) döner", async () => {
    const f = vi.fn(async () => resp(200, okBody));
    const r = await renderRubrik(girdi, { fetchImpl: f as unknown as typeof fetch, url: OK_URL, token: "gizli-jeton" });
    expect(r).toEqual({ ok: true, slides: [{ index: 0, role: "kapak", png: PNG, tasma: false }, { index: 1, role: "uyusmazlik", png: PNG, tasma: true }] });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(OK_URL);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer gizli-jeton");
    expect(JSON.parse(init.body as string).templateKey).toBe("karar-masasi");
  });
});

describe("renderRubrik — hata eşlemesi", () => {
  const dene = (status: number, body: unknown = {}) => renderRubrik(girdi, { fetchImpl: (async () => resp(status, body)) as unknown as typeof fetch, url: OK_URL, token: "t" });
  it("kart kimlik reddi (401/403) → 502 (jeton uyuşmazlığı; kullanıcı 'yetkisiz' sanmasın)", async () => {
    for (const s of [401, 403]) expect(await dene(s)).toMatchObject({ ok: false, status: 502, error: expect.stringContaining("SOCIAL_DIGEST_TOKEN") });
  });
  it("meşgul (503/429) → 503 ve açıklayıcı mesaj; diğer hatalar → 502", async () => {
    for (const s of [503, 429]) expect(await dene(s)).toMatchObject({ ok: false, status: 503, error: expect.stringContaining("meşgul") });
    expect(await dene(500)).toMatchObject({ ok: false, status: 502 });
    expect(await dene(404)).toMatchObject({ ok: false, status: 502 });
  });
  it("bozuk/geçersiz yanıt → 502 (görüntü uydurulmaz)", async () => {
    expect(await dene(200, "json-degil")).toMatchObject({ ok: false, status: 502 });
    expect(await dene(200, { slides: [] })).toMatchObject({ ok: false, status: 502 });
    expect(await dene(200, { slides: [{ index: 0, role: "kapak", png: "PNG-DEGIL" }] })).toMatchObject({ ok: false, status: 502 });
  });
  it("ağ hatası → 502; zaman aşımı → 504", async () => {
    const ag = await renderRubrik(girdi, { fetchImpl: (async () => { throw new Error("ECONNREFUSED"); }) as unknown as typeof fetch, url: OK_URL, token: "t" });
    expect(ag).toMatchObject({ ok: false, status: 502 });
    const yavas = (async (_u: string, init: RequestInit) => new Promise<Response>((_res, rej) => { init.signal?.addEventListener("abort", () => rej(Object.assign(new Error("iptal"), { name: "AbortError" }))); })) as unknown as typeof fetch;
    const to = await renderRubrik(girdi, { fetchImpl: yavas, url: OK_URL, token: "t", timeoutMs: 20 });
    expect(to).toMatchObject({ ok: false, status: 504 });
  });
  it("iç ayrıntı (jeton, URL) hata mesajına SIZMAZ", async () => {
    const r = await renderRubrik(girdi, { fetchImpl: (async () => { throw new Error(`fetch failed ${OK_URL} Bearer gizli-jeton`); }) as unknown as typeof fetch, url: OK_URL, token: "gizli-jeton" });
    expect(JSON.stringify(r)).not.toContain("gizli-jeton");
    expect(JSON.stringify(r)).not.toContain("n8n.example");
  });
});

describe("parseRenderResponse", () => {
  it("geçerli yanıt; en çok 12 slayt; PNG imzası şart; tasma yoksa false", () => {
    expect(parseRenderResponse({ slides: [{ index: 0, role: "kapak", png: PNG }] })).toEqual([{ index: 0, role: "kapak", png: PNG, tasma: false }]);
    expect(parseRenderResponse({ slides: Array.from({ length: 13 }, (_, i) => ({ index: i, role: "genel", png: PNG })) })).toBeNull();
    expect(parseRenderResponse({ slides: [{ index: 0, role: "kapak", png: "AAAA" }] })).toBeNull();
    expect(parseRenderResponse({ slides: [{ index: "0", role: "kapak", png: PNG }] })).toBeNull();
    expect(parseRenderResponse(null)).toBeNull();
    expect(parseRenderResponse({})).toBeNull();
  });
});
