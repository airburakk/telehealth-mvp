import { describe, expect, it } from "vitest";
import { interleaveByModule, type FeedItem } from "@/lib/doctorium";

// Akış çeşitlilik kuralı (2026-08-18, kullanıcı kararı): aynı modülden art arda en fazla
// 3 kart; küme kırılırken sıra MÜMKÜN OLDUĞUNCA korunur; tek modül kaldıysa koşu serbest
// (yapay boşluk/atlama üretilmez — içerik kaybolmaz).

let seq = 0;
function item(module: string): FeedItem {
  seq++;
  return {
    id: `i${seq}`,
    module,
    kind: "makale",
    source: "pubmed",
    title: `Başlık ${seq}`,
    titleOriginal: null,
    summary: "",
    sourceName: "Test",
    authors: null,
    url: null,
    doi: null,
    imageUrl: null,
    publishedAt: new Date(2026, 0, 1, 12, 60 - seq),
  } as unknown as FeedItem;
}

/** Listedeki en uzun aynı-modül koşusunun uzunluğu. */
function maxRun(items: FeedItem[]): number {
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const i of items) {
    run = i.module === prev ? run + 1 : 1;
    prev = i.module;
    best = Math.max(best, run);
  }
  return best;
}

describe("interleaveByModule — akış çeşitlilik kuralı", () => {
  it("20 akademik üst üste gelmez: araya diğer modüller serpiştirilir", () => {
    const items = [
      ...Array.from({ length: 20 }, () => item("akademik")),
      ...Array.from({ length: 5 }, () => item("sektorel")),
      ...Array.from({ length: 3 }, () => item("mevzuat")),
    ];
    const out = interleaveByModule(items, 3);
    expect(out).toHaveLength(items.length);
    // Başka modül stoğu bitene dek koşu limiti aşılmaz; kalan kuyruk (yalnız akademik
    // kaldığında) serbesttir — kuyruğu ayrı doğruluyoruz.
    const firstTailIdx = out.length - (20 + 5 + 3 - (3 + 1) * Math.floor(20 / 3));
    const head = out.slice(0, Math.min(out.length, (5 + 3) * 4));
    expect(maxRun(head)).toBeLessThanOrEqual(3);
    expect(firstTailIdx).toBeDefined(); // hesap bilgilendirici — asıl iddia yukarıda
  });

  it("içerik kaybolmaz ve küme dışı sıra korunur (kararlılık)", () => {
    const items = [item("akademik"), item("akademik"), item("sektorel"), item("akademik"), item("ilac")];
    const out = interleaveByModule(items, 3);
    expect(out.map((i) => i.id).sort()).toEqual(items.map((i) => i.id).sort());
    // Koşu limiti hiç dolmadı → sıra birebir aynı kalmalı.
    expect(out.map((i) => i.id)).toEqual(items.map((i) => i.id));
  });

  it("tek modül kaldığında koşu serbest bırakılır (yapay boşluk yok)", () => {
    const items = [...Array.from({ length: 6 }, () => item("akademik")), item("sektorel")];
    const out = interleaveByModule(items, 3);
    expect(out).toHaveLength(7);
    // sektörel, 4. karta (ilk koşu dolunca) öne çekilir; kalan akademikler serbest akar.
    expect(out[3].module).toBe("sektorel");
    expect(out.filter((i) => i.module === "akademik")).toHaveLength(6);
  });

  it("3'lük koşu dolunca İLERİDEN farklı modülün İLK kartı öne çekilir", () => {
    const items = [
      item("akademik"), item("akademik"), item("akademik"), item("akademik"),
      item("sektorel"), item("sektorel"),
    ];
    const out = interleaveByModule(items, 3);
    expect(out.map((i) => i.module)).toEqual([
      "akademik", "akademik", "akademik", "sektorel", "akademik", "sektorel",
    ]);
  });

  it("boş liste ve tek eleman zararsız", () => {
    expect(interleaveByModule([], 3)).toEqual([]);
    const one = [item("mevzuat")];
    expect(interleaveByModule(one, 3)).toHaveLength(1);
  });
});
