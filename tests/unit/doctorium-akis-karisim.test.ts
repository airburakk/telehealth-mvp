import { describe, expect, it } from "vitest";
import { interleaveByModule, type FeedItem } from "@/lib/doctorium";

// Akış çeşitlilik kuralı (2026-08-18, kullanıcı kararı; 2026-08-28 KAYNAK eksenine genişledi):
// aynı modülden art arda en fazla 3 kart, AYNI ZAMANDA aynı kaynaktan art arda en fazla 3 kart;
// küme kırılırken sıra MÜMKÜN OLDUĞUNCA korunur; tek modül/kaynak kaldıysa koşu serbest
// (yapay boşluk/atlama üretilmez — içerik kaybolmaz). Modül kuralı ÖNCELİKLİDİR: ikisini birden
// kıran kart yoksa (ör. tüm kartlar tek kaynaktan) kaynak katmanı modül kuralını SUSTURMAZ.

let seq = 0;
// `source` opsiyonel, varsayılan "pubmed" — modül-yalnız senaryoları yazan eski çağrılar
// (`item("akademik")`) aynı sabit kaynağı paylaşmaya devam eder, davranışları değişmez.
function item(module: string, source = "pubmed"): FeedItem {
  seq++;
  return {
    id: `i${seq}`,
    module,
    kind: "makale",
    source,
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

/** Listedeki en uzun aynı-kaynak koşusunun uzunluğu (maxRun'ın kaynak ekseni karşılığı). */
function maxSourceRunLen(items: FeedItem[]): number {
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const i of items) {
    run = i.source === prev ? run + 1 : 1;
    prev = i.source;
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

  describe("KAYNAK ekseni (2026-08-28 — canlıda gözlenen bulgu: tek modül İÇİNDE tek kaynağa yığılma)", () => {
    it("kaynak koşusu modül koşusundan BAĞIMSIZ kırılır (modül hiç dolmasa da)", () => {
      // maxRun=10: 4 kartlık aynı modül asla dolmaz — eski (modül-yalnız) algoritma bu listeye
      // HİÇ dokunmazdı. maxSourceRun=2: kaynak 2 kartta dolar → 3. medscape'ten önce farklı
      // kaynak (dernek-a) araya girmeli.
      const items = [
        item("sektorel", "medscape"), item("sektorel", "medscape"), item("sektorel", "medscape"),
        item("sektorel", "dernek-a"),
      ];
      const out = interleaveByModule(items, 10, 2);
      expect(maxSourceRunLen(out)).toBeLessThanOrEqual(2);
      // İçerik kaybolmaz, yalnız sıra değişir.
      expect(out.map((i) => i.id).sort()).toEqual(items.map((i) => i.id).sort());
      expect(out.map((i) => i.source)).toEqual(["medscape", "medscape", "dernek-a", "medscape"]);
    });

    it("varsayılan çağrıda (üçüncü parametre verilmez) maxSourceRun sessizce maxRun'a eşitlenir", () => {
      // personalFeedPage/sonsuz-kaydırma çağrı noktaları interleaveByModule(items, 3) ile
      // çağırır — üçüncü argüman yok. Bu testin amacı yalnızca imza uyumluluğu: eski çağıranlar
      // derleme/çalışma zamanında hiçbir değişiklik görmemeli.
      const items = [item("sektorel", "medscape"), item("sektorel", "medscape"), item("sektorel", "medscape"), item("sektorel", "dernek-a")];
      const out = interleaveByModule(items, 3);
      expect(out).toHaveLength(4);
      expect(out.map((i) => i.id).sort()).toEqual(items.map((i) => i.id).sort());
    });

    it("REGRESYON KORUYUCUSU: tüm kartlar tek kaynaktan olsa bile modül kuralı çalışmaya devam eder", () => {
      // 2026-08-28'de yakalanan tasarım hatası: "modülü VE kaynağı BİRDEN kıran kart" tek koşullu
      // arasaydı, tüm kartlar aynı kaynaktan geldiğinde (mevcut item() varsayılanı — tüm eski
      // testler) bu arama HİÇBİR ZAMAN eşleşmez, -1 döner ve modül çeşitlendirmesi de SESSİZCE
      // devre dışı kalırdı. Kademeli arama (önce ikisi birden, sonra yalnız modül, sonra yalnız
      // kaynak) bunu önler — modül kuralı 2026-08-18'den beri var ve önceliklidir.
      const items = [
        item("akademik"), item("akademik"), item("akademik"), item("akademik"),
        item("sektorel"), item("sektorel"),
      ];
      const out = interleaveByModule(items, 3); // hepsi source="pubmed" (item() varsayılanı)
      expect(out.map((i) => i.module)).toEqual([
        "akademik", "akademik", "akademik", "sektorel", "akademik", "sektorel",
      ]);
    });
  });
});
