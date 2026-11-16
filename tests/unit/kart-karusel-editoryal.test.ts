// Doctorium Instagram karuseli — kart servisi editoryal ucu (karusel planı adım 5, 2026-11-16). Gerçek Python üreticisi + model
// bu testte YOK (sahte üretici); üreticinin kendi testleri infra/kart/karusel/editoryal/test_*.py (konteynerde CI).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { createKaruselEditoryal, editoryalGovdeDogrula } from "../../infra/kart/lib/karusel-editoryal.mjs";

const JETON = "test-jetonu";
const GUN = "2026-11-16";
const govde = () => ({ edition: { day: GUN, rawBodyUtf8: "{}", rawBodySha256: "x" } });
type Uretici = (girdi: string, cikti: string) => Promise<{ kod: number; stdout: string; stderr: string }>;

const uretici = (karar: "GECTI" | "KALDI"): Uretici => async (girdi, cikti) => {
  expect(JSON.parse(fs.readFileSync(path.join(girdi, "edition.json"), "utf8")).day).toBe(GUN);
  fs.mkdirSync(path.join(cikti, "onbellek"), { recursive: true });
  fs.writeFileSync(path.join(cikti, "onbellek", "ucuncu-taraf.bin"), "kaynak sayfa");
  fs.writeFileSync(path.join(cikti, "QA-editoryal.json"), JSON.stringify({ gun: karar, cagri: 12, tahminiUsd: 0.01 }));
  if (karar === "GECTI") fs.writeFileSync(path.join(cikti, "editorial.json"), JSON.stringify({ day: GUN, items: [] }));
  return { kod: karar === "GECTI" ? 0 : 1, stdout: `{"karar":"${karar}"}\n`, stderr: "" };
};

let kok: string;
let sunucu: http.Server | undefined;
let taban: string;

async function kur(o: { token?: string; modelHazir?: boolean; mesgul?: () => boolean; uretici?: Uretici } = {}) {
  const k = createKaruselEditoryal({ dir: kok, token: o.token ?? JETON, modelHazir: o.modelHazir ?? true, mesgul: o.mesgul,
    uretici: o.uretici ?? uretici("GECTI") });
  sunucu = http.createServer(async (req, res) => { if (!(await k.handle(req, res))) { res.writeHead(418); res.end(); } });
  await new Promise<void>((r) => sunucu!.listen(0, "127.0.0.1", r));
  taban = `http://127.0.0.1:${(sunucu.address() as AddressInfo).port}`;
}
const istek = (g: unknown, jeton: string | null = JETON) =>
  fetch(`${taban}/karusel/editoryal`, { method: "POST", headers: jeton ? { authorization: `Bearer ${jeton}` } : {}, body: JSON.stringify(g) });

beforeEach(() => { kok = fs.mkdtempSync(path.join(os.tmpdir(), "karusel-editoryal-test-")); });
afterEach(async () => {
  await new Promise<void>((r) => (sunucu ? sunucu.close(() => r()) : r()));
  sunucu = undefined;
  fs.rmSync(kok, { recursive: true, force: true });
});

describe("gövde doğrulama", () => {
  it("edition günü + gövde alanları", () => {
    expect(editoryalGovdeDogrula(govde()).ok).toBe(true);
    expect(editoryalGovdeDogrula({}).ok).toBe(false);
    expect(editoryalGovdeDogrula({ edition: { day: "2026-02-30", rawBodyUtf8: "", rawBodySha256: "" } }).ok).toBe(false);
    expect(editoryalGovdeDogrula({ edition: { day: GUN } }).ok).toBe(false);
  });
});

describe("POST /karusel/editoryal kapıları", () => {
  it("jeton yoksa 503 · jetonsuz/yanlış 401 · anahtar yoksa 503 (DORMANT) · sosyal iş sürerken 503", async () => {
    await kur({ token: "" });
    expect((await istek(govde())).status).toBe(503);
    await new Promise<void>((r) => sunucu!.close(() => r()));
    await kur();
    expect((await istek(govde(), null)).status).toBe(401);
    expect((await istek(govde(), "yanlis")).status).toBe(401);
    await new Promise<void>((r) => sunucu!.close(() => r()));
    await kur({ modelHazir: false });
    const r = await istek(govde());
    expect(r.status).toBe(503);
    expect((await r.json()).hata).toContain("ANTHROPIC_API_KEY");
    await new Promise<void>((r2) => sunucu!.close(() => r2()));
    await kur({ mesgul: () => true });
    expect((await istek(govde())).status).toBe(503);
  });
  it("geçersiz gövde 400 — üretici (model) çağrılmaz", async () => {
    let cagrildi = false;
    await kur({ uretici: async (g, c) => { cagrildi = true; return uretici("GECTI")(g, c); } });
    expect((await istek({ x: 1 })).status).toBe(400);
    expect(cagrildi).toBe(false);
  });
  it("aynı anda ikinci iş 429", async () => {
    let birak!: () => void;
    const bekle = new Promise<void>((r) => { birak = r; });
    await kur({ uretici: async (g, c) => { await bekle; return uretici("GECTI")(g, c); } });
    const ilk = istek(govde());
    await new Promise((r) => setTimeout(r, 50));
    expect((await istek(govde())).status).toBe(429);
    birak();
    expect((await ilk).status).toBe(200);
  });
  it("üretici çıkış 2 → 400 (hata metniyle) · beklenmeyen çıkış → 500", async () => {
    await kur({ uretici: async () => ({ kod: 2, stdout: '{"hata":"edisyon doğrulanamadı"}\n', stderr: "" }) });
    const r = await istek(govde());
    expect(r.status).toBe(400);
    expect((await r.json()).hata).toBe("edisyon doğrulanamadı");
    await new Promise<void>((x) => sunucu!.close(() => x()));
    await kur({ uretici: async () => ({ kod: -1, stdout: "", stderr: "Traceback" }) });
    expect((await istek(govde())).status).toBe(500);
  });
});

describe("sonuç + iz", () => {
  it("GEÇTİ: editorial döner; iz klasöründe QA + editorial var, kaynak önbelleği YOK; iş klasörü temizlenir", async () => {
    await kur();
    const r = await istek(govde());
    expect(r.status).toBe(200);
    const y = await r.json();
    expect([y.gun, y.karar, y.editorial.day, y.qaEditoryal.cagri]).toEqual([GUN, "GECTI", GUN, 12]);
    const iz = path.join(kok, "karusel-editoryal", GUN);
    expect(fs.readdirSync(iz).sort()).toEqual(["QA-editoryal.json", "editorial.json"]);
    expect(fs.readdirSync(path.join(kok, "karusel-editoryal")).filter((a) => a.startsWith(".is-"))).toEqual([]);
  });
  it("KALDI: editorial null, iz yalnız QA (önceki günün GEÇTİ editorial'ı silinir)", async () => {
    await kur();
    await istek(govde());
    await new Promise<void>((x) => sunucu!.close(() => x()));
    await kur({ uretici: uretici("KALDI") });
    const y = await (await istek(govde())).json();
    expect([y.karar, y.editorial]).toEqual(["KALDI", null]);
    expect(fs.readdirSync(path.join(kok, "karusel-editoryal", GUN))).toEqual(["QA-editoryal.json"]);
  });
  it("çıkış 0 ama QA KALDI diyorsa KALDI (fail-closed)", async () => {
    await kur({ uretici: async (g, c) => { const s = await uretici("KALDI")(g, c); return { ...s, kod: 0 }; } });
    expect((await (await istek(govde())).json()).karar).toBe("KALDI");
  });
  it("tanımadığı yolu bırakır; yanlış yöntem 405", async () => {
    await kur();
    expect((await fetch(`${taban}/karusel/uret`)).status).toBe(418);
    expect((await fetch(`${taban}/karusel/editoryal`)).status).toBe(405);
  });
});
