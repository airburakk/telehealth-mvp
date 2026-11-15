// Doctorium Instagram karuseli — kart servisi v3 ucu (karusel planı adım 3, 2026-11-15). Gerçek Python çizicisi bu testte YOK
// (sahte çizici); gerçek çizim + 14 Kasım kabul ölçütü .github/workflows/kart-karusel.yml'de Linux + RAQM konteynerinde koşar.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { createKarusel, GORSEL_ADLARI, gunGecerli, karuselDosyaAdiGecerli, karuselGovdeDogrula } from "../../infra/kart/lib/karusel-v3.mjs";

const JETON = "test-jetonu";
const GUN = "2026-11-14";
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("sahte")]);

const govde = (degis: Record<string, unknown> = {}) => ({
  edition: { day: GUN, rawBodyUtf8: "{}", rawBodySha256: "x" },
  editorial: { day: GUN },
  gorseller: Object.fromEntries(GORSEL_ADLARI.map((a) => [a, PNG.toString("base64")])),
  ...degis,
});

type Cizici = (girdi: string, cikti: string) => Promise<{ kod: number; stdout: string; stderr: string }>;
const basariliCizici: Cizici = async (_girdi, cikti) => {
  fs.mkdirSync(cikti, { recursive: true });
  for (let n = 1; n <= 8; n++) fs.writeFileSync(path.join(cikti, `0${n}.png`), Buffer.concat([PNG, Buffer.from([n])]));
  fs.writeFileSync(path.join(cikti, "QA.json"), JSON.stringify({ safeToPublish: false }));
  return { kod: 0, stdout: '{"tamam":true}\n', stderr: "" };
};

let kok: string;
let sunucu: http.Server;
let taban: string;

async function kur(o: { token?: string; mesgul?: () => boolean; cizici?: Cizici } = {}) {
  const k = createKarusel({ dir: kok, token: o.token ?? JETON, mesgul: o.mesgul, cizici: o.cizici ?? basariliCizici });
  sunucu = http.createServer(async (req, res) => { if (!(await k.handle(req, res))) { res.writeHead(418); res.end(); } });
  await new Promise<void>((r) => sunucu.listen(0, "127.0.0.1", r));
  taban = `http://127.0.0.1:${(sunucu.address() as AddressInfo).port}`;
}
const uret = (g: unknown, jeton: string | null = JETON) =>
  fetch(`${taban}/karusel/uret`, { method: "POST", headers: jeton ? { authorization: `Bearer ${jeton}` } : {}, body: JSON.stringify(g) });

beforeEach(() => { kok = fs.mkdtempSync(path.join(os.tmpdir(), "karusel-test-")); });
afterEach(async () => {
  await new Promise<void>((r) => (sunucu ? sunucu.close(() => r()) : r()));
  fs.rmSync(kok, { recursive: true, force: true });
});

describe("saf doğrulayıcılar", () => {
  it("gün: biçim + takvim geçerliliği", () => {
    expect(gunGecerli("2026-11-14")).toBe(true);
    expect(gunGecerli("2026-02-30")).toBe(false);
    expect(gunGecerli("../x")).toBe(false);
  });
  it("dosya adı yalnız 01–08.png", () => {
    expect(karuselDosyaAdiGecerli("08.png")).toBe(true);
    for (const a of ["09.png", "QA.json", "bitti.json", "../01.png", "1.png"]) expect(karuselDosyaAdiGecerli(a)).toBe(false);
  });
  it("gövde: tam yedi görsel, PNG imzası, gün eşleşmesi", () => {
    expect(karuselGovdeDogrula(govde()).ok).toBe(true);
    const eksik = govde(); delete (eksik.gorseller as Record<string, string>)["haber-6.png"];
    expect(karuselGovdeDogrula(eksik).ok).toBe(false);
    const fazla = govde(); (fazla.gorseller as Record<string, string>)["../kac.png"] = PNG.toString("base64");
    expect(karuselGovdeDogrula(fazla).ok).toBe(false);
    const pngDegil = govde(); (pngDegil.gorseller as Record<string, string>)["kapak.png"] = Buffer.from("GIF89a").toString("base64");
    expect(karuselGovdeDogrula(pngDegil).ok).toBe(false);
    expect(karuselGovdeDogrula(govde({ editorial: { day: "2026-11-13" } })).ok).toBe(false);
  });
});

describe("POST /karusel/uret kapıları", () => {
  it("jeton tanımsızsa 503 (kapalı kapı)", async () => {
    await kur({ token: "" });
    expect((await uret(govde())).status).toBe(503);
  });
  it("jetonsuz / yanlış jeton 401", async () => {
    await kur();
    expect((await uret(govde(), null)).status).toBe(401);
    expect((await uret(govde(), "yanlis")).status).toBe(401);
  });
  it("sosyal üretim sürerken 503", async () => {
    await kur({ mesgul: () => true });
    expect((await uret(govde())).status).toBe(503);
  });
  it("geçersiz gövde 400, çizici çağrılmaz", async () => {
    let cagrildi = false;
    await kur({ cizici: async (...a) => { cagrildi = true; return basariliCizici(...a); } });
    expect((await uret({ x: 1 })).status).toBe(400);
    expect(cagrildi).toBe(false);
  });
  it("aynı anda ikinci iş 429", async () => {
    let birak!: () => void;
    const bekle = new Promise<void>((r) => { birak = r; });
    await kur({ cizici: async (g, c) => { await bekle; return basariliCizici(g, c); } });
    const ilk = uret(govde());
    await new Promise((r) => setTimeout(r, 50));
    expect((await uret(govde())).status).toBe(429);
    birak();
    expect((await ilk).status).toBe(200);
  });
  it("çizici çıkış 2 → 422 (hata metniyle), çıkış 3 → 500; dosya yayımlanmaz", async () => {
    await kur({ cizici: async () => ({ kod: 2, stdout: '{"hata":"kart 4: metin + görsel sığmıyor"}\n', stderr: "" }) });
    const r = await uret(govde());
    expect(r.status).toBe(422);
    expect((await r.json()).hata).toContain("sığmıyor");
    expect((await fetch(`${taban}/karusel/dosya/${GUN}/01.png`)).status).toBe(404);
    await new Promise<void>((x) => sunucu.close(() => x()));
    await kur({ cizici: async () => ({ kod: 3, stdout: '{"hata":"kapanış kartı kilidi tutmadı"}\n', stderr: "" }) });
    expect((await uret(govde())).status).toBe(500);
  });
});

describe("başarılı iş + dosya sunumu", () => {
  it("200 → 8 dosya hash'iyle; GET yalnız bitti.json sonrası, jetonsuz; iş klasörü temizlenir", async () => {
    await kur();
    expect((await fetch(`${taban}/karusel/dosya/${GUN}/01.png`)).status).toBe(404);
    const r = await uret(govde());
    expect(r.status).toBe(200);
    const y = await r.json();
    expect(y.gun).toBe(GUN);
    expect(y.dosyalar.map((d: { ad: string }) => d.ad)).toEqual(["01.png", "02.png", "03.png", "04.png", "05.png", "06.png", "07.png", "08.png"]);
    expect(y.qa.safeToPublish).toBe(false);
    const g = await fetch(`${taban}/karusel/dosya/${GUN}/08.png`);
    expect(g.status).toBe(200);
    expect(g.headers.get("content-type")).toBe("image/png");
    expect(Buffer.from(await g.arrayBuffer()).at(-1)).toBe(8);
    expect((await fetch(`${taban}/karusel/dosya/${GUN}/bitti.json`)).status).toBe(404);
    expect((await fetch(`${taban}/karusel/dosya/${GUN}/QA.json`)).status).toBe(404);
    expect((await fetch(`${taban}/karusel/dosya/..%2F..%2Fetc/01.png`)).status).toBe(404);
    expect(fs.readdirSync(path.join(kok, "karusel")).filter((a) => a.startsWith(".is-"))).toEqual([]);
  });
  it("bitti.json yoksa (yarım iş) dosya görünmez", async () => {
    await kur();
    await uret(govde());
    fs.rmSync(path.join(kok, "karusel", GUN, "bitti.json"));
    expect((await fetch(`${taban}/karusel/dosya/${GUN}/01.png`)).status).toBe(404);
  });
  it("tanımadığı yolu çağırana bırakır; yanlış yöntem 405", async () => {
    await kur();
    expect((await fetch(`${taban}/bulten.png`)).status).toBe(418);
    expect((await fetch(`${taban}/karusel/uret`)).status).toBe(405);
  });
});
