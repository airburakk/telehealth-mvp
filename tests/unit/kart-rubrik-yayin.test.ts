// v6.335 — `infra/kart/lib/rubrik-yayin.mjs` (içerik takvimi YAYIN uçları, Faz 2-B2): saf yardımcılar · POST /rubrik/bugun (KURU = `bak` salt-okuma; canlı = `al` kilidi;
// Türkiye günü; render hatası → YAYIN HATASI; taşma FAIL-CLOSED; jeton/iç ayrıntı sızmaz) · POST /rubrik/sonuc (beyaz liste + aktarım) · GET|HEAD /rubrik/dosya (yalnız listeli) ·
// saklama + sosyal işiyle klasör izolasyonu · kaynak kuralları. ffmpeg/Chromium/ağ GEREKMEZ (sahte çizici + sahte Vercel).
import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import type { AddressInfo } from "node:net";
import path from "node:path";
import {
  YAYIN_SINIR,
  altyaziMetni,
  bugunTr,
  createRubrikYayin,
  dosyaAdiGecerli,
  gunGecerli,
  planYanitiDogrula,
  slaytDosyaAdi,
  shortDosyaAdi,
  sonucGovdeDogrula,
} from "../../infra/kart/lib/rubrik-yayin.mjs";
import { createSosyal } from "../../infra/kart/lib/sosyal-isleri.mjs";
import { PUBLISH_CHANNELS } from "@/lib/social-calendar/publication";

const KOK = process.cwd();
const TOKEN = "plan-test-jetonu-0123456789";
const PLAN_URL = "https://plan.test/api/social-calendar/yayin";
const GUN = "2026-10-07";
const HASH = "a".repeat(64);
const PNG_IMZA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const png = (s: string) => Buffer.concat([PNG_IMZA, Buffer.from(s)]);

const modelOf = (n = 3, ek: Record<string, unknown> = {}) => ({
  templateKey: "karar-masasi",
  seriesName: "Karar masası",
  slotDay: GUN,
  slides: Array.from({ length: n }, (_, i) => ({ role: i === 0 ? "kapak" : "genel", title: `Başlık ${i + 1}`, body: `Gövde ${i + 1}`, bullets: [] as string[], quote: false })),
  ...ek,
});
const oge = (ek: Record<string, unknown> = {}) => ({
  id: "cmabc123",
  version: "2026-10-07T08:00:00.000Z",
  seriesKey: "karar-masasi",
  slotDay: GUN,
  payload: { caption: "Altyazı metni", hashtags: ["#hukuk", "#saglik"] },
  render: modelOf(),
  approvedHash: HASH,
  ...ek,
});
const planYaniti = (items: unknown[] = [oge()], ek: Record<string, unknown> = {}) => ({ ok: true, gun: GUN, items, atlanan: [], slotlar: [], ...ek });

type Govde = Record<string, unknown>;
type Yanit = { status?: number; json?: unknown; text?: string };
type VercelFn = (g: Govde, n: number) => Yanit | "ag-hatasi";
type Cizici = (a: { model: { slides: { role: string }[] } }) => Promise<unknown>;

const sahteRender: Cizici = async ({ model }) => ({ slides: model.slides.map((s, i) => ({ index: i, role: s.role, png: png(`slayt-${i}`), tasma: false })) });

type VideoArg = { pngYollari: string[]; outPath: string; workDir: string; muzikPath: string | null };
type Videocu = (a: VideoArg) => Promise<{ sure_sn: number; sesli: boolean }>;
const SAHTE_MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypmp42sahte-short")]);
/** Sahte Short üreticisi: çağrıyı kaydeder, çıktıyı `outPath`'e yazar (gerçek ffmpeg birim testinde ÇAĞRILMAZ). */
const sahteVideo = (kayit: VideoArg[] = []): Videocu => async (a) => {
  kayit.push(a);
  fs.mkdirSync(a.workDir, { recursive: true });
  fs.writeFileSync(path.join(a.workDir, "ara.mp4"), "ara");
  fs.writeFileSync(a.outPath, SAHTE_MP4);
  return { sure_sn: 15, sesli: false };
};

/** Varsayılan sahte Vercel: `bak` her zaman öğeyi verir; `al` İLK çağrıda verir, sonrakilerde boş (en fazla bir kez); `sonuc` başarı. */
function varsayilanVercel(): VercelFn {
  let alindi = false;
  return (g) => {
    if (g.action === "bak") return { json: planYaniti() };
    if (g.action === "al") {
      const ilk = !alindi;
      alindi = true;
      return { json: planYaniti(ilk ? [oge({ version: "2026-10-07T08:05:00.000Z" })] : []) };
    }
    return { json: { ok: true, durum: g.durum === "ok" ? "PUBLISHED" : "FAILED", version: "v9" } };
  };
}

const temizlenecek: string[] = [];
let sunucu: http.Server | null = null;
afterEach(async () => {
  if (sunucu) {
    sunucu.closeAllConnections();
    await new Promise<void>((r) => sunucu!.close(() => r()));
    sunucu = null;
  }
  for (const d of temizlenecek.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

async function kur(o: { token?: string; mesgul?: boolean; render?: Cizici; video?: Videocu; muzikPath?: string; vercel?: VercelFn; now?: number; saklananGun?: number } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kart-yayin-"));
  temizlenecek.push(dir);
  const cagrilar: { url: string; auth: string | null; ct: string | null; govde: Govde }[] = [];
  const log: string[] = [];
  const vercel = o.vercel ?? varsayilanVercel();
  let simdi = o.now ?? Date.parse("2026-10-07T09:00:00Z"); // 12:00 TR
  const fetchImpl = (async (url: string, init: RequestInit) => {
    const govde = JSON.parse(String(init.body)) as Govde;
    const h = init.headers as Record<string, string>;
    cagrilar.push({ url, auth: h.authorization ?? null, ct: h["content-type"] ?? null, govde });
    const y = vercel(govde, cagrilar.length);
    if (y === "ag-hatasi") throw new TypeError("fetch failed");
    return new Response(y.text ?? JSON.stringify(y.json ?? {}), { status: y.status ?? 200 });
  }) as unknown as typeof fetch;
  const servis = createRubrikYayin({
    dir,
    getBrowser: async () => ({}),
    spherePath: "kure.webp",
    planUrl: PLAN_URL,
    planToken: o.token ?? TOKEN,
    mesgul: () => o.mesgul === true,
    log: (m: string) => log.push(m),
    render: o.render ?? sahteRender,
    video: o.video ?? sahteVideo(),
    muzikPath: o.muzikPath ?? null,
    fetchImpl,
    now: () => simdi,
    saklananGun: o.saklananGun,
  });
  sunucu = http.createServer(async (req, res) => {
    if (await servis.handle(req, res)) return;
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((r) => sunucu!.listen(0, "127.0.0.1", r));
  const port = (sunucu.address() as AddressInfo).port;
  const istek = (yol: string, yontem = "POST", govde?: unknown) =>
    fetch(`http://127.0.0.1:${port}${yol}`, {
      method: yontem,
      headers: { "content-type": "application/json" },
      body: yontem === "GET" || yontem === "HEAD" ? undefined : govde === undefined ? undefined : typeof govde === "string" ? govde : JSON.stringify(govde),
    });
  return { dir, cagrilar, log, istek, saatiAyarla: (ms: number) => { simdi = ms; } };
}
const bugunDizini = (dir: string, gun = GUN) => path.join(dir, "rubrik", gun);

// ── saf yardımcılar ──────────────────────────────────────────────────────────────────────────────────

describe("saf yardımcılar", () => {
  it("bugunTr: Türkiye takvim günü (UTC+3) — UTC gece yarısından ÖNCE yeni güne geçer", () => {
    expect(bugunTr(Date.parse("2026-10-07T09:00:00Z"))).toBe("2026-10-07");
    expect(bugunTr(Date.parse("2026-10-07T20:59:59Z"))).toBe("2026-10-07"); // 23:59:59 TR
    expect(bugunTr(Date.parse("2026-10-07T21:00:00Z"))).toBe("2026-10-08"); // 00:00:00 TR
    expect(bugunTr(Date.parse("2026-12-31T21:30:00Z"))).toBe("2027-01-01");
  });

  it("gunGecerli: gerçek takvim günü; taşmalar ve tür hataları reddedilir", () => {
    expect(gunGecerli("2026-10-07")).toBe(true);
    for (const kotu of ["2026-02-30", "2026-13-01", "07.10.2026", "2026-10-7", "", "x", null, 20261007, undefined]) expect(gunGecerli(kotu as never), String(kotu)).toBe(false);
  });

  it("slaytDosyaAdi + dosyaAdiGecerli: iki haneli sıra; yol/büyük harf/uzantı/NN eksikliği reddedilir", () => {
    expect(slaytDosyaAdi("karar-masasi", GUN, 1)).toBe("rubrik-karar-masasi-2026-10-07-01.png");
    expect(slaytDosyaAdi("etkinlik-radari", GUN, 12)).toBe("rubrik-etkinlik-radari-2026-10-07-12.png");
    expect(dosyaAdiGecerli("rubrik-karar-masasi-2026-10-07-01.png")).toBe(true);
    for (const kotu of ["../rubrik-x-2026-10-07-01.png", "rubrik-Karar-2026-10-07-01.png", "rubrik-karar-masasi-2026-10-07-01.jpg", "rubrik-karar-masasi-2026-10-07-1.png", "rubrik--2026-10-07-01.png", "rubrik-a/b-2026-10-07-01.png", "bitti.json", ""]) {
      expect(dosyaAdiGecerli(kotu), kotu).toBe(false);
    }
  });

  it("altyaziMetni: ZIP'teki altyazi.txt ile AYNI biçim (altyazı + boş satır + etiketler; boşlar atılır)", () => {
    expect(altyaziMetni("Merhaba", ["#a", "#b"])).toBe("Merhaba\n\n#a #b");
    expect(altyaziMetni("  Merhaba  ", [])).toBe("Merhaba");
    expect(altyaziMetni("", ["#a"])).toBe("#a");
    expect(altyaziMetni("", [])).toBe("");
  });
});

describe("sonucGovdeDogrula", () => {
  const ok = { id: "cmabc123", version: "2026-10-07T08:05:00.000Z", durum: "ok", kanallar: [{ channel: "instagram", url: "https://www.instagram.com/p/X/" }, { channel: "x" }] };

  it("geçerli ok gövdesi: YALNIZ beyaz listedeki alanlar çıkar; `action` sabit 'sonuc'", () => {
    const g = sonucGovdeDogrula({ ...ok, basarisiz: [{ channel: "linkedin", error: "429" }], manual: true, action: "al", kimlik: "x" });
    expect(g).toEqual({
      ok: true,
      govde: { action: "sonuc", durum: "ok", id: "cmabc123", version: ok.version, kanallar: ok.kanallar, basarisiz: [{ channel: "linkedin", error: "429" }] },
    });
  });

  it("kanal sınırı Vercel kanal setiyle SÖZLEŞMELİ (YouTube dahil 6 kanal tek gönderide geçer)", () => {
    expect(YAYIN_SINIR.kanal).toBe(PUBLISH_CHANNELS.length);
    const hepsi = PUBLISH_CHANNELS.map((channel) => ({ channel }));
    expect(sonucGovdeDogrula({ ...ok, kanallar: hepsi })).toMatchObject({ ok: true, govde: { kanallar: hepsi } });
  });

  it("boş `basarisiz` gönderilmez; hata gövdesi: `hata` taşınır, yoksa boş metin", () => {
    expect(sonucGovdeDogrula({ ...ok, basarisiz: [] })).toMatchObject({ ok: true, govde: { durum: "ok" } });
    expect((sonucGovdeDogrula({ ...ok, basarisiz: [] }) as { govde: Govde }).govde).not.toHaveProperty("basarisiz");
    expect(sonucGovdeDogrula({ id: "cmabc123", version: "v1", durum: "hata", hata: "Instagram 400" })).toEqual({ ok: true, govde: { action: "sonuc", durum: "hata", id: "cmabc123", version: "v1", hata: "Instagram 400" } });
    expect(sonucGovdeDogrula({ id: "cmabc123", version: "v1", durum: "hata" })).toMatchObject({ ok: true, govde: { hata: "" } });
  });

  it("geçersiz biçimler reddedilir", () => {
    const hata = (x: unknown) => {
      const g = sonucGovdeDogrula(x);
      return g.ok ? null : g.hata;
    };
    expect(hata(null)).toMatch(/nesne/);
    expect(hata([])).toMatch(/nesne/);
    expect(hata({ ...ok, id: "a/b" })).toMatch(/id/);
    expect(hata({ ...ok, id: "" })).toMatch(/id/);
    expect(hata({ ...ok, version: "" })).toMatch(/version/);
    expect(hata({ ...ok, version: "x".repeat(41) })).toMatch(/version/);
    expect(hata({ ...ok, durum: "basari" })).toMatch(/durum/);
    expect(hata({ ...ok, kanallar: [] })).toMatch(/kanallar/);
    expect(hata({ ...ok, kanallar: Array.from({ length: YAYIN_SINIR.kanal + 1 }, () => ({ channel: "x" })) })).toMatch(/kanallar/);
    expect(hata({ ...ok, kanallar: [{ channel: "" }] })).toMatch(/kanallar/);
    expect(hata({ ...ok, kanallar: [{ channel: "x".repeat(25) }] })).toMatch(/kanallar/);
    expect(hata({ ...ok, kanallar: [{ channel: "x", url: "u".repeat(501) }] })).toMatch(/kanallar/);
    expect(hata({ ...ok, kanallar: ["x"] })).toMatch(/kanallar/);
    expect(hata({ ...ok, basarisiz: "kötü" })).toMatch(/basarisiz/);
    expect(hata({ ...ok, basarisiz: Array.from({ length: YAYIN_SINIR.kanal + 1 }, () => ({ channel: "x" })) })).toMatch(/basarisiz/);
    expect(hata({ ...ok, basarisiz: [{ channel: "x", error: "e".repeat(YAYIN_SINIR.hata + 1) }] })).toMatch(/basarisiz/);
    expect(hata({ id: "cmabc123", version: "v1", durum: "hata", hata: "e".repeat(YAYIN_SINIR.hata + 1) })).toMatch(/hata/);
    expect(hata({ id: "cmabc123", version: "v1", durum: "hata", hata: 5 })).toMatch(/hata/);
  });
});

describe("planYanitiDogrula", () => {
  it("geçerli yanıt: öğe alanları + altyazı + doğrulanmış kart modeli; atlananlar temizlenir", () => {
    const r = planYanitiDogrula(planYaniti([oge()], { atlanan: [{ id: "x1", seriesKey: "karar-masasi", neden: "muhur-bozuk", fazla: "gitmez" }, { bozuk: true }] }));
    expect(r.gun).toBe(GUN);
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({ id: "cmabc123", seriesKey: "karar-masasi", slotDay: GUN, approvedHash: HASH, caption: "Altyazı metni", hashtags: ["#hukuk", "#saglik"], altyazi: "Altyazı metni\n\n#hukuk #saglik", modelHata: null });
    expect(r.items[0]!.model).toMatchObject({ templateKey: "karar-masasi", slotDay: GUN });
    expect(r.atlanan).toEqual([{ id: "x1", seriesKey: "karar-masasi", neden: "muhur-bozuk" }]);
  });

  it("geçersiz `render` modeli tüm partiyi DÜŞÜRMEZ: öğe `modelHata` taşır (canlıda YAYIN HATASI'na çekilir)", () => {
    const r = planYanitiDogrula(planYaniti([oge({ render: { templateKey: "yok" } }), oge({ id: "cmother", render: undefined })]));
    expect(r.items.map((i) => [i.id, i.model, typeof i.modelHata])).toEqual([["cmabc123", null, "string"], ["cmother", null, "string"]]);
  });

  it("kimlik/yapı bozuksa (bildirim yapılamaz) parti GEÇERSİZ: 502 + belirsiz", () => {
    const bozuklar: unknown[] = [
      null, [], { ok: false }, { ...planYaniti(), gun: "bozuk" }, { ...planYaniti(), items: "x" },
      planYaniti([null]), planYaniti([oge({ id: "a/b" })]), planYaniti([oge({ id: undefined })]), planYaniti([oge({ version: "" })]), planYaniti([oge({ version: "x".repeat(41) })]),
      planYaniti([oge({ seriesKey: "Karar Masası" })]), planYaniti([oge({ approvedHash: "kisa" })]), planYaniti([oge({ payload: {} })]),
      planYaniti([oge({ payload: { caption: "x".repeat(YAYIN_SINIR.altyazi + 1), hashtags: [] } })]), planYaniti([oge({ payload: { caption: "a", hashtags: [5] } })]),
      planYaniti([oge({ payload: { caption: "a", hashtags: Array.from({ length: YAYIN_SINIR.etiket + 1 }, () => "#a") } })]),
    ];
    for (const b of bozuklar) {
      let atilan: unknown = null;
      try { planYanitiDogrula(b); } catch (e) { atilan = e; }
      expect(atilan, JSON.stringify(b).slice(0, 80)).toMatchObject({ kod: 502, belirsiz: true });
    }
  });

  it("öğe `slotDay`'i geçersizse parti gününe düşer", () => {
    expect(planYanitiDogrula(planYaniti([oge({ slotDay: "bozuk" })])).items[0]!.slotDay).toBe(GUN);
  });
});

// ── POST /rubrik/bugun ───────────────────────────────────────────────────────────────────────────────

describe("POST /rubrik/bugun — kapılar", () => {
  it("CONTENT_PLAN_TOKEN yok → 503 (DORMANT); Vercel'e HİÇ çağrı yok", async () => {
    const t = await kur({ token: "" });
    const r = await t.istek("/rubrik/bugun");
    expect(r.status).toBe(503);
    expect(((await r.json()) as { hata: string }).hata).toContain("CONTENT_PLAN_TOKEN");
    expect(t.cagrilar).toHaveLength(0);
  });

  it("yöntem: GET → 405 + Allow: POST", async () => {
    const t = await kur();
    const r = await t.istek("/rubrik/bugun", "GET");
    expect(r.status).toBe(405);
    expect(r.headers.get("allow")).toBe("POST");
  });

  it("`gun` yalnız kuru=1 ile verilebilir; geçersiz gün 400; canlı alma bugünden başka gün ALMAZ (Vercel'e çağrı yok)", async () => {
    const t = await kur();
    expect((await t.istek(`/rubrik/bugun?gun=${GUN}`)).status).toBe(400);
    expect((await t.istek("/rubrik/bugun?kuru=1&gun=2026-02-30")).status).toBe(400);
    expect((await t.istek("/rubrik/bugun?kuru=1&gun=bozuk")).status).toBe(400);
    expect(t.cagrilar).toHaveLength(0);
  });

  it("sosyal üretim sürerken 503 (Chromium/bellek korunur; Vercel'e çağrı yok)", async () => {
    const t = await kur({ mesgul: true });
    expect((await t.istek("/rubrik/bugun")).status).toBe(503);
    expect(t.cagrilar).toHaveLength(0);
  });

  it("eşzamanlı ikinci istek 429; ilk biter bitmez yenisi kabul edilir", async () => {
    let serbest!: () => void;
    const kapi = new Promise<void>((r) => { serbest = r; });
    const t = await kur({ render: async (a) => { await kapi; return sahteRender(a); } });
    const ilk = t.istek("/rubrik/bugun?kuru=1");
    await new Promise((r) => setTimeout(r, 50));
    expect((await t.istek("/rubrik/bugun?kuru=1")).status).toBe(429);
    serbest();
    expect((await ilk).status).toBe(200);
    expect((await t.istek("/rubrik/bugun?kuru=1")).status).toBe(200);
  });
});

describe("POST /rubrik/bugun — KURU (salt okuma)", () => {
  it("`bak` çağırır (ASLA `al`/`sonuc` değil); gün = bugün (TR); gövde yalnız {action, gun}; jeton Bearer'da", async () => {
    const t = await kur();
    const r = await t.istek("/rubrik/bugun?kuru=1");
    expect(r.status).toBe(200);
    expect(t.cagrilar).toHaveLength(1);
    expect(t.cagrilar[0]).toMatchObject({ url: PLAN_URL, auth: `Bearer ${TOKEN}`, ct: "application/json", govde: { action: "bak", gun: GUN } });
    expect(Object.keys(t.cagrilar[0]!.govde).sort()).toEqual(["action", "gun"]);
  });

  it("yanıt: öğe + altyazı + etiketler + dosya listesi (resim baytı YOK); kuru:true; dosyalar diskte, bitti.json listeli", async () => {
    const t = await kur();
    const j = (await (await t.istek("/rubrik/bugun?kuru=1")).json()) as { ok: boolean; kuru: boolean; gun: string; items: Govde[]; hatalar: unknown[]; atlanan: unknown[]; sure_sn: number };
    expect(j).toMatchObject({ ok: true, kuru: true, gun: GUN, hatalar: [], atlanan: [] });
    expect(typeof j.sure_sn).toBe("number");
    expect(j.items).toEqual([
      {
        id: "cmabc123", version: "2026-10-07T08:00:00.000Z", seriesKey: "karar-masasi", slotDay: GUN, approvedHash: HASH,
        altyazi: "Altyazı metni\n\n#hukuk #saglik", caption: "Altyazı metni", hashtags: ["#hukuk", "#saglik"],
        gorseller: [1, 2, 3].map((n) => ({ ad: `rubrik-karar-masasi-${GUN}-0${n}.png`, boyut: png(`slayt-${n - 1}`).length, sira: n })),
        video: { ad: `rubrik-karar-masasi-${GUN}-short.mp4`, boyut: SAHTE_MP4.length, sure_sn: 15, sesli: false },
        videoHata: null,
        xGruplari: [[1, 2, 3]],
      },
    ]);
    const dir = bugunDizini(t.dir);
    expect(fs.readdirSync(dir).sort()).toEqual(["bitti.json", ...[1, 2, 3].map((n) => `rubrik-karar-masasi-${GUN}-0${n}.png`), `rubrik-karar-masasi-${GUN}-short.mp4`]);
    expect(fs.readFileSync(path.join(dir, `rubrik-karar-masasi-${GUN}-02.png`)).equals(png("slayt-1"))).toBe(true);
    const marker = JSON.parse(fs.readFileSync(path.join(dir, "bitti.json"), "utf8")) as { gun: string; items: { id: string; kuru: boolean; dosyalar: unknown[] }[] };
    expect(marker.gun).toBe(GUN);
    expect(marker.items).toHaveLength(1);
    expect(marker.items[0]).toMatchObject({ id: "cmabc123", kuru: true });
    expect(marker.items[0]!.dosyalar).toHaveLength(3);
    expect(fs.existsSync(path.join(t.dir, GUN))).toBe(false); // sosyal işinin <dir>/<gün>/ klasörüne YAZILMAZ
  });

  it("`gun` verilirse `bak` O gün için çağrılır (gelecek günün KURU provası)", async () => {
    const t = await kur();
    await t.istek("/rubrik/bugun?kuru=1&gun=2026-10-14");
    expect(t.cagrilar[0]!.govde).toEqual({ action: "bak", gun: "2026-10-14" });
  });

  it("render hatası KURU'da Vercel'e BİLDİRİLMEZ (durum değişmez): `hatalar`da görünür, bildirildi:false", async () => {
    const t = await kur({ render: async () => { throw new Error("patladı"); } });
    const j = (await (await t.istek("/rubrik/bugun?kuru=1")).json()) as { items: unknown[]; hatalar: { bildirildi: boolean }[] };
    expect(j.items).toEqual([]);
    expect(j.hatalar).toHaveLength(1);
    expect(j.hatalar[0]!.bildirildi).toBe(false);
    expect(t.cagrilar.map((c) => c.govde.action)).toEqual(["bak"]);
  });

  it("boş gün: items [] ve dosya/bitti.json YAZILMAZ", async () => {
    const t = await kur({ vercel: () => ({ json: planYaniti([]) }) });
    const j = (await (await t.istek("/rubrik/bugun?kuru=1")).json()) as { items: unknown[] };
    expect(j.items).toEqual([]);
    expect(fs.existsSync(path.join(t.dir, "rubrik"))).toBe(false);
  });
});

describe("POST /rubrik/bugun — canlı (`al` kilidi)", () => {
  it("`al` çağırır; gün = Türkiye günü (UTC 21:30 → ertesi gün); dönen sürüm = ALMA sürümü", async () => {
    const t = await kur({ now: Date.parse("2026-10-07T21:30:00Z"), vercel: (g) => ({ json: planYaniti([oge({ version: "ALMA-SURUMU" })], { gun: "2026-10-08" }), ...(g.action !== "al" ? { status: 500 } : {}) }) });
    const r = await t.istek("/rubrik/bugun");
    expect(r.status).toBe(200);
    expect(t.cagrilar[0]!.govde).toEqual({ action: "al", gun: "2026-10-08" });
    const j = (await r.json()) as { kuru: boolean; gun: string; items: { version: string; seriesKey: string }[] };
    expect(j).toMatchObject({ kuru: false, gun: "2026-10-08" });
    expect(j.items[0]).toMatchObject({ version: "ALMA-SURUMU", seriesKey: "karar-masasi" });
    expect(fs.existsSync(path.join(t.dir, "rubrik", "2026-10-08", "bitti.json"))).toBe(true);
  });

  it("EN FAZLA BİR KEZ: ikinci `bugun` boş döner (Vercel almayı tek çağırana verir); önceki dosyalar bozulmaz", async () => {
    const t = await kur();
    const bir = (await (await t.istek("/rubrik/bugun")).json()) as { items: unknown[] };
    const iki = (await (await t.istek("/rubrik/bugun")).json()) as { items: unknown[] };
    expect(bir.items).toHaveLength(1);
    expect(iki.items).toEqual([]);
    expect(fs.readdirSync(bugunDizini(t.dir))).toHaveLength(5);
  });

  it("aynı gün ikinci koşu aynı seriyi yeniden yazarken eski fazla dosyaları SİLER; bitti.json öğeyi kimliğe göre BİRLEŞTİRİR", async () => {
    let tur = 0;
    const t = await kur({
      vercel: (g) => (g.action === "bak" ? { json: planYaniti([oge({ render: modelOf(++tur === 1 ? 5 : 2) })]) } : { json: {} }),
    });
    await t.istek("/rubrik/bugun?kuru=1"); // 5 slayt
    expect(fs.readdirSync(bugunDizini(t.dir)).filter((a) => a.endsWith(".png"))).toHaveLength(5);
    await t.istek("/rubrik/bugun?kuru=1"); // 2 slayt: 03..05 silinir
    expect(fs.readdirSync(bugunDizini(t.dir)).filter((a) => a.endsWith(".png")).sort()).toEqual([`rubrik-karar-masasi-${GUN}-01.png`, `rubrik-karar-masasi-${GUN}-02.png`]);
    const marker = JSON.parse(fs.readFileSync(path.join(bugunDizini(t.dir), "bitti.json"), "utf8")) as { items: { dosyalar: unknown[] }[] };
    expect(marker.items).toHaveLength(1);
    expect(marker.items[0]!.dosyalar).toHaveLength(2);
  });

  it("farklı kimlikli öğeler bitti.json'da BİRİKİR (ikinci koşu öncekini silmez); ikisinin dosyası da sunulur", async () => {
    let tur = 0;
    const ikinci = oge({ id: "cmsecond", seriesKey: "ogrenci-kosesi", render: modelOf(2, { templateKey: "ogrenci-kosesi", seriesName: "Öğrenci köşesi" }) });
    const t = await kur({ vercel: (g) => (g.action === "bak" ? { json: planYaniti([++tur === 1 ? oge() : ikinci]) } : { json: {} }) });
    await t.istek("/rubrik/bugun?kuru=1");
    await t.istek("/rubrik/bugun?kuru=1");
    const marker = JSON.parse(fs.readFileSync(path.join(bugunDizini(t.dir), "bitti.json"), "utf8")) as { items: { id: string }[] };
    expect(marker.items.map((k) => k.id).sort()).toEqual(["cmabc123", "cmsecond"]);
    expect((await t.istek(`/rubrik/dosya/${GUN}/rubrik-karar-masasi-${GUN}-01.png`, "GET")).status).toBe(200);
    expect((await t.istek(`/rubrik/dosya/${GUN}/rubrik-ogrenci-kosesi-${GUN}-01.png`, "GET")).status).toBe(200);
  });

  it("render İSTİSNASI → öğe YAYIN HATASI'na çekilir (Vercel'e `sonuc hata`), ama iç ayrıntı SIZMAZ; diğer öğe yine işlenir", async () => {
    const ikiOge = [oge(), oge({ id: "cmsecond", seriesKey: "ogrenci-kosesi", render: modelOf(2, { templateKey: "ogrenci-kosesi", seriesName: "Öğrenci köşesi" }) })];
    let n = 0;
    const t = await kur({
      vercel: (g) => (g.action === "al" ? { json: planYaniti(ikiOge) } : { json: { ok: true, durum: "FAILED", version: "v2" } }),
      render: async (a) => {
        if (++n === 1) throw new Error("Chromium çöktü: C:\\gizli\\yol\\token=ABC123");
        return sahteRender(a);
      },
    });
    const r = await t.istek("/rubrik/bugun");
    const metin = await r.text();
    expect(r.status).toBe(200);
    expect(metin).not.toContain("gizli");
    expect(metin).not.toContain("ABC123");
    const j = JSON.parse(metin) as { items: { id: string }[]; hatalar: { id: string; hata: string; bildirildi: boolean }[] };
    expect(j.items.map((i) => i.id)).toEqual(["cmsecond"]);
    expect(j.hatalar).toEqual([{ id: "cmabc123", seriesKey: "karar-masasi", hata: "render hatası (kart günlüğüne bakın)", bildirildi: true }]);
    const bildirim = t.cagrilar.find((c) => c.govde.action === "sonuc")!;
    expect(bildirim.govde).toEqual({ action: "sonuc", durum: "hata", id: "cmabc123", version: "2026-10-07T08:00:00.000Z", hata: "kart: render hatası (kart günlüğüne bakın)" });
    expect(t.log.join("\n")).toContain("render istisnası"); // ayrıntı yalnız kart GÜNLÜĞÜNDE (operatör bakar); yanıta ve Vercel'e giden metne GİRMEZ
  });

  it("TAŞMA (asgari puntoda sığmayan slayt) FAIL-CLOSED: dosya YAZILMAZ, YAYIN HATASI bildirilir ('kısaltın'); marker öğeyi İÇERMEZ", async () => {
    const t = await kur({
      render: async ({ model }) => ({ slides: model.slides.map((s, i) => ({ index: i, role: s.role, png: png(`s${i}`), tasma: i === 1 })) }),
    });
    const j = (await (await t.istek("/rubrik/bugun")).json()) as { items: unknown[]; hatalar: { hata: string; bildirildi: boolean }[] };
    expect(j.items).toEqual([]);
    expect(j.hatalar[0]).toMatchObject({ hata: "slayt 2 metni asgari puntoda sığmadı — kısaltın", bildirildi: true });
    expect(t.cagrilar.find((c) => c.govde.action === "sonuc")!.govde).toMatchObject({ durum: "hata", hata: "kart: slayt 2 metni asgari puntoda sığmadı — kısaltın" });
    expect(fs.existsSync(bugunDizini(t.dir))).toBe(false);
  });

  it("Vercel'in `render` modeli geçersizse (öğe düzeyi) YAYIN HATASI; çizici HİÇ çağrılmaz", async () => {
    let cagri = 0;
    const t = await kur({
      vercel: (g) => (g.action === "al" ? { json: planYaniti([oge({ render: { templateKey: "yok", slides: [] } })]) } : { json: {} }),
      render: async (a) => { cagri++; return sahteRender(a); },
    });
    const j = (await (await t.istek("/rubrik/bugun")).json()) as { hatalar: { hata: string }[] };
    expect(j.hatalar[0]!.hata).toMatch(/^render modeli geçersiz:/);
    expect(cagri).toBe(0);
  });

  it("çizici eksik/bozuk sonuç verirse (slayt sayısı · PNG imzası) HATA; yarım dosya bırakılmaz", async () => {
    const eksik = await kur({ render: async () => ({ slides: [{ index: 0, role: "kapak", png: png("x"), tasma: false }] }) });
    const e = (await (await eksik.istek("/rubrik/bugun?kuru=1")).json()) as { hatalar: { hata: string }[] };
    expect(e.hatalar[0]!.hata).toMatch(/slayt sayısı uyuşmuyor/);
    const bozuk = await kur({ render: async ({ model }) => ({ slides: model.slides.map((s, i) => ({ index: i, role: s.role, png: i === 2 ? Buffer.from("PNG-DEGIL") : png("x"), tasma: false })) }) });
    const b = (await (await bozuk.istek("/rubrik/bugun?kuru=1")).json()) as { hatalar: { hata: string }[] };
    expect(b.hatalar[0]!.hata).toBe("slayt 3 geçerli bir PNG değil");
    expect(fs.existsSync(bugunDizini(bozuk.dir))).toBe(false);
  });

  it("diske yazılamazsa (disk/izin) öğe YAYIN HATASI'na çekilir; dosya yolu/iç ayrıntı yanıta ve Vercel'e SIZMAZ", async () => {
    const t = await kur();
    fs.writeFileSync(path.join(t.dir, "rubrik"), "dosya"); // `rubrik` bir DOSYA → mkdir başarısız (ENOTDIR/EEXIST)
    const r = await t.istek("/rubrik/bugun");
    const metin = await r.text();
    expect(r.status).toBe(200);
    expect(metin).not.toContain(path.basename(t.dir)); // geçici dizin adı (JSON kaçışından bağımsız) — iç yol yok
    expect(metin).not.toMatch(/ENOTDIR|EEXIST|ENOENT|mkdir/);
    const j = JSON.parse(metin) as { items: unknown[]; hatalar: { hata: string; bildirildi: boolean }[] };
    expect(j.items).toEqual([]);
    expect(j.hatalar[0]).toMatchObject({ hata: "dosyalar diske yazılamadı (kart günlüğüne bakın)", bildirildi: true });
    const bildirim = t.cagrilar.find((c) => c.govde.action === "sonuc")!;
    expect(bildirim.govde).toMatchObject({ durum: "hata", hata: "kart: dosyalar diske yazılamadı (kart günlüğüne bakın)" });
    expect(JSON.stringify(t.cagrilar)).not.toContain(path.basename(t.dir));
    expect(t.log.join("\n")).toContain("disk istisnası"); // ayrıntı yalnız kart GÜNLÜĞÜNDE
  });

  it("hata bildirimi de başarısız olursa (ağ) bildirildi:false — yanıt yine 200 (içerik YAYINLANIYOR'da kalır, insan çözer)", async () => {
    const t = await kur({
      render: async () => { throw new Error("x"); },
      vercel: (g) => (g.action === "al" ? { json: planYaniti() } : "ag-hatasi"),
    });
    const r = await t.istek("/rubrik/bugun");
    expect(r.status).toBe(200);
    expect(((await r.json()) as { hatalar: { bildirildi: boolean }[] }).hatalar[0]!.bildirildi).toBe(false);
    expect(t.log.join("\n")).toContain("BİLDİRİLEMEDİ");
  });
});

describe("POST /rubrik/bugun — Vercel hata eşlemesi", () => {
  const hata = async (vercel: VercelFn, yol = "/rubrik/bugun") => {
    const t = await kur({ vercel });
    const r = await t.istek(yol);
    return { status: r.status, govde: (await r.json()) as { hata: string; belirsiz?: boolean }, t };
  };

  it("ağ hatası/zaman aşımı → 502; CANLI'da belirsiz:true (içerik alınmış olabilir), KURU'da false", async () => {
    const c = await hata(() => "ag-hatasi");
    expect(c.status).toBe(502);
    expect(c.govde.belirsiz).toBe(true);
    const k = await hata(() => "ag-hatasi", "/rubrik/bugun?kuru=1");
    expect(k.status).toBe(502);
    expect(k.govde.belirsiz).toBe(false);
  });

  it("401/403 → 502 (jeton uyuşmazlığı mesajı; JETON GÖVDEDE YOK); 503 → 503 (Vercel'de jeton yok); 404 → 502 (uç yok)", async () => {
    for (const k of [401, 403]) {
      const r = await hata(() => ({ status: k, json: { error: "Yetkisiz." } }));
      expect(r.status).toBe(502);
      expect(r.govde.hata).toContain("aynı değil");
      expect(JSON.stringify(r.govde)).not.toContain(TOKEN);
    }
    const kapali = await hata(() => ({ status: 503, json: { error: "CONTENT_PLAN_TOKEN tanımlı değil" } }));
    expect(kapali.status).toBe(503);
    expect(kapali.govde.hata).toContain("Vercel'de CONTENT_PLAN_TOKEN");
    const yok = await hata(() => ({ status: 404, text: "<html>404</html>" }));
    expect(yok.status).toBe(502);
    expect(yok.govde.hata).toContain("bulunamadı");
  });

  it("400 (gün uyuşmazlığı vb.) → 502 + Vercel'in mesajı (kısaltılmış); 5xx → 502 (CANLI belirsiz:true)", async () => {
    const d = await hata(() => ({ status: 400, json: { error: "Yalnız bugünün içeriği alınabilir." } }));
    expect(d.status).toBe(502);
    expect(d.govde.hata).toContain("Yalnız bugünün");
    expect(d.govde.belirsiz).toBe(false);
    const s = await hata(() => ({ status: 500, json: { error: "İşlem tamamlanamadı." } }));
    expect(s.status).toBe(502);
    expect(s.govde.belirsiz).toBe(true);
  });

  it("JSON olmayan 200 · geçersiz yapı · aşırı büyük yanıt → 502 + belirsiz:true; hiçbir dosya yazılmaz", async () => {
    for (const y of [{ text: "<html>merhaba</html>" }, { json: { ok: true, gun: "bozuk", items: [] } }, { text: "x".repeat(YAYIN_SINIR.planYanitBayt + 1) }]) {
      const r = await hata(() => y);
      expect(r.status).toBe(502);
      expect(r.govde.belirsiz).toBe(true);
      expect(fs.existsSync(path.join(r.t.dir, "rubrik"))).toBe(false);
    }
  });
});

// ── POST /rubrik/sonuc ───────────────────────────────────────────────────────────────────────────────

describe("POST /rubrik/sonuc", () => {
  const OK = { id: "cmabc123", version: "2026-10-07T08:05:00.000Z", durum: "ok", kanallar: [{ channel: "instagram", url: "https://www.instagram.com/p/X/" }, { channel: "x" }], basarisiz: [{ channel: "linkedin", error: "429" }] };

  it("CONTENT_PLAN_TOKEN yok → 503; yöntem GET → 405; Vercel'e çağrı yok", async () => {
    const t = await kur({ token: "" });
    expect((await t.istek("/rubrik/sonuc", "POST", OK)).status).toBe(503);
    const u = await kur();
    const r = await u.istek("/rubrik/sonuc", "GET");
    expect(r.status).toBe(405);
    expect(r.headers.get("allow")).toBe("POST");
    expect(t.cagrilar.length + u.cagrilar.length).toBe(0);
  });

  it("geçersiz gövde → 400 (JSON değil · şema); aşırı büyük → 413; Vercel'e çağrı yok", async () => {
    const t = await kur();
    expect((await t.istek("/rubrik/sonuc", "POST", "{bozuk")).status).toBe(400);
    expect((await t.istek("/rubrik/sonuc", "POST", { ...OK, durum: "belki" })).status).toBe(400);
    expect((await t.istek("/rubrik/sonuc", "POST", { ...OK, pay: "x".repeat(YAYIN_SINIR.sonucGovdeBayt) })).status).toBe(413);
    expect(t.cagrilar).toHaveLength(0);
  });

  it("ok: Vercel'e YALNIZ beyaz listedeki gövde + Bearer gider; enjekte alanlar (manual/action) gitmez; yanıt aynen geçer (tekrar:true dahil)", async () => {
    const t = await kur({ vercel: () => ({ json: { ok: true, tekrar: true, durum: "PUBLISHED", version: "v9" } }) });
    const r = await t.istek("/rubrik/sonuc", "POST", { ...OK, manual: true, action: "al", fazla: 1 });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, tekrar: true, durum: "PUBLISHED", version: "v9" });
    expect(t.cagrilar).toHaveLength(1);
    expect(t.cagrilar[0]).toMatchObject({ url: PLAN_URL, auth: `Bearer ${TOKEN}`, govde: { action: "sonuc", durum: "ok", id: OK.id, version: OK.version, kanallar: OK.kanallar, basarisiz: OK.basarisiz } });
    expect(Object.keys(t.cagrilar[0]!.govde).sort()).toEqual(["action", "basarisiz", "durum", "id", "kanallar", "version"]);
  });

  it("hata: `sonuc hata` + hata metni iletilir", async () => {
    const t = await kur();
    const r = await t.istek("/rubrik/sonuc", "POST", { id: "cmabc123", version: "v1", durum: "hata", hata: "Instagram 400" });
    expect(r.status).toBe(200);
    expect(t.cagrilar[0]!.govde).toEqual({ action: "sonuc", durum: "hata", id: "cmabc123", version: "v1", hata: "Instagram 400" });
  });

  it("Vercel'in KENDİ JSON yanıtları aynen geçer: 400 · 404 (yuva yok) · 409 (geçiş yasak/çakışma)", async () => {
    for (const [kod, mesaj] of [[400, "En az bir kanal seçin."], [404, "Yuva bulunamadı."], [409, "Yalnız ALINMIŞ içerik için sonuç bildirilebilir."]] as const) {
      const t = await kur({ vercel: () => ({ status: kod, json: { error: mesaj } }) });
      const r = await t.istek("/rubrik/sonuc", "POST", OK);
      expect(r.status).toBe(kod);
      expect(await r.json()).toEqual({ error: mesaj });
    }
  });

  it("kimlik (401/403) → 502 · kapalı (503) → 503 · JSON-dışı 404 (= uç yok) → 502 · 5xx → 502 belirsiz · ağ hatası → 502 belirsiz", async () => {
    const sonuc = async (vercel: VercelFn) => {
      const t = await kur({ vercel });
      const r = await t.istek("/rubrik/sonuc", "POST", OK);
      return { status: r.status, govde: (await r.json()) as { hata: string; belirsiz?: boolean } };
    };
    for (const k of [401, 403]) {
      const r = await sonuc(() => ({ status: k, json: { error: "Yetkisiz." } }));
      expect(r.status).toBe(502);
      expect(r.govde.hata).toContain("aynı değil");
    }
    expect((await sonuc(() => ({ status: 503, json: { error: "x" } }))).status).toBe(503);
    const yok = await sonuc(() => ({ status: 404, text: "<html>" }));
    expect(yok.status).toBe(502);
    expect(yok.govde.hata).toContain("bulunamadı");
    const bes = await sonuc(() => ({ status: 500, json: { error: "x" } }));
    expect(bes.status).toBe(502);
    expect(bes.govde.belirsiz).toBe(true);
    const ag = await sonuc(() => "ag-hatasi");
    expect(ag.status).toBe(502);
    expect(ag.govde.belirsiz).toBe(true);
  });

  it("Chromium'a ihtiyaç duymaz: sosyal üretim sürerken de iletilir", async () => {
    const t = await kur({ mesgul: true });
    expect((await t.istek("/rubrik/sonuc", "POST", OK)).status).toBe(200);
  });
});

// ── GET|HEAD /rubrik/dosya ───────────────────────────────────────────────────────────────────────────

describe("GET|HEAD /rubrik/dosya/<gün>/<ad>", () => {
  const AD = `rubrik-karar-masasi-${GUN}-02.png`;

  it("hazır içeriğin listeli dosyası: PNG baytı + başlıklar; HEAD yalnız başlıklar", async () => {
    const t = await kur();
    await t.istek("/rubrik/bugun?kuru=1");
    const r = await t.istek(`/rubrik/dosya/${GUN}/${AD}`, "GET");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("image/png");
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.headers.get("content-disposition")).toBe(`attachment; filename="${AD}"`);
    expect(Buffer.from(await r.arrayBuffer()).equals(png("slayt-1"))).toBe(true);
    const h = await t.istek(`/rubrik/dosya/${GUN}/${AD}`, "HEAD");
    expect(h.status).toBe(200);
    expect(h.headers.get("content-length")).toBe(String(png("slayt-1").length));
    expect((await h.arrayBuffer()).byteLength).toBe(0);
  });

  it("listede OLMAYAN ad · geçersiz ad/yol · bilinmeyen gün · marker yok → 404; yanlış yöntem → 405", async () => {
    const t = await kur();
    expect((await t.istek(`/rubrik/dosya/${GUN}/${AD}`, "GET")).status).toBe(404); // henüz üretim yok
    await t.istek("/rubrik/bugun?kuru=1");
    for (const yol of [
      `/rubrik/dosya/${GUN}/rubrik-karar-masasi-${GUN}-09.png`, // geçerli biçim ama listede yok
      `/rubrik/dosya/${GUN}/bitti.json`,
      `/rubrik/dosya/${GUN}/..%2Fbitti.json`,
      `/rubrik/dosya/${GUN}/%2e%2e/${AD}`,
      `/rubrik/dosya/${GUN}/${AD}/fazla`,
      `/rubrik/dosya/2026-10-06/${AD}`,
      "/rubrik/dosya/bozuk/x.png",
      "/rubrik/dosya/",
    ]) {
      expect((await t.istek(yol, "GET")).status, yol).toBe(404);
    }
    expect((await t.istek(`/rubrik/dosya/${GUN}/${AD}`, "POST")).status).toBe(405);
  });

  it("diskte duran ama bitti.json'da LİSTELENMEYEN dosya (yarım iş/.tmp) sunulmaz", async () => {
    const t = await kur();
    await t.istek("/rubrik/bugun?kuru=1");
    const gizli = `rubrik-karar-masasi-${GUN}-09.png`;
    fs.writeFileSync(path.join(bugunDizini(t.dir), gizli), png("yarim"));
    expect((await t.istek(`/rubrik/dosya/${GUN}/${gizli}`, "GET")).status).toBe(404);
  });

  it("marker KURCALANMIŞ olsa bile (listede bitti.json) yalnız geçerli PNG adları sunulur — ad doğrulaması ikinci kapı", async () => {
    const t = await kur();
    await t.istek("/rubrik/bugun?kuru=1");
    const yol = path.join(bugunDizini(t.dir), "bitti.json");
    const marker = JSON.parse(fs.readFileSync(yol, "utf8")) as { items: { dosyalar: { ad: string }[] }[] };
    marker.items[0]!.dosyalar.push({ ad: "bitti.json" });
    fs.writeFileSync(yol, JSON.stringify(marker));
    expect((await t.istek(`/rubrik/dosya/${GUN}/bitti.json`, "GET")).status).toBe(404);
  });
});

// ── sızıntı ──────────────────────────────────────────────────────────────────────────────────────────

describe("jeton sızıntısı yok (davranışsal)", () => {
  it("başarı · render hatası · taşma · Vercel 401/500/ağ hatası · sonuç aktarımı: HİÇBİR yanıtta ve günlükte CONTENT_PLAN_TOKEN geçmez; Vercel'e yalnız Authorization başlığıyla gider", async () => {
    const senaryolar: { vercel?: VercelFn; render?: Cizici; yol: string; govde?: unknown }[] = [
      { yol: "/rubrik/bugun?kuru=1" },
      { yol: "/rubrik/bugun" },
      { yol: "/rubrik/bugun", render: async () => { throw new Error("patladı"); } },
      { yol: "/rubrik/bugun", render: async ({ model }) => ({ slides: model.slides.map((s, i) => ({ index: i, role: s.role, png: png("x"), tasma: true })) }) },
      { yol: "/rubrik/bugun", vercel: () => ({ status: 401, json: { error: "Yetkisiz." } }) },
      { yol: "/rubrik/bugun", vercel: () => ({ status: 500, json: { error: "iç hata" } }) },
      { yol: "/rubrik/bugun", vercel: () => "ag-hatasi" },
      { yol: "/rubrik/sonuc", govde: { id: "cmabc123", version: "v1", durum: "hata", hata: "x" } },
      { yol: "/rubrik/sonuc", govde: { id: "cmabc123", version: "v1", durum: "hata", hata: "x" }, vercel: () => ({ status: 403, json: {} }) },
    ];
    const metinler: string[] = [];
    for (const sn of senaryolar) {
      const t = await kur({ vercel: sn.vercel, render: sn.render });
      const r = await t.istek(sn.yol, "POST", sn.govde);
      metinler.push(await r.text(), t.log.join("\n"));
      for (const c of t.cagrilar) {
        expect(c.auth).toBe(`Bearer ${TOKEN}`);
        expect(JSON.stringify(c.govde)).not.toContain(TOKEN); // gövdede/URL'de değil, yalnız başlıkta
        expect(c.url).not.toContain(TOKEN);
      }
      sunucu!.closeAllConnections();
      await new Promise<void>((r2) => sunucu!.close(() => r2()));
      sunucu = null;
    }
    expect(metinler.join("\n")).not.toContain(TOKEN);
  });
});

// ── saklama + izolasyon ──────────────────────────────────────────────────────────────────────────────

describe("saklama ve sosyal işiyle izolasyon", () => {
  it("en yeni `saklananGun` gün klasörü tutulur (vars. 3; burada 2): eskisi silinir", async () => {
    const t = await kur({ saklananGun: 2, vercel: (g) => ({ json: planYaniti([oge({ slotDay: g.gun })], { gun: g.gun }) }) });
    for (const gun of ["2026-10-05", "2026-10-06", "2026-10-07"]) {
      const r = await t.istek(`/rubrik/bugun?kuru=1&gun=${gun}`);
      expect(r.status, gun).toBe(200);
    }
    expect(fs.readdirSync(path.join(t.dir, "rubrik")).sort()).toEqual(["2026-10-06", "2026-10-07"]);
  });

  it("dosyalar <dir>/rubrik/<gün>/ altındadır: sosyal işinin gün klasörü SİLİNSE/YOKSA dokunulmaz; sosyal durumu `rubrik` klasörünü gün sanmaz", async () => {
    const t = await kur();
    const sosyalGunu = path.join(t.dir, GUN);
    fs.mkdirSync(sosyalGunu, { recursive: true });
    fs.writeFileSync(path.join(sosyalGunu, "reels-a.mp4"), "mp4");
    await t.istek("/rubrik/bugun?kuru=1");
    expect(fs.readFileSync(path.join(sosyalGunu, "reels-a.mp4"), "utf8")).toBe("mp4"); // yayın işi sosyal klasörüne dokunmaz
    // sosyal iş yeni gün başlatırken KENDİ gün klasörünü siler (isiCalistir: rmSync(gunDir)) — rubrik dosyaları ayrı ağaçta
    fs.rmSync(sosyalGunu, { recursive: true, force: true });
    expect(fs.existsSync(path.join(bugunDizini(t.dir), "bitti.json"))).toBe(true);
    // sosyal modülü `rubrik` dizinini gün klasörü saymaz (GUN_RE) → durum "bos"
    const sosyal = createSosyal({
      dir: t.dir, getDigest: async () => ({}), renderCardPng: async () => null,
      uretici: { renderStories: async () => ({}), renderReelA: async () => ({}), renderCarousel: async () => ({}) },
      getBrowser: async () => ({}), muzikPath: "yok.mp3", spherePath: "kure.webp", grid: {},
    });
    expect(sosyal.durum()).toEqual({ durum: "bos" });
  });
});

// ── kaynak kuralları ─────────────────────────────────────────────────────────────────────────────────

describe("YouTube Short + X zinciri (v6.340)", () => {
  it("Short ONAYLI PNG'lerden, slayt sırasıyla üretilir; müzik yolu iletilir; ara dosyalar ve .tmp kalmaz", async () => {
    const kayit: VideoArg[] = [];
    const t = await kur({ video: sahteVideo(kayit), muzikPath: "/varlik/muzik.mp3" });
    const r = await t.istek("/rubrik/bugun");
    expect(r.status).toBe(200);
    expect(kayit).toHaveLength(1);
    const dir = bugunDizini(t.dir);
    expect(kayit[0]!.pngYollari).toEqual([1, 2, 3].map((n) => path.join(dir, `rubrik-karar-masasi-${GUN}-0${n}.png`)));
    expect(kayit[0]!.muzikPath).toBe("/varlik/muzik.mp3");
    expect(kayit[0]!.outPath.endsWith(".tmp.mp4")).toBe(true);
    expect(fs.readdirSync(dir).some((a) => a.includes(".tmp"))).toBe(false);
    expect(fs.readdirSync(path.join(t.dir, "rubrik"))).toEqual([GUN]); // geçici çalışma klasörü (.is-<id>) iz bırakmaz
  });

  it("X zinciri: 6 slayt → [[1,2,3,4],[5,6]] (ilk gönderi 4 görsel, kalanı yanıtta)", async () => {
    const vercel: VercelFn = (g) => (g.action === "bak" ? { json: planYaniti([oge({ render: modelOf(6) })]) } : { json: {} });
    const t = await kur({ vercel });
    const j = (await (await t.istek("/rubrik/bugun?kuru=1")).json()) as { items: { xGruplari: number[][]; gorseller: unknown[] }[] };
    expect(j.items[0]!.gorseller).toHaveLength(6);
    expect(j.items[0]!.xGruplari).toEqual([[1, 2, 3, 4], [5, 6]]);
  });

  it("video HATASI öğeyi DÜŞÜRMEZ: görseller yayına hazır, video:null + GENEL videoHata (iç ayrıntı sızmaz); Vercel'e HATA bildirilmez; yarım video yok", async () => {
    const t = await kur({ video: async (a) => { fs.writeFileSync(a.outPath, "yarim"); throw new Error(`ffmpeg hata (1): ${a.outPath} gizli-ayrinti`); } });
    const r = await t.istek("/rubrik/bugun");
    const j = (await r.json()) as { items: Govde[]; hatalar: unknown[] };
    expect(r.status).toBe(200);
    expect(j.hatalar).toEqual([]);
    expect(j.items).toHaveLength(1);
    expect(j.items[0]).toMatchObject({ video: null, videoHata: "Short videosu üretilemedi (kart günlüğüne bakın)" });
    expect(JSON.stringify(j)).not.toContain("gizli-ayrinti");
    expect(t.cagrilar.map((c) => c.govde.action)).toEqual(["al"]); // `sonuc hata` YOK: içerik yayınlanabilir
    const dir = bugunDizini(t.dir);
    expect(fs.readdirSync(dir).filter((a) => a.endsWith(".mp4"))).toEqual([]);
    expect(t.log.some((m) => m.includes("video istisnası"))).toBe(true);
    const yok = await t.istek(`/rubrik/dosya/${GUN}/rubrik-karar-masasi-${GUN}-short.mp4`, "GET");
    expect(yok.status).toBe(404);
  });

  it("hazır Short sunulur: video/mp4 + bayt; HEAD yalnız başlıklar", async () => {
    const t = await kur();
    await t.istek("/rubrik/bugun?kuru=1");
    const yol = `/rubrik/dosya/${GUN}/rubrik-karar-masasi-${GUN}-short.mp4`;
    const r = await t.istek(yol, "GET");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("video/mp4");
    expect(Buffer.from(await r.arrayBuffer()).equals(SAHTE_MP4)).toBe(true);
    const h = await t.istek(yol, "HEAD");
    expect(h.status).toBe(200);
    expect(h.headers.get("content-length")).toBe(String(SAHTE_MP4.length));
  });

  it("shortDosyaAdi + dosyaAdiGecerli: `-short.mp4` kabul; başka uzantı/ad reddedilir", () => {
    expect(shortDosyaAdi("karar-masasi", GUN)).toBe(`rubrik-karar-masasi-${GUN}-short.mp4`);
    expect(dosyaAdiGecerli(shortDosyaAdi("ogrenci-kosesi", GUN))).toBe(true);
    for (const kotu of [`rubrik-karar-masasi-${GUN}-short.mov`, `rubrik-karar-masasi-${GUN}-01.mp4`, `rubrik-karar-masasi-${GUN}-short.tmp.mp4`, "../x-short.mp4"]) expect(dosyaAdiGecerli(kotu)).toBe(false);
  });
});

describe("kaynak kuralları", () => {
  const MODUL = fs.readFileSync(path.join(KOK, "infra/kart/lib/rubrik-yayin.mjs"), "utf8");
  const SERVER = fs.readFileSync(path.join(KOK, "infra/kart/server.mjs"), "utf8");
  const kodSatirlari = (kaynak: string) => kaynak.split("\n").filter((l) => !/^\s*\/\//.test(l));

  it("modülde \\uXXXX kaçışı ve emoji yok (araçlar kaçışı gerçek karaktere çevirir; imajda emoji yazı tipi yok) — açıklama satırları hariç", () => {
    const kod = kodSatirlari(MODUL).join("\n");
    expect(kod).not.toMatch(/\\u[0-9a-fA-F]{4}/);
    expect(kod).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });

  it("server.mjs: modül bağlı; jeton YALNIZ ortamdan; yönlendirme sırası rubrik → rubrikYayin → sosyal; sosyal meşgulken yayın hazırlığı 503", () => {
    expect(SERVER).toMatch(/import \{ createRubrikYayin \} from "\.\/lib\/rubrik-yayin\.mjs";/);
    expect(SERVER).toContain('const PLAN_TOKEN = process.env.CONTENT_PLAN_TOKEN ?? "";');
    expect(SERVER).toContain("planToken: PLAN_TOKEN,");
    expect(SERVER).toContain("planUrl: process.env.CONTENT_PLAN_URL || undefined,");
    expect(SERVER).toMatch(/const rubrikYayin = createRubrikYayin\(\{[\s\S]*?muzikPath: process\.env\.SOSYAL_MUZIK \?\? "\/varlik\/muzik\.mp3"/);
    const sira = ["rubrik.handle(req, res)", "rubrikYayin.handle(req, res)", "sosyal.handle(req, res)"].map((s) => SERVER.indexOf(s));
    expect(sira.every((i) => i > 0)).toBe(true);
    expect([...sira].sort((a, b) => a - b)).toEqual(sira);
    expect(SERVER).toMatch(/const rubrikYayin = createRubrikYayin\(\{[\s\S]*?mesgul: \(\) => sosyal\.durum\(\)\.durum === "calisiyor"/);
    expect(kodSatirlari(SERVER).filter((l) => /(log|console\.\w+)\(.*PLAN_TOKEN/.test(l))).toEqual([]);
    expect(SERVER).not.toMatch(/CONTENT_PLAN_TOKEN\s*=\s*["'][^"']+["']/); // sabit jeton yok
  });
});
