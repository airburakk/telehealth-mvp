// Karusel editoryal — KAPAK SIĞMA KAPISI (2026-11-26). Python kapak_sigma.py ↔ TS kapak-sigma.ts eşliği: beklenen sonuçlar
// infra/kart/karusel/editoryal/eslik_uret.py ile üretildi (karusel-kapak-sigma-eslik.json). Gerçek kapak çizicisiyle
// karşılaştırma Python tarafında (test_kapak_sigma.py, kart imajında). Model ve ağ YOK.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import eslik from "./karusel-kapak-sigma-eslik.json";
import { check } from "@/lib/karusel-editoryal/kapilar";
import { kapakSigma, KONUMLAR, yerlesim } from "@/lib/karusel-editoryal/kapak-sigma";
import { kapiSorunlari } from "@/lib/karusel-editoryal/uret";
import type { Taslak } from "@/lib/karusel-editoryal/kapilar";

type Vaka = { konum: number; taslak: { coverTitle: string; coverDeck: string }; sonuc: [boolean, string];
  baslik: [number, number] | null; aciklama: [number, number] | null };
const vakalar = eslik.vakalar as unknown as Vaka[];

describe("kapak sığma — Python eşliği", () => {
  it("ölçü tablosu iki kopyada aynı (TS ↔ kart imajı; içerik düzeyinde — Windows checkout'ta src/ CRLF olabilir)", () => {
    const oku = (p: string) => JSON.parse(readFileSync(resolve(__dirname, "../..", p), "utf8"));
    expect(oku("src/lib/karusel-editoryal/kapak-olculeri.json")).toEqual(oku("infra/kart/karusel/editoryal/kapak-olculeri.json"));
  });
  it("fikstür dolu; 3. konumda (prova bulgusu) hem geçen hem kalan vaka var", () => {
    expect(vakalar.length).toBeGreaterThanOrEqual(180);
    expect(new Set(vakalar.filter((v) => v.konum === 3).map((v) => v.sonuc[0])).size).toBe(2);
  });
  it.each(vakalar.map((v, i) => [`${i} · konum ${v.konum}`, v] as const))("%s", (_ad, v) => {
    const [bk, ak] = KONUMLAR[v.konum - 1];
    expect(yerlesim(v.taslak.coverTitle, bk, true)).toEqual(v.baslik);
    expect(yerlesim(v.taslak.coverDeck, ak, false)).toEqual(v.aciklama);
    expect(kapakSigma(v.taslak, v.konum)).toEqual(v.sonuc);
  });
  it("ret geri bildirimi kapı listesinin sonunda, uretici satırıyla birebir", () => {
    const t = eslik.geriBildirim.taslak as Taslak;
    const oge = { streamLabel: "Sektörel", url: "https://x" };
    for (const [k, beklenen] of Object.entries(eslik.geriBildirim.konumlar)) {
      expect(kapiSorunlari(check(t, oge, "x", Number(k)), t)).toEqual(beklenen);
    }
    expect(check(t, oge, "x").map(([a]) => a)).not.toContain("kapak_sigma");   // konumsuz çağrı (eski davranış)
  });
});
