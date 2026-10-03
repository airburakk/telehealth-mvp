// v6.320 — `infra/kart/` hikâye + Reels render servisi: saf yardımcılar (tipografi · Reel planı · şablon güvenliği), seçki doğrulaması,
// tek-iş durum makinesi (SAHTE üretici + GERÇEK HTTP), dosya ucu güvenliği ve dağıtım sözleşmeleri (Dockerfile · varlık eşliği · lang="tr").
// ffmpeg/Chromium GEREKMEZ (üretici sahte); gerçek üretim sunucuda `tools/dogrula.mjs` ile Instagram şartlarına karşı doğrulanır.
import { afterEach, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { createSosyal, digestDogrula, dosyaAdiGecerli, dosyaMeta, gunGecerli, kapsamHesapla } from "../../infra/kart/lib/sosyal-isleri.mjs";
import { hikayeKareHtml, reelHtml, reelPlan, tipo } from "../../infra/kart/lib/social-video.mjs";

const NBSP = String.fromCharCode(0xa0);
const KOK = process.cwd();
const oku = (rel: string) => fs.readFileSync(path.join(KOK, rel), "utf8");
const sha = (rel: string) => crypto.createHash("sha256").update(fs.readFileSync(path.join(KOK, rel))).digest("hex");

type Oge = { stream: string; streamLabel: string; title: string; sourceName: string; summary: string; summaryLong: string; summaryLongFallback: boolean; branch: null | { label: string } };
type Digest = { day: string; items: Oge[] };
type Dosya = { ad: string; tur: string; sira: number; boyut: number };
type Govde = { durum: string; gun?: string | null; hata?: string; adim?: string; asama?: string; bos_gun?: boolean; kapsam?: { ogeSayisi: number; yedekSayisi: number }; dosyalar?: Dosya[] };

function oge(i: number, uzanti: Partial<Oge> = {}): Oge {
  return { stream: "akademik", streamLabel: "AKADEMİK", title: `Başlık ${i}`, sourceName: `Kaynak ${i}`, summary: "kısa", summaryLong: `Açıklama ${i}.`, summaryLongFallback: false, branch: null, ...uzanti };
}
function digestOrnek(n = 2, day = "2026-10-03"): Digest {
  return { day, items: Array.from({ length: n }, (_, i) => oge(i + 1)) };
}
const GRID = { P: 0.5607648, a: 0.3222, bpm: 106.9967 };

// ── saf yardımcılar ─────────────────────────────────────────────────────────────────────────────────
describe("tipo — açıklama tipografisi", () => {
  it("tarih satır sonunda bölünmez (gün + ay + yıl arası NBSP)", () => {
    const s = tipo("Yayın 18 Ağustos 2026 tarihinde");
    expect(s).toContain(`18${NBSP}Ağustos${NBSP}2026`);
    expect(s).not.toContain("18 Ağustos");
  });
  it("sayı aralığı bölünmez ve kısa çizgi en dash olur", () => {
    expect(tipo("OR 1,53-3,28 bulundu")).toContain('<span style="white-space:nowrap">1,53–3,28</span>');
  });
  it("'r ≈ 0,55' bağlanır", () => {
    expect(tipo("r ≈ 0,55")).toBe(`r${NBSP}≈${NBSP}0,55`);
  });
  it("HTML kaçışı: seçki metni şablona ham girmez", () => {
    expect(tipo("<b>x</b> & y")).toBe("&lt;b&gt;x&lt;/b&gt; &amp; y");
  });
});

describe("reelPlan — vuruş planı", () => {
  it("başlık uzunluğuna göre 6/8/10/12 vuruş; giriş 4, kapanış 6; aralıklar kesintisiz", () => {
    const d = digestOrnek(4);
    d.items[0].title = "x".repeat(40);
    d.items[1].title = "x".repeat(80);
    d.items[2].title = "x".repeat(100);
    d.items[3].title = "x".repeat(130);
    const p = reelPlan(d, GRID);
    expect(p.plan.map((r: { s: number; e: number }) => r.e - r.s)).toEqual([6, 8, 10, 12]);
    expect(p.plan[0].s).toBe(4);
    for (let i = 1; i < p.plan.length; i++) expect(p.plan[i].s).toBe(p.plan[i - 1].e);
    expect(p.OUTRO_START).toBe(p.plan[3].e);
    expect(p.TOTAL_BEATS).toBe(p.OUTRO_START + 6);
    expect(p.TOTAL_T).toBeCloseTo(0.15 + p.TOTAL_BEATS * GRID.P + 0.6, 6);
  });
});

describe("şablon güvenliği", () => {
  const SALDIRI = "<img src=x onerror=alert(1)>";
  const KURE = "data:image/webp;base64,AAAA";

  it("hikâye karesi: başlık/kaynak/açıklama kaçışlıdır, lang=tr, açıklama = summaryLong", () => {
    const d = digestOrnek(1);
    d.items[0] = oge(1, { title: SALDIRI, sourceName: SALDIRI, summaryLong: `Metin ${SALDIRI} sonu.` });
    const html = hikayeKareHtml(d, d.items[0], 0, 1, d.items[0].summaryLong, KURE);
    expect(html).toContain('<html lang="tr">');
    expect(html).not.toContain(SALDIRI);
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("Metin ");
  });

  it("Reel A: yalnız başlık + kaynak (summaryLong KULLANILMAZ), kaçışlı, lang=tr", () => {
    const d = digestOrnek(2);
    d.items[0] = oge(1, { title: SALDIRI, summaryLong: "GIZLI-ACIKLAMA-METNI" });
    const html = reelHtml(d, GRID, KURE);
    expect(html).toContain('<html lang="tr">');
    expect(html).not.toContain(SALDIRI);
    expect(html).not.toContain("GIZLI-ACIKLAMA-METNI");
  });
});

// ── seçki doğrulaması + adlar ───────────────────────────────────────────────────────────────────────
describe("digestDogrula · kapsam · dosya adları", () => {
  it("geçerli seçki ve boş gün kabul edilir", () => {
    expect(() => digestDogrula(digestOrnek(3))).not.toThrow();
    expect(() => digestDogrula({ day: "2026-10-03", items: [] })).not.toThrow();
  });

  it("gün biçimi katı (dosya yoluna girer): gezinti ve bozuk biçim reddedilir", () => {
    for (const day of ["../../etc", "2026-10-3", "20261003", "", undefined]) {
      expect(() => digestDogrula({ day, items: [] }), String(day)).toThrow(/day/);
    }
  });

  it("items yok / başlık boş / summaryLong yok → anlaşılır hata (şablon 'undefined' yazmaz)", () => {
    expect(() => digestDogrula({ day: "2026-10-03" })).toThrow(/items/);
    expect(() => digestDogrula({ day: "2026-10-03", items: [oge(1, { title: " " })] })).toThrow(/title/);
    const eksik = { ...oge(1) } as Partial<Oge>;
    delete eksik.summaryLong;
    expect(() => digestDogrula({ day: "2026-10-03", items: [eksik] })).toThrow(/summaryLong.*v6\.317/);
  });

  it("kapsam: öğe ve yedek cümle sayısı", () => {
    const d = digestOrnek(3);
    d.items[1].summaryLongFallback = true;
    expect(kapsamHesapla(d)).toEqual({ ogeSayisi: 3, yedekSayisi: 1 });
  });

  it("dosyaMeta: hikâye sırası klip numarası, Reel 1, diğeri 'diger'", () => {
    expect(dosyaMeta("hikaye-2026-10-03-01-kart.mp4")).toEqual({ tur: "hikaye", sira: 1 });
    expect(dosyaMeta("hikaye-2026-10-03-05-icerik-4.mp4")).toEqual({ tur: "hikaye", sira: 5 });
    expect(dosyaMeta("reels-a-2026-10-03.mp4")).toEqual({ tur: "reel", sira: 1 });
    expect(dosyaMeta("baska.mp4")).toEqual({ tur: "diger", sira: 0 });
  });

  it("gün ve dosya adı kalıpları gezintiyi/uzantı oyununu dışlar", () => {
    expect(gunGecerli("2026-10-03")).toBe(true);
    for (const kotu of ["../2026-10-03", "2026-10-03/", "2026-10-03.", "x"]) expect(gunGecerli(kotu), kotu).toBe(false);
    expect(dosyaAdiGecerli("hikaye-2026-10-03-01-kart.mp4")).toBe(true);
    for (const kotu of ["../a.mp4", "a/b.mp4", ".gizli.mp4", "A.mp4", "a.mp4.exe", "bitti.json", "%2e%2e.mp4", "a\\b.mp4"]) expect(dosyaAdiGecerli(kotu), kotu).toBe(false);
  });
});

// ── tek-iş durum makinesi (sahte üretici + gerçek HTTP) ─────────────────────────────────────────────
type Ayar = { stories?: Error | null; bekle?: Promise<void> | null; digest: Digest | (() => Promise<Digest>) | Error; muzikVar: boolean };
const temizlenecek: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (temizlenecek.length) await temizlenecek.pop()!();
});

async function kur(ayar: Partial<Ayar> = {}) {
  const kok = fs.mkdtempSync(path.join(os.tmpdir(), "kart-test-"));
  const dir = path.join(kok, "sosyal");
  const muzik = path.join(kok, "muzik.mp3");
  fs.writeFileSync(muzik, "x"); // yalnız varlık denetimi — gerçek ses işlenmez
  const a: Ayar = { stories: null, bekle: null, digest: digestOrnek(2), muzikVar: true, ...ayar };
  const cagri = { stories: 0, reel: 0, kart: 0, getDigest: 0 };
  const gordu: { stories: unknown; reel: unknown } = { stories: null, reel: null };
  const logs: string[] = [];

  const uretici = {
    renderStories: async ({ digest, outDir }: { digest: Digest; outDir: string }) => {
      cagri.stories++;
      gordu.stories = digest;
      if (a.bekle) await a.bekle;
      if (a.stories) throw a.stories;
      fs.mkdirSync(outDir, { recursive: true });
      const files: string[] = [];
      for (let k = 0; k <= digest.items.length; k++) {
        const ad = k === 0 ? "01-kart" : `${String(k + 1).padStart(2, "0")}-icerik-${k}`;
        const f = path.join(outDir, `hikaye-${digest.day}-${ad}.mp4`);
        fs.writeFileSync(f, Buffer.from(`hikaye-${k}`));
        files.push(f);
      }
      return { files, timings: { toplam_sn: 1 }, fit: [] };
    },
    renderReelA: async ({ digest, outPath }: { digest: Digest; outPath: string }) => {
      cagri.reel++;
      gordu.reel = digest;
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, Buffer.from(`reel-${digest.day}`));
      return { file: outPath, timings: { toplam_sn: 2 }, frames: 10, seconds: 1 };
    },
  };

  const sosyal = createSosyal({
    dir,
    muzikPath: muzik,
    spherePath: "kure.webp",
    grid: GRID,
    getBrowser: async () => ({}),
    getDigest: async () => {
      cagri.getDigest++;
      if (a.digest instanceof Error) throw a.digest;
      return typeof a.digest === "function" ? a.digest() : a.digest;
    },
    renderCardPng: async () => {
      cagri.kart++;
      return Buffer.from("png");
    },
    uretici,
    log: (m: string) => logs.push(m),
  });
  const sunucu = http.createServer((req, res) => {
    sosyal.handle(req, res).then((islendi: boolean) => { if (!islendi) { res.writeHead(404); res.end(); } });
  });
  await new Promise<void>((r) => sunucu.listen(0, "127.0.0.1", r));
  const port = (sunucu.address() as AddressInfo).port;
  const base = `http://127.0.0.1:${port}`;
  temizlenecek.push(async () => {
    // Node: pipe/pipeline ile AKITILAN yanıtın keep-alive soketi "boşta" sayılmaz → close() istemcinin (undici) soketi bırakmasını ~3 sn bekler.
    sunucu.closeAllConnections();
    await new Promise<void>((r) => sunucu.close(() => r()));
    fs.rmSync(kok, { recursive: true, force: true });
  });

  const post = (yol = "/sosyal/uret") => fetch(base + yol, { method: "POST" });
  const durum = async () => (await fetch(base + "/sosyal/durum")).json() as Promise<Govde>;
  const hazirOl = async (beklenen = "hazir") => {
    for (let i = 0; i < 200; i++) {
      const d = await durum();
      if (d.durum === beklenen) return d;
      await new Promise((r) => setTimeout(r, 15));
    }
    throw new Error(`durum "${beklenen}" olmadı: ${JSON.stringify(await durum())}`);
  };
  return { kok, dir, muzik, a, cagri, gordu, logs, base, port, post, durum, hazirOl };
}

describe("sosyal iş yöneticisi", () => {
  it("başlangıçta durum 'bos'", async () => {
    const t = await kur();
    expect(await t.durum()).toEqual({ durum: "bos" });
  });

  it("POST → 202 (calisiyor) → hazir; dosyalar sıralı ve tam; yarım iş izi (.is) kalmaz; tek seçki anlık görüntüsü", async () => {
    const t = await kur();
    const r = await t.post();
    expect(r.status).toBe(202);
    const b = (await r.json()) as Govde;
    expect(b.durum).toBe("calisiyor");
    expect(b.gun).toBe("2026-10-03");
    expect(b.kapsam).toEqual({ ogeSayisi: 2, yedekSayisi: 0 });

    const d = await t.hazirOl();
    expect(d.gun).toBe("2026-10-03");
    expect(d.kapsam).toEqual({ ogeSayisi: 2, yedekSayisi: 0 });
    expect((d.dosyalar ?? []).map((f) => [f.tur, f.sira, f.ad])).toEqual([
      ["hikaye", 1, "hikaye-2026-10-03-01-kart.mp4"],
      ["hikaye", 2, "hikaye-2026-10-03-02-icerik-1.mp4"],
      ["hikaye", 3, "hikaye-2026-10-03-03-icerik-2.mp4"],
      ["reel", 1, "reels-a-2026-10-03.mp4"],
    ]);
    expect((d.dosyalar ?? []).every((f) => f.boyut > 0)).toBe(true);
    const gunDir = path.join(t.dir, "2026-10-03");
    expect(fs.existsSync(path.join(gunDir, "bitti.json"))).toBe(true);
    expect(fs.existsSync(path.join(gunDir, ".is"))).toBe(false);
    expect(fs.existsSync(path.join(gunDir, "bitti.json.tmp"))).toBe(false);
    // kart + hikâyeler + Reel AYNI digest nesnesinden (yeniden çekilmedi)
    expect(t.cagri).toEqual({ stories: 1, reel: 1, kart: 1, getDigest: 1 });
    expect(t.gordu.stories).toBe(t.gordu.reel);
  });

  it("aynı gün ikinci POST idempotent: 200 hazir, yeniden üretmez", async () => {
    const t = await kur();
    await t.post();
    await t.hazirOl();
    const r = await t.post();
    expect(r.status).toBe(200);
    expect(((await r.json()) as Govde).durum).toBe("hazir");
    expect(t.cagri.stories).toBe(1);
  });

  it("?yenile=1 yeniden üretir", async () => {
    const t = await kur();
    await t.post();
    await t.hazirOl();
    const r = await t.post("/sosyal/uret?yenile=1");
    expect(r.status).toBe(202);
    await t.hazirOl();
    expect(t.cagri.stories).toBe(2);
    expect(t.cagri.reel).toBe(2);
  });

  it("iş sürerken POST → 409; bitince hazir; ikinci iş HİÇ başlamaz", async () => {
    let birak!: () => void;
    const bekle = new Promise<void>((r) => { birak = r; });
    const t = await kur({ bekle });
    expect((await t.post()).status).toBe(202);
    const r2 = await t.post();
    expect(r2.status).toBe(409);
    const b2 = (await r2.json()) as Govde;
    expect(b2.durum).toBe("calisiyor");
    expect(b2.hata).toMatch(/sürüyor/);
    expect((await t.durum()).durum).toBe("calisiyor");
    birak();
    await t.hazirOl();
    expect(t.cagri.stories).toBe(1);
  });

  it("kilit seçki çekilmeden ÖNCE alınır: eşzamanlı iki POST'tan yalnız biri 202 alır", async () => {
    const t = await kur({ digest: async () => { await new Promise((r) => setTimeout(r, 40)); return digestOrnek(1); } });
    const [x, y] = await Promise.all([t.post(), t.post()]);
    expect([x.status, y.status].sort()).toEqual([202, 409]);
    await t.hazirOl();
    expect(t.cagri.getDigest).toBe(1); // ikinci istek seçkiyi hiç çekmedi
    expect(t.cagri.stories).toBe(1);
  });

  it("boş gün: 200 bos_gun, hiçbir şey üretilmez", async () => {
    const t = await kur({ digest: { day: "2026-10-03", items: [] } });
    const r = await t.post();
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ durum: "hazir", gun: "2026-10-03", bos_gun: true, dosyalar: [], kapsam: { ogeSayisi: 0, yedekSayisi: 0 } });
    expect(t.cagri.stories + t.cagri.reel + t.cagri.kart).toBe(0);
    expect(fs.existsSync(path.join(t.dir, "2026-10-03"))).toBe(false);
  });

  it("üretim hatası: durum 'hata' (adım ile), gün klasörü silinir; düzelince yeniden denenir ve hata temizlenir", async () => {
    const t = await kur({ stories: new Error("ffmpeg patladı") });
    expect((await t.post()).status).toBe(202);
    const d = await t.hazirOl("hata");
    expect(d.hata).toContain("ffmpeg patladı");
    expect(d.adim).toBe("hikaye");
    expect(d.gun).toBe("2026-10-03");
    expect(fs.existsSync(path.join(t.dir, "2026-10-03"))).toBe(false);

    t.a.stories = null;
    expect((await t.post()).status).toBe(202);
    const iyi = await t.hazirOl();
    expect(iyi.gun).toBe("2026-10-03");
    expect((await t.durum()).hata).toBeUndefined();
  });

  it("müzik yok → 503 ve üretim BAŞLAMAZ; yenile'de önceki iyi klipler KORUNUR", async () => {
    const t = await kur();
    await t.post();
    await t.hazirOl();
    fs.rmSync(t.muzik);
    const r = await t.post("/sosyal/uret?yenile=1");
    expect(r.status).toBe(503);
    expect(((await r.json()) as Govde).hata).toMatch(/müzik/);
    expect(t.cagri.stories).toBe(1);
    const dosya = await fetch(`${t.base}/sosyal/dosya/2026-10-03/hikaye-2026-10-03-01-kart.mp4`);
    expect(dosya.status).toBe(200); // eski klip silinmedi
  });

  it("seçki alınamazsa 502 + durum 'hata'; sonraki başarılı üretim hatayı temizler", async () => {
    const t = await kur({ digest: new Error("seçki ucu HTTP 500") });
    const r = await t.post();
    expect(r.status).toBe(502);
    expect(((await r.json()) as Govde).hata).toMatch(/seçki ucu HTTP 500/);
    expect((await t.durum()).durum).toBe("hata");

    t.a.digest = digestOrnek(1);
    expect((await t.post()).status).toBe(202);
    await t.hazirOl();
    expect((await t.durum()).hata).toBeUndefined();
  });

  it("summaryLong'suz (eski uç) seçki 502 verir — şablon 'undefined' basmaz", async () => {
    const eksik = digestOrnek(1);
    delete (eksik.items[0] as Partial<Oge>).summaryLong;
    const t = await kur({ digest: eksik });
    const r = await t.post();
    expect(r.status).toBe(502);
    expect(((await r.json()) as Govde).hata).toMatch(/summaryLong/);
    expect(t.cagri.stories).toBe(0);
  });

  it("yalnız en yeni 2 gün klasörü kalır; gün olmayan klasöre dokunulmaz", async () => {
    const t = await kur();
    for (const g of ["2026-09-30", "2026-10-01", "2026-10-02", "notlar"]) fs.mkdirSync(path.join(t.dir, g), { recursive: true });
    await t.post();
    await t.hazirOl();
    expect(fs.readdirSync(t.dir).sort()).toEqual(["2026-10-02", "2026-10-03", "notlar"]);
  });

  it("günlük içerik/başlık sızdırmaz (yalnız gün, sayı, süre)", async () => {
    const t = await kur();
    await t.post();
    await t.hazirOl();
    const gunluk = t.logs.join("\n");
    expect(gunluk).toContain("2026-10-03");
    expect(gunluk).not.toContain("Başlık 1");
    expect(gunluk).not.toContain("Açıklama 1");
  });

  it("yanlış yöntem 405 (Allow başlığıyla), bilinmeyen /sosyal yolu 404, ilgisiz URL'yi çağırana bırakır", async () => {
    const t = await kur();
    const g = await fetch(`${t.base}/sosyal/uret`);
    expect(g.status).toBe(405);
    expect(g.headers.get("allow")).toBe("POST");
    expect((await fetch(`${t.base}/sosyal/durum`, { method: "POST" })).status).toBe(405);
    expect((await fetch(`${t.base}/sosyal/yok`)).status).toBe(404);
    expect((await fetch(`${t.base}/bulten.png`)).status).toBe(404); // handle false döndü → harness 404'ü
  });
});

describe("dosya ucu (GET/HEAD /sosyal/dosya)", () => {
  const AD = "hikaye-2026-10-03-01-kart.mp4";

  async function hazirKur() {
    const t = await kur();
    await t.post();
    await t.hazirOl();
    return t;
  }
  /** fetch `..` parçalarını istemci tarafında çözer → sunucuya ham gitmesi için http.get. */
  const ham = (port: number, yol: string) =>
    new Promise<number>((resolve, reject) => {
      http.get({ host: "127.0.0.1", port, path: yol }, (res) => { res.resume(); resolve(res.statusCode ?? 0); }).on("error", reject);
    });

  it("GET: video/mp4, doğru uzunluk ve bayt", async () => {
    const t = await hazirKur();
    const r = await fetch(`${t.base}/sosyal/dosya/2026-10-03/${AD}`);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("video/mp4");
    const govde = Buffer.from(await r.arrayBuffer());
    expect(govde.toString()).toBe("hikaye-0");
    expect(Number(r.headers.get("content-length"))).toBe(govde.length);
  });

  it("HEAD: başlıklar var, gövde yok", async () => {
    const t = await hazirKur();
    const r = await fetch(`${t.base}/sosyal/dosya/2026-10-03/${AD}`, { method: "HEAD" });
    expect(r.status).toBe(200);
    expect(r.headers.get("content-length")).toBe(String("hikaye-0".length));
    expect((await r.arrayBuffer()).byteLength).toBe(0);
  });

  it("listede olmayan / bitti.json / gezinti denemeleri 404", async () => {
    const t = await hazirKur();
    fs.writeFileSync(path.join(t.dir, "2026-10-03", "gizli.mp4"), "sızmamalı"); // diskte var ama bitti.json'da LİSTELİ DEĞİL
    const gecersiz = [
      `/sosyal/dosya/2026-10-03/gizli.mp4`,
      `/sosyal/dosya/2026-10-03/bitti.json`,
      `/sosyal/dosya/2026-10-03/..%2Fbitti.json`,
      `/sosyal/dosya/..%2F2026-10-03/${AD}`,
      `/sosyal/dosya/2026-10-04/${AD}`,
      `/sosyal/dosya/2026-10-03`,
      `/sosyal/dosya/2026-10-03/a/b.mp4`,
    ];
    for (const yol of gecersiz) expect((await fetch(t.base + yol)).status, yol).toBe(404);
    // ham `..` parçaları: URL ayrıştırması çözer → hedef /sosyal/dosya/bitti.json → 404 (dizin dışına çıkış yok)
    expect(await ham(t.port, "/sosyal/dosya/2026-10-03/../bitti.json")).toBe(404);
    expect(await ham(t.port, "/sosyal/dosya/2026-10-03/../../../etc/passwd")).toBe(404);
  });

  it("üretim sürerken yarım klipler sunulmaz (bitti.json yok → 404)", async () => {
    let birak!: () => void;
    const bekle = new Promise<void>((r) => { birak = r; });
    const t = await kur({ bekle });
    await t.post();
    expect((await fetch(`${t.base}/sosyal/dosya/2026-10-03/${AD}`)).status).toBe(404);
    birak();
    await t.hazirOl();
    expect((await fetch(`${t.base}/sosyal/dosya/2026-10-03/${AD}`)).status).toBe(200);
  });
});

// ── dağıtım sözleşmeleri (statik) ───────────────────────────────────────────────────────────────────
describe("infra/kart dağıtım sözleşmeleri", () => {
  it("Dockerfile: Playwright imaj etiketi = npm sürümü; ffmpeg kurulur; lib/assets/tools kopyalanır; müzik İMAJA girmez", () => {
    const df = oku("infra/kart/Dockerfile");
    const imaj = /FROM mcr\.microsoft\.com\/playwright:v(\d+\.\d+\.\d+)-noble/.exec(df)?.[1];
    const npmSurum = /npm i [^\n]*playwright@(\d+\.\d+\.\d+)/.exec(df)?.[1];
    expect(imaj).toBeTruthy();
    expect(npmSurum).toBe(imaj); // uyumsuzluk "browser not found" verir
    expect(df).toMatch(/apt-get install[^\n]*ffmpeg/);
    for (const k of ["COPY server.mjs .", "COPY lib ./lib", "COPY assets ./assets", "COPY tools ./tools"]) expect(df).toContain(k);
    expect(df).not.toMatch(/COPY[^\n]*\.mp3/i);
  });

  it(".gitattributes: infra/kart/ LF'e sabit (Windows autocrlf=true `git archive` çıktısını CRLF yapar → Dockerfile `\\` devamı Linux'ta bozulur); webp ikili", () => {
    const ga = oku(".gitattributes");
    expect(ga).toMatch(/^infra\/kart\/\*\*\s+text=auto\s+eol=lf\s*$/m);
    expect(ga).toMatch(/^infra\/kart\/assets\/\*\.webp\s+binary\s*$/m);
  });

  it("küre görseli public/brand ile bayt bayt aynı (sürüklenme yok)", () => {
    expect(sha("infra/kart/assets/doctorium-sphere-disk-1024-v3.webp")).toBe(sha("public/brand/doctorium-sphere-disk-1024-v3.webp"));
  });

  it("vuruş ızgarası geçerli: P/a/bpm sonlu, bpm ≈ 60/P", () => {
    const g = JSON.parse(oku("infra/kart/assets/beatgrid.json")) as { P: number; a: number; bpm: number };
    for (const k of [g.P, g.a, g.bpm]) expect(Number.isFinite(k)).toBe(true);
    expect(g.bpm).toBeCloseTo(60 / g.P, 1);
  });

  it("server.mjs: kart şablonu lang=tr (Türkçe büyük harf), jeton günlüğe yazılmaz, 3000 dinler", () => {
    const s = oku("infra/kart/server.mjs");
    expect(s).toContain('<html lang="tr">');
    const logSatirlari = s.split("\n").filter((l) => /console\.(log|error|warn|info)|log:\s*\(/.test(l));
    expect(logSatirlari.length).toBeGreaterThan(0);
    for (const l of logSatirlari) expect(l, l).not.toMatch(/TOKEN/);
    expect(s).toMatch(/\.listen\(Number\(process\.env\.PORT\) \|\| 3000/); // konteynerde PORT yok → 3000 (compose 127.0.0.1:3001→3000)
    expect(s).toContain("--disable-dev-shm-usage");
  });

  it("kaynakta görünmez/NBSP karakter YOK (araçlar \\u kaçışını gerçek karaktere çevirebilir → NBSP String.fromCharCode ile)", () => {
    const gorunmez = new RegExp("[" + String.fromCharCode(0xa0, 0xad, 0x200b, 0x200c, 0x200d, 0x2060, 0xfeff) + "]");
    for (const rel of ["infra/kart/server.mjs", "infra/kart/lib/social-video.mjs", "infra/kart/lib/sosyal-isleri.mjs", "infra/kart/tools/uret.mjs", "infra/kart/tools/dogrula.mjs"]) {
      expect(oku(rel), rel).not.toMatch(gorunmez);
    }
  });
});
