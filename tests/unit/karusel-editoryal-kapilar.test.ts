// Karusel editoryal kapıları — Python ↔ TypeScript EŞLİK kilidi (Vercel'e taşıma, 2026-11-17).
// Beklenen sonuçlar Python kapilar.py'den üretildi (infra/kart/karusel/editoryal/eslik_uret.py); TS sürümü her vakada
// BİREBİR aynı [ad, geçti, ayrıntı] listesini vermeli. Fark = iki üretici farklı karar verir → bu test kırılır.
import { describe, expect, it } from "vitest";
import eslik from "./karusel-kapilar-eslik.json";
import { check, cpLen, fold, passed, type Taslak } from "@/lib/karusel-editoryal/kapilar";
import { kapiSorunlari, KISALTMA_YOLU } from "@/lib/karusel-editoryal/uret";

type Vaka = {
  ad: string; taslak: Taslak; item: { streamLabel: string; url: string }; src: string;
  beklenen: [string, boolean, string][]; geriBildirim: string[]; kisaltilacak: string[]; kisaltmaMesaji: string | null;
};

describe("kapılar — Python eşliği", () => {
  const vakalar = eslik.vakalar as unknown as Vaka[];
  it("fikstür dolu (≥30 vaka, onaylı 14 Kasım örnekleri dahil)", () => {
    expect(vakalar.length).toBeGreaterThanOrEqual(30);
    expect(vakalar.filter((v) => v.ad.startsWith("ornek-")).length).toBe(6);
  });
  it.each(vakalar.map((v) => [v.ad, v] as const))("%s", (_ad, v) => {
    expect(check(v.taslak, v.item, v.src)).toEqual(v.beklenen);
  });
  // Ret geri bildirimi (2026-11-18): modele giden satırlar Python kapi_sorunlari ile birebir.
  it.each(vakalar.map((v) => [v.ad, v] as const))("geri bildirim: %s", (_ad, v) => {
    expect(kapiSorunlari(check(v.taslak, v.item, v.src), v.taslak)).toEqual(v.geriBildirim);
  });
  it("uzunluk aşımı geri bildirimi kelime hedefi + kısaltma yolu içerir", () => {
    const v = vakalar.find((x) => x.ad === "uzun-coverdeck")!;
    expect(v.geriBildirim[0]).toBe("- uzunluk: coverDeck 141 karakter (18 kelime); sınır 125 karakter. En çok 12 kelime yaz → en az 6 kelime çıkar.");
    expect(v.geriBildirim.at(-1)).toBe(KISALTMA_YOLU);
  });
  it("kapak başlığı aşımı da kelime cinsinden geri bildirim alır", () => {
    // 27.11: sınır 44 → 52 — 45 karakterlik başlık artık geçer (sığmayı kapak_sigma ölçer); aşım 53+ karakterde.
    expect(vakalar.find((x) => x.ad === "uzun-covertitle")!.geriBildirim).toEqual([]);
    const v = vakalar.find((x) => x.ad === "uzun-covertitle-53")!;
    expect(v.geriBildirim[0]).toBe("- uzunluk: coverTitle 54 karakter (7 kelime); sınır 52 karakter. En çok 5 kelime yaz → en az 2 kelime çıkar.");
  });
  it("27.11: tüp bebek (in vitro fertilization) klinik öncesi sayılmaz; aynı kaynakta hücre geçerse sayılır", () => {
    const temkin = (ad: string) => vakalar.find((x) => x.ad === ad)!.beklenen.find(([a]) => a === "temkin")![1];
    expect(temkin("ivf-klinik-oncesi-degil")).toBe(true);
    expect(temkin("ivf-ve-hucre")).toBe(false);
  });
  it("27.11: yasak sözcük geri bildirimi alanı ve tırnaklı adı söyler", () => {
    const v = vakalar.find((x) => x.ad === "yasak-hekim-tirnak")!;
    expect(v.geriBildirim[0]).toContain("(geçtiği alan: detailSummary)");
    expect(v.geriBildirim[0]).toContain("tırnak içindeki özgün başlık");
    expect(v.geriBildirim[0]).toContain('"hekim" yerine "doktor" yaz');
  });
  it("onaylı 14 Kasım metinleri kapılardan geçer", () => {
    for (const v of vakalar.filter((x) => x.ad.startsWith("ornek-"))) expect(passed(check(v.taslak, v.item, v.src)), v.ad).toBe(true);
  });
});

describe("yardımcılar", () => {
  it("Türkçe katlama: İ→i, I→ı", () => {
    expect(fold("İNSANLARDA HEKİM IŞIK")).toBe("insanlarda hekim ışık");
  });
  it("uzunluk kod noktasıyla (Python len)", () => {
    expect(cpLen("a🤖b")).toBe(3);
    expect("a🤖b".length).toBe(4);
  });
});
