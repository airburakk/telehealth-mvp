// İçerik takvimi — rubrik YouTube Short + X zinciri (v6.340). Saf zamanlama/filtre/gruplama + sahte ffmpeg ile üretim akışı.
// Gerçek ffmpeg ile uçtan uca üretim bu testte YOK (CI'da ffmpeg yok); yerel prova: 7 slayt → 32 sn 1080×1920 (sessiz + müzikli).
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SHORT, X_GORSEL_SINIRI, renderRubrikShort, shortFiltre, shortZamanlama, xGruplari } from "../../infra/kart/lib/rubrik-video.mjs";

const KOK = path.resolve(__dirname, "../..");

describe("xGruplari (X zinciri)", () => {
  it("ilk gönderi en çok 4 görsel; kalanı sırayla ≤ 4'lük yanıtlar", () => {
    expect(X_GORSEL_SINIRI).toBe(4);
    expect(xGruplari(0)).toEqual([]);
    expect(xGruplari(3)).toEqual([[1, 2, 3]]);
    expect(xGruplari(4)).toEqual([[1, 2, 3, 4]]);
    expect(xGruplari(5)).toEqual([[1, 2, 3, 4], [5]]);
    expect(xGruplari(7)).toEqual([[1, 2, 3, 4], [5, 6, 7]]);
    expect(xGruplari(10)).toEqual([[1, 2, 3, 4], [5, 6, 7, 8], [9, 10]]);
  });
  it("her slayt TAM BİR KEZ ve sırayla yer alır", () => {
    for (let n = 1; n <= 10; n++) expect(xGruplari(n).flat()).toEqual(Array.from({ length: n }, (_, i) => i + 1));
  });
  it("geçersiz sayı reddedilir", () => {
    for (const k of [-1, 1.5, Number.NaN]) expect(() => xGruplari(k)).toThrow();
  });
});

describe("shortZamanlama", () => {
  it("varsayılan: slayt 5 sn, geçiş 0,5 sn; toplam = n·5 − (n−1)·0,5", () => {
    expect(shortZamanlama(1)).toEqual({ slaytSn: 5, gecisSn: 0, toplamSn: 5, ofsetler: [] });
    expect(shortZamanlama(7)).toMatchObject({ slaytSn: 5, gecisSn: 0.5, toplamSn: 32, ofsetler: [4.5, 9, 13.5, 18, 22.5, 27] });
  });
  it("10 slayt (Instagram üst sınırı) sınırın altında kalır", () => {
    const z = shortZamanlama(10);
    expect(z.toplamSn).toBeLessThanOrEqual(SHORT.enCokSn);
    expect(z.slaytSn).toBe(5);
  });
  it("sınırı aşan sayı: slayt süresi kısalır, toplam sınırı GEÇMEZ", () => {
    const z = shortZamanlama(13);
    expect(z.slaytSn).toBeLessThan(5);
    expect(z.slaytSn).toBeGreaterThanOrEqual(SHORT.asgariSlaytSn);
    expect(z.toplamSn).toBeLessThanOrEqual(SHORT.enCokSn);
  });
  it("asgari süreye sığmayan sayı HATA (kırpılmış video yok); 0 slayt HATA", () => {
    expect(() => shortZamanlama(30)).toThrow(/sığmıyor/);
    expect(() => shortZamanlama(0)).toThrow();
  });
  it("Shorts biçimi 9:16 dikey; slayt 4:5 olduğu gibi (yeniden çizim yok)", () => {
    expect(SHORT.w / SHORT.h).toBeCloseTo(9 / 16);
    expect(SHORT.slaytW / SHORT.slaytH).toBeCloseTo(4 / 5);
  });
});

describe("shortFiltre", () => {
  it("tek slayt: xfade YOK", () => {
    const f = shortFiltre(1, shortZamanlama(1));
    expect(f).not.toContain("xfade");
    expect(f).toContain("[s0]null[v]");
  });
  it("n slayt: n−1 xfade, ofsetler zamanlamadan; son çıkış [v]", () => {
    const z = shortZamanlama(3);
    const f = shortFiltre(3, z);
    expect(f.match(/xfade=/g)).toHaveLength(2);
    expect(f).toContain("[s0][s1]xfade=transition=fade:duration=0.5:offset=4.5[x1]");
    expect(f).toContain("[x1][s2]xfade=transition=fade:duration=0.5:offset=9[v]");
  });
  it("kare 0 DOLU: giriş kararması yok (X/YouTube küçük resmi ilk saniyeden seçer)", () => {
    const f = shortFiltre(5, shortZamanlama(5));
    expect(f).not.toMatch(/fade=t=in|fade=in|fade=type=in/);
  });
  it("slayt ortalanır, arka plan aynı slaytın bulanık büyütmesi (metin üretilmez)", () => {
    const f = shortFiltre(2, shortZamanlama(2));
    expect(f).toContain("overlay=(W-w)/2:(H-h)/2");
    expect(f).toContain("boxblur");
    expect(f).not.toContain("drawtext");
  });
});

describe("renderRubrikShort (sahte ffmpeg)", () => {
  const kur = () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "rubrik-short-"));
    const cagrilar: (string | number)[][] = [];
    const ffImpl = async (args: (string | number)[]) => { cagrilar.push(args); fs.writeFileSync(String(args[args.length - 1]), "x"); return ""; };
    const aacCagri: unknown[][] = [];
    const aacImpl = async (...a: unknown[]) => { aacCagri.push(a); fs.writeFileSync(String(a[1]), "a"); return { tepe: -3, kazanc: 0, deneme: 1 }; };
    return { d, cagrilar, ffImpl, aacCagri, aacImpl };
  };

  it("müzik yok → SESSİZ: video + faststart birleştirme; aac çağrılmaz", async () => {
    const t = kur();
    try {
      const r = await renderRubrikShort({ pngYollari: ["a.png", "b.png"], outPath: path.join(t.d, "o.mp4"), workDir: path.join(t.d, "is"), muzikPath: path.join(t.d, "yok.mp3"), ffImpl: t.ffImpl as never, aacImpl: t.aacImpl as never });
      expect(r).toEqual({ sure_sn: 9.5, sesli: false });
      expect(t.cagrilar).toHaveLength(2);
      expect(t.cagrilar[0]).toEqual(expect.arrayContaining(["-loop", 1, "-i", "a.png", "-i", "b.png", "-map", "[v]", "-an", "libx264", "yuv420p"]));
      expect(t.cagrilar[1]).toEqual(expect.arrayContaining(["-movflags", "+faststart"]));
      expect(t.aacCagri).toHaveLength(0);
    } finally {
      fs.rmSync(t.d, { recursive: true, force: true });
    }
  });

  it("müzik var → loudnorm + tepe korumalı AAC (aacGuvenli) + birleştirme; süre video süresine eşit", async () => {
    const t = kur();
    try {
      const muzik = path.join(t.d, "muzik.mp3");
      fs.writeFileSync(muzik, "m");
      const r = await renderRubrikShort({ pngYollari: ["a.png", "b.png", "c.png"], outPath: path.join(t.d, "o.mp4"), workDir: path.join(t.d, "is"), muzikPath: muzik, ffImpl: t.ffImpl as never, aacImpl: t.aacImpl as never });
      expect(r).toEqual({ sure_sn: 14, sesli: true });
      expect(t.cagrilar).toHaveLength(3);
      expect(t.cagrilar[1]!.join(" ")).toMatch(/loudnorm=I=-16:TP=-2\.5/);
      expect(t.aacCagri).toHaveLength(1);
      expect(t.aacCagri[0]![2]).toEqual({ tSec: 14 });
      expect(t.cagrilar[2]).toEqual(expect.arrayContaining(["-c", "copy", "-t", 14, "-movflags", "+faststart"]));
    } finally {
      fs.rmSync(t.d, { recursive: true, force: true });
    }
  });

  it("ffmpeg hatası çağırana fırlar (rubrik-yayin onu `videoHata`ya çevirir)", async () => {
    const t = kur();
    try {
      await expect(renderRubrikShort({ pngYollari: ["a.png"], outPath: path.join(t.d, "o.mp4"), workDir: path.join(t.d, "is"), ffImpl: (async () => { throw new Error("ffmpeg hata (1)"); }) as never })).rejects.toThrow(/ffmpeg/);
    } finally {
      fs.rmSync(t.d, { recursive: true, force: true });
    }
  });
});

describe("kaynak kuralları", () => {
  const kod = fs.readFileSync(path.join(KOK, "infra/kart/lib/rubrik-video.mjs"), "utf8").split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
  it("\\uXXXX kaçışı ve emoji yok; yalnız onaylı PNG kullanılır (Chromium/drawtext yok)", () => {
    expect(kod).not.toMatch(/\\u[0-9a-fA-F]{4}/);
    expect(kod).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    expect(kod).not.toMatch(/drawtext|getBrowser|chromium/i);
  });
});
