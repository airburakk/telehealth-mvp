// v6.320 — `infra/kart/` hikâye + Reels render servisi: saf yardımcılar (tipografi · Reel planı · şablon güvenliği), seçki doğrulaması,
// tek-iş durum makinesi (SAHTE üretici + GERÇEK HTTP), dosya ucu güvenliği ve dağıtım sözleşmeleri (Dockerfile · varlık eşliği · lang="tr").
// v6.323 — + kaydırmalı post (carousel) slaytları: şablon güvenliği · `renderCarousel` (sahte tarayıcı) · `gorseller` sözleşmesi (geriye uyumlu) · PNG dosya ucu · `kapsam.akislar`.
// ffmpeg/Chromium GEREKMEZ (üretici sahte); gerçek üretim sunucuda `tools/dogrula.mjs` ile Instagram şartlarına karşı doğrulanır.
import { afterEach, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { createSosyal, digestDogrula, dosyaAdiGecerli, dosyaMeta, gorselAdiGecerli, gorselMeta, gunGecerli, kapsamHesapla } from "../../infra/kart/lib/sosyal-isleri.mjs";
import { hikayeKareHtml, reelHtml, reelPlan, renderReelA, tipo } from "../../infra/kart/lib/social-video.mjs";
import { icerikSlaytHtml, kapanisSlaytHtml, renderCarousel } from "../../infra/kart/lib/social-carousel.mjs";

const NBSP = String.fromCharCode(0xa0);
const KOK = process.cwd();
const oku = (rel: string) => fs.readFileSync(path.join(KOK, rel), "utf8");
const sha = (rel: string) => crypto.createHash("sha256").update(fs.readFileSync(path.join(KOK, rel))).digest("hex");

type Oge = { stream: string; streamLabel: string; title: string; sourceName: string; summary: string; summaryLong: string; summaryLongFallback: boolean; branch: null | { label: string } };
type Digest = { day: string; items: Oge[] };
type Dosya = { ad: string; tur: string; sira: number; boyut: number };
type Govde = {
  durum: string; gun?: string | null; hata?: string; adim?: string; asama?: string; bos_gun?: boolean;
  kapsam?: { ogeSayisi: number; yedekSayisi: number; akislar?: string[] }; dosyalar?: Dosya[]; gorseller?: Dosya[];
};

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

  it("carousel içerik slaydı: başlık/kaynak/açıklama/akış/branş kaçışlıdır, lang=tr, açıklama = summaryLong, i/N, 1080x1350", () => {
    const d = digestOrnek(3);
    d.items[1] = oge(2, {
      title: SALDIRI, sourceName: SALDIRI, streamLabel: "İlaç & Cihaz", branch: { label: "Acil <Tıp>" },
      summaryLong: `Metin ${SALDIRI} 18 Ağustos 2026 ve 1,53-3,28.`,
    });
    const html = icerikSlaytHtml(d, d.items[1], 1, 3, d.items[1].summaryLong, KURE);
    expect(html).toContain('<html lang="tr">');
    expect(html).not.toContain(SALDIRI);
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("İlaç &amp; Cihaz");
    expect(html).toContain("Acil &lt;Tıp&gt;");
    expect(html).toContain(">2/3<");
    expect(html).toContain(`18${NBSP}Ağustos${NBSP}2026`); // açıklama `tipo()`'dan geçer
    expect(html).toMatch(/html,body \{ width:1080px; height:1350px; \}/);
  });

  it("carousel kapanış slaydı: yeni iddia YOK (yalnız marka + seçkinin adresi), lang=tr, seçki içeriği girmez", () => {
    const d = digestOrnek(2);
    d.items[0] = oge(1, { title: "GIZLI-BASLIK", summaryLong: "GIZLI-ACIKLAMA-METNI" });
    const html = kapanisSlaytHtml(d, KURE);
    expect(html).toContain('<html lang="tr">');
    expect(html).toContain("Seçkinin tamamı");
    expect(html).toContain("biyografideki bağlantıda");
    expect(html).toContain("doctorium.tr/secki");
    expect(html).not.toContain("GIZLI-BASLIK");
    expect(html).not.toContain("GIZLI-ACIKLAMA-METNI");
    // vitrin iddia disiplini (public-claim-honesty): ölçülmemiş/mutlak iddia yok
    expect(html).not.toMatch(/uçtan uca|akredite|garanti|%\s?\d/i);
  });
});

// ── carousel üretimi: GERÇEK modül + sahte tarayıcı ─────────────────────────────────────────────────
describe("carousel üretimi (renderCarousel — sahte tarayıcı)", () => {
  const KURE_YOL = path.join(KOK, "infra/kart/assets/doctorium-sphere-disk-1024-v3.webp");

  /** `evaluate`: argümansız çağrı = yazı tipi kapısı/fonts.ready; argümanlı (pad) çağrı = sığdırma ölçümü. */
  function sahteTarayici(hata = false) {
    const sayfalar: Array<{ kapandi: boolean; html: string }> = [];
    return {
      sayfalar,
      newPage: async () => {
        const kayit = { kapandi: false, html: "" };
        sayfalar.push(kayit);
        return {
          setContent: async (h: string) => { kayit.html = h; if (hata) throw new Error("setContent patladı"); },
          evaluate: async (_fn: unknown, arg?: unknown) => (arg === undefined ? { inter: true, mono: true } : { h2: 56, desc: 40, bosluk: 8 }),
          screenshot: async (o: { path: string }) => { fs.writeFileSync(o.path, "slayt"); },
          close: async () => { kayit.kapandi = true; },
        };
      },
    };
  }
  function calisma() {
    const w = fs.mkdtempSync(path.join(os.tmpdir(), "carousel-test-"));
    temizlenecek.push(async () => { fs.rmSync(w, { recursive: true, force: true }); });
    const kart = path.join(w, "kart.png");
    fs.writeFileSync(kart, "kart-bayt");
    return { w, kart, out: path.join(w, "cikti") };
  }

  it("N öğe → N+2 PNG (kart · içerikler · kapanış), adlar sıralı; slayt 1 = kart baytları (dokunulmadan kopya); sayfalar kapanır", async () => {
    const { kart, out } = calisma();
    const b = sahteTarayici();
    const r = await renderCarousel({ digest: digestOrnek(3), cardPng: kart, outDir: out, spherePath: KURE_YOL, browser: b });
    expect(r.files.map((f: string) => path.basename(f))).toEqual([
      "carousel-2026-10-03-01-kart.png",
      "carousel-2026-10-03-02-icerik-1.png",
      "carousel-2026-10-03-03-icerik-2.png",
      "carousel-2026-10-03-04-icerik-3.png",
      "carousel-2026-10-03-05-kapanis.png",
    ]);
    expect(r.files.every((f: string) => gorselAdiGecerli(path.basename(f)))).toBe(true); // üretilen her ad dosya ucunun kalıbına uyar
    expect(fs.readFileSync(r.files[0]).toString()).toBe("kart-bayt");
    expect(r.fit).toHaveLength(3);
    expect(b.sayfalar).toHaveLength(4); // 3 içerik + kapanış (kart sayfa açmaz)
    expect(b.sayfalar.every((s) => s.kapandi)).toBe(true);
    expect(b.sayfalar[0].html).toContain("Başlık 1");
    expect(b.sayfalar[3].html).toContain("doctorium.tr/secki");
  });

  it("boş seçki: hiçbir şey üretilmez, tarayıcı hiç açılmaz", async () => {
    const { kart, out } = calisma();
    const b = sahteTarayici();
    const r = await renderCarousel({ digest: { day: "2026-10-03", items: [] }, cardPng: kart, outDir: out, spherePath: KURE_YOL, browser: b });
    expect(r).toEqual({ files: [], fit: [] });
    expect(b.sayfalar).toHaveLength(0);
    expect(fs.existsSync(out)).toBe(false);
  });

  it("hata yolunda sayfa kapanır (ömürlü tarayıcıda sızıntı yok) ve hata yutulmaz", async () => {
    const { kart, out } = calisma();
    const b = sahteTarayici(true);
    await expect(renderCarousel({ digest: digestOrnek(2), cardPng: kart, outDir: out, spherePath: KURE_YOL, browser: b })).rejects.toThrow(/setContent patladı/);
    expect(b.sayfalar).toHaveLength(1); // ilk içerikte düştü, diğerleri hiç açılmadı
    expect(b.sayfalar.every((s) => s.kapandi)).toBe(true);
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

  it("kapsam: öğe ve yedek cümle sayısı + günün akışları", () => {
    const d = digestOrnek(3);
    d.items[1].summaryLongFallback = true;
    expect(kapsamHesapla(d)).toEqual({ ogeSayisi: 3, yedekSayisi: 1, akislar: ["AKADEMİK"] });
  });

  it("kapsam.akislar: seçki sırasıyla, TEKRARSIZ (Reel/carousel altyazısının akış satırı); boş gün → []", () => {
    const d = digestOrnek(4);
    ["Akademik", "İlaç & Cihaz", "Akademik", "Mevzuat"].forEach((s, i) => { d.items[i].streamLabel = s; });
    expect(kapsamHesapla(d).akislar).toEqual(["Akademik", "İlaç & Cihaz", "Mevzuat"]);
    expect(kapsamHesapla({ day: "2026-10-03", items: [] }).akislar).toEqual([]);
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

  it("carousel slayt adı: yalnız kart | icerik-K | kapanis; gezinti/uzantı oyunu ve mp4 kalıbı dışlanır; PNG adı mp4 kalıbına UYMAZ", () => {
    for (const iyi of ["carousel-2026-10-03-01-kart.png", "carousel-2026-10-03-02-icerik-1.png", "carousel-2026-10-03-11-icerik-10.png", "carousel-2026-10-03-06-kapanis.png"]) {
      expect(gorselAdiGecerli(iyi), iyi).toBe(true);
      expect(dosyaAdiGecerli(iyi), iyi).toBe(false); // türler birbirinin listesine karışmaz
    }
    for (const kotu of ["../carousel-2026-10-03-01-kart.png", "carousel-2026-10-03-1-kart.png", "carousel-2026-10-03-01-baska.png", "carousel-2026-10-03-01-kart.PNG",
      "carousel-2026-10-03-01-kart.png.exe", "carousel-2026-10-03-01-kart.mp4", "carousel-2026-10-03-01-kart.png/x", "bulten-2026-10-03.png", "carousel-26-10-03-01-kart.png", "%2e%2e.png"]) {
      expect(gorselAdiGecerli(kotu), kotu).toBe(false);
    }
    expect(gorselAdiGecerli(undefined)).toBe(false);
    expect(dosyaAdiGecerli("hikaye-2026-10-03-01-kart.mp4") && gorselAdiGecerli("hikaye-2026-10-03-01-kart.mp4")).toBe(false);
  });

  it("gorselMeta: sıra = slayt numarası, tür 'carousel'", () => {
    expect(gorselMeta("carousel-2026-10-03-01-kart.png")).toEqual({ tur: "carousel", sira: 1 });
    expect(gorselMeta("carousel-2026-10-03-05-icerik-4.png")).toEqual({ tur: "carousel", sira: 5 });
    expect(gorselMeta("carousel-2026-10-03-06-kapanis.png")).toEqual({ tur: "carousel", sira: 6 });
    expect(gorselMeta("baska.png")).toEqual({ tur: "carousel", sira: 0 });
  });
});

// ── tek-iş durum makinesi (sahte üretici + gerçek HTTP) ─────────────────────────────────────────────
type Ayar = {
  stories?: Error | null; carousel?: Error | null; carouselEksik?: boolean; sigmadi?: boolean;
  bekle?: Promise<void> | null; digest: Digest | (() => Promise<Digest>) | Error; muzikVar: boolean;
};
const temizlenecek: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (temizlenecek.length) await temizlenecek.pop()!();
});

async function kur(ayar: Partial<Ayar> = {}) {
  const kok = fs.mkdtempSync(path.join(os.tmpdir(), "kart-test-"));
  const dir = path.join(kok, "sosyal");
  const muzik = path.join(kok, "muzik.mp3");
  fs.writeFileSync(muzik, "x"); // yalnız varlık denetimi — gerçek ses işlenmez
  const a: Ayar = { stories: null, carousel: null, carouselEksik: false, sigmadi: false, bekle: null, digest: digestOrnek(2), muzikVar: true, ...ayar };
  const cagri = { stories: 0, reel: 0, kart: 0, carousel: 0, getDigest: 0 };
  const gordu: { stories: unknown; reel: unknown; carousel: unknown; carouselKart: string | null } = { stories: null, reel: null, carousel: null, carouselKart: null };
  const logs: string[] = [];

  const uretici = {
    // v6.323: kart + her içerik için 1 + kapanış = N+2 PNG (gerçek modülle aynı adlar); `cardPng` slayt 1'in kaynağı olarak GEÇİLİR
    renderCarousel: async ({ digest, cardPng, outDir }: { digest: Digest; cardPng: string; outDir: string }) => {
      cagri.carousel++;
      gordu.carousel = digest;
      gordu.carouselKart = fs.existsSync(cardPng) ? fs.readFileSync(cardPng).toString() : null;
      if (a.carousel) throw a.carousel;
      fs.mkdirSync(outDir, { recursive: true });
      const n = digest.items.length;
      const adlar = ["01-kart", ...digest.items.map((_, i) => `${String(i + 2).padStart(2, "0")}-icerik-${i + 1}`), `${String(n + 2).padStart(2, "0")}-kapanis`];
      if (a.carouselEksik) adlar.pop();
      const files = adlar.map((ad) => {
        const f = path.join(outDir, `carousel-${digest.day}-${ad}.png`);
        fs.writeFileSync(f, Buffer.from(`slayt-${ad}`));
        return f;
      });
      return { files, fit: digest.items.map((_, i) => ({ h2: 58, desc: 42, bosluk: a.sigmadi && i === 0 ? -12 : 20 })) };
    },
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
    expect(b.kapsam).toEqual({ ogeSayisi: 2, yedekSayisi: 0, akislar: ["AKADEMİK"] });

    const d = await t.hazirOl();
    expect(d.gun).toBe("2026-10-03");
    expect(d.kapsam).toEqual({ ogeSayisi: 2, yedekSayisi: 0, akislar: ["AKADEMİK"] });
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
    // kart + carousel + hikâyeler + Reel AYNI digest nesnesinden (yeniden çekilmedi)
    expect(t.cagri).toEqual({ stories: 1, reel: 1, kart: 1, carousel: 1, getDigest: 1 });
    expect(t.gordu.stories).toBe(t.gordu.reel);
    expect(t.gordu.carousel).toBe(t.gordu.stories);
  });

  it("carousel: `gorseller` N+2 slayt (kart · içerikler · kapanış), sıralı; MP4 listesine KARIŞMAZ (çalışan n8n akışı `dosyalar`daki her öğede ftyp arar)", async () => {
    const t = await kur();
    await t.post();
    const d = await t.hazirOl();
    expect((d.gorseller ?? []).map((f) => [f.tur, f.sira, f.ad])).toEqual([
      ["carousel", 1, "carousel-2026-10-03-01-kart.png"],
      ["carousel", 2, "carousel-2026-10-03-02-icerik-1.png"],
      ["carousel", 3, "carousel-2026-10-03-03-icerik-2.png"],
      ["carousel", 4, "carousel-2026-10-03-04-kapanis.png"],
    ]);
    expect((d.gorseller ?? []).every((f) => f.boyut > 0)).toBe(true);
    expect((d.dosyalar ?? []).every((f) => f.ad.endsWith(".mp4") && f.tur !== "carousel")).toBe(true); // geriye uyum: PNG `dosyalar`a girmez
    expect(t.gordu.carouselKart).toBe("png"); // slayt 1'in kaynağı = job'un kart PNG'si (renderCardPng çıktısı)
    const bitti = JSON.parse(fs.readFileSync(path.join(t.dir, "2026-10-03", "bitti.json"), "utf8")) as { surum: number; gorseller: Dosya[]; olcum: { carousel: { sn: number; puntolar: unknown[] } } };
    expect(bitti.surum).toBe(2);
    expect(bitti.gorseller).toHaveLength(4);
    expect(bitti.olcum.carousel.puntolar).toHaveLength(2);
  });

  it("carousel hatası: iş `hata` (adim=carousel), gün klasörü silinir ve VİDEOLAR HİÇ BAŞLAMAZ (hızlı ve yüksek sesli başarısızlık)", async () => {
    const t = await kur({ carousel: new Error("yazı tipi yüklenemedi") });
    expect((await t.post()).status).toBe(202);
    const d = await t.hazirOl("hata");
    expect(d.adim).toBe("carousel");
    expect(d.hata).toContain("yazı tipi yüklenemedi");
    expect(t.cagri.stories + t.cagri.reel).toBe(0);
    expect(fs.existsSync(path.join(t.dir, "2026-10-03"))).toBe(false);
  });

  it("carousel slayt sayısı beklenenden farklıysa (yarım çıktı) iş `hata` verir — eksik carousel yayına gitmez", async () => {
    const t = await kur({ carouselEksik: true });
    await t.post();
    const d = await t.hazirOl("hata");
    expect(d.adim).toBe("kapanis");
    expect(d.hata).toMatch(/slayt sayısı.*3\/4/);
    expect(fs.existsSync(path.join(t.dir, "2026-10-03"))).toBe(false);
  });

  it("asgari puntoda bile sığmayan slayt günlüğe yalnız sıra numarasıyla düşer (içerik sızmaz)", async () => {
    const t = await kur({ sigmadi: true });
    await t.post();
    await t.hazirOl();
    const gunluk = t.logs.join("\n");
    expect(gunluk).toMatch(/slayt 2 asgari puntoda sığmadı \(boşluk -12 px\)/);
    expect(gunluk).not.toContain("Başlık 1");
  });

  it("carousel öncesi (v6.320) bitti.json hâlâ geçerli: `gorseller` yoksa [] döner, MP4 ucu çalışır", async () => {
    const t = await kur();
    const gunDir = path.join(t.dir, "2026-10-03");
    fs.mkdirSync(gunDir, { recursive: true });
    fs.writeFileSync(path.join(gunDir, "hikaye-2026-10-03-01-kart.mp4"), "eski");
    fs.writeFileSync(path.join(gunDir, "bitti.json"), JSON.stringify({
      surum: 1, gun: "2026-10-03", olusturuldu: "2026-10-03T17:00:00.000Z", sure_sn: 240, kapsam: { ogeSayisi: 4, yedekSayisi: 1 },
      dosyalar: [{ ad: "hikaye-2026-10-03-01-kart.mp4", boyut: 4, tur: "hikaye", sira: 1 }],
    }));
    const d = await t.durum();
    expect(d.durum).toBe("hazir");
    expect(d.gorseller).toEqual([]);
    expect(d.kapsam).toEqual({ ogeSayisi: 4, yedekSayisi: 1 }); // `akislar` yok → n8n akış satırını ATLAR (Array.isArray kapısı)
    expect((await fetch(`${t.base}/sosyal/dosya/2026-10-03/hikaye-2026-10-03-01-kart.mp4`)).status).toBe(200);
    expect((await fetch(`${t.base}/sosyal/dosya/2026-10-03/carousel-2026-10-03-01-kart.png`)).status).toBe(404);
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
    expect(await r.json()).toEqual({ durum: "hazir", gun: "2026-10-03", bos_gun: true, dosyalar: [], gorseller: [], kapsam: { ogeSayisi: 0, yedekSayisi: 0, akislar: [] } });
    expect(t.cagri.stories + t.cagri.reel + t.cagri.kart + t.cagri.carousel).toBe(0);
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

describe("dayanıklılık", () => {
  it("bozuk istek yolu ('GET //') süreci düşürmez: handle false döner, çağıran 404 verir; sunucu yaşamaya devam eder", async () => {
    const t = await kur();
    // `new URL("//", base)` fırlatır; try dışında kalsaydı işlenmeyen reddetme (Node ≥15'te süreç çökmesi) + asılı istek olurdu
    const durumSatiri = await new Promise<string>((resolve, reject) => {
      const s = net.connect(t.port, "127.0.0.1", () => s.write("GET // HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n"));
      let buf = "";
      s.on("data", (d) => { buf += d.toString(); });
      s.on("close", () => resolve(buf.split("\r\n")[0]));
      s.on("error", reject);
    });
    expect(durumSatiri).toBe("HTTP/1.1 404 Not Found");
    expect((await t.durum()).durum).toBe("bos");
  });

  // Sahte tarayıcı: ffmpeg/Chromium gerektirmez; hata yolunda sayfaların kapandığını ve diğer işçilerin durduğunu doğrular.
  const KURE = path.join(KOK, "infra/kart/assets/doctorium-sphere-disk-1024-v3.webp");
  function sahteTarayici(secenek: { setContentHata?: boolean; hataVerenIsci?: number } = {}) {
    const sayfalar: Array<{ kapandi: boolean }> = [];
    const sayac = { ekranGoruntusu: 0 };
    return {
      sayfalar,
      sayac,
      newPage: async () => {
        const kayit = { kapandi: false };
        const sira = sayfalar.push(kayit) - 1;
        return {
          setContent: async () => { if (secenek.setContentHata) throw new Error("setContent patladı"); },
          evaluate: async () => ({ inter: true, mono: true }), // fontlariDogrula'nın beklediği biçim; diğer çağrılar sonucu yok sayar
          screenshot: async (o: { path: string }) => {
            sayac.ekranGoruntusu++;
            if (secenek.hataVerenIsci === sira) throw new Error("screenshot patladı");
            fs.writeFileSync(o.path, "x");
          },
          close: async () => { kayit.kapandi = true; },
        };
      },
    };
  }
  async function reelDene(browser: ReturnType<typeof sahteTarayici>) {
    const w = fs.mkdtempSync(path.join(os.tmpdir(), "reel-test-"));
    temizlenecek.push(async () => { fs.rmSync(w, { recursive: true, force: true }); });
    return renderReelA({ digest: digestOrnek(2), outPath: path.join(w, "r.mp4"), workDir: w, music: "yok.mp3", grid: GRID, spherePath: KURE, browser, workers: 3 });
  }

  it("Reel A: işçilerin hepsi düşerse (yazı tipi/ağ) TÜM sayfalar kapanır — ömürlü tarayıcıda sızıntı yok", async () => {
    const b = sahteTarayici({ setContentHata: true });
    await expect(reelDene(b)).rejects.toThrow(/setContent patladı/);
    expect(b.sayfalar).toHaveLength(3);
    expect(b.sayfalar.every((s) => s.kapandi)).toBe(true);
  });

  it("Reel A: bir işçi düşerse diğerleri DURUR (abort) ve hepsi sayfasını kapatır; iş döndüğünde artakalan işçi yok", async () => {
    const b = sahteTarayici({ hataVerenIsci: 1 });
    await expect(reelDene(b)).rejects.toThrow(/screenshot patladı/);
    expect(b.sayfalar.every((s) => s.kapandi)).toBe(true);
    const toplamKare = Math.round(reelPlan(digestOrnek(2), GRID).TOTAL_T * 30);
    expect(toplamKare).toBeGreaterThan(300);
    expect(b.sayac.ekranGoruntusu).toBeLessThan(toplamKare / 10); // üç işçi tüm kareleri basmadı
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

  const PNG_AD = "carousel-2026-10-03-02-icerik-1.png";

  it("GET/HEAD PNG: image/png, doğru uzunluk ve bayt (yalnız `gorseller`de listeli)", async () => {
    const t = await hazirKur();
    const r = await fetch(`${t.base}/sosyal/dosya/2026-10-03/${PNG_AD}`);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("image/png");
    const govde = Buffer.from(await r.arrayBuffer());
    expect(govde.toString()).toBe("slayt-02-icerik-1");
    expect(Number(r.headers.get("content-length"))).toBe(govde.length);
    const h = await fetch(`${t.base}/sosyal/dosya/2026-10-03/${PNG_AD}`, { method: "HEAD" });
    expect(h.status).toBe(200);
    expect(h.headers.get("content-type")).toBe("image/png");
    expect((await h.arrayBuffer()).byteLength).toBe(0);
  });

  it("PNG: listede olmayan / gezinti / büyük harf uzantı / tür karışıklığı 404", async () => {
    const t = await hazirKur();
    fs.writeFileSync(path.join(t.dir, "2026-10-03", "carousel-2026-10-03-09-icerik-7.png"), "sızmamalı"); // diskte var, bitti.json'da LİSTELİ DEĞİL
    const gecersiz = [
      "/sosyal/dosya/2026-10-03/carousel-2026-10-03-09-icerik-7.png",
      "/sosyal/dosya/2026-10-03/..%2Fcarousel-2026-10-03-01-kart.png",
      "/sosyal/dosya/2026-10-04/carousel-2026-10-03-01-kart.png",
      "/sosyal/dosya/2026-10-03/carousel-2026-10-03-01-kart.PNG",
      "/sosyal/dosya/2026-10-03/carousel-2026-10-03-01-kart.mp4",
    ];
    for (const yol of gecersiz) expect((await fetch(t.base + yol)).status, yol).toBe(404);
  });

  it("üretim sürerken carousel PNG'leri diskte olsa da (carousel ÖNCE üretilir) bitti.json yoksa sunulmaz", async () => {
    let birak!: () => void;
    const bekle = new Promise<void>((r) => { birak = r; });
    const t = await kur({ bekle });
    await t.post();
    const ilk = path.join(t.dir, "2026-10-03", "carousel-2026-10-03-01-kart.png");
    for (let i = 0; i < 200 && !fs.existsSync(ilk); i++) await new Promise((r) => setTimeout(r, 15));
    expect(fs.existsSync(ilk)).toBe(true); // yarım iş diskte VAR…
    expect((await fetch(`${t.base}/sosyal/dosya/2026-10-03/carousel-2026-10-03-01-kart.png`)).status).toBe(404); // …ama sunulmaz
    birak();
    await t.hazirOl();
    expect((await fetch(`${t.base}/sosyal/dosya/2026-10-03/carousel-2026-10-03-01-kart.png`)).status).toBe(200);
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

  it("carousel çerçevesi kartla AYNI: slayt 1 kartın kendisi, 2…N+2 aynı dolgu/künye ölçüsüyle çizilir (sürüklenirse seri bozulur)", () => {
    const kart = oku("infra/kart/server.mjs");
    const slayt = oku("infra/kart/lib/social-carousel.mjs");
    for (const parca of ["padding:72px 84px 64px", "border-top:3px solid #18181b", "font-size:22px; letter-spacing:.14em"]) {
      expect(kart, `server.mjs: ${parca}`).toContain(parca);
      expect(slayt, `social-carousel.mjs: ${parca}`).toContain(parca);
    }
    expect(kart).toContain("renderCarousel: carousel.renderCarousel"); // servis carousel'i iş hattına gerçekten bağlar
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
    for (const rel of ["infra/kart/server.mjs", "infra/kart/lib/social-video.mjs", "infra/kart/lib/social-carousel.mjs", "infra/kart/lib/sosyal-isleri.mjs", "infra/kart/tools/uret.mjs", "infra/kart/tools/dogrula.mjs"]) {
      expect(oku(rel), rel).not.toMatch(gorunmez);
    }
  });
});
