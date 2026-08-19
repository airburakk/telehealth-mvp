// Kaynaklar arası kongre eşleştirme sözleşmesi (v6.121) — `scripts/congress-cross-source.ts`.
//
// NEDEN VAR: bu fonksiyonun yanlış "evet"i SESSİZ VERİ KAYBIDIR. `merge-congress-sources.ts`
// eşleşen TTB satırını SİLER, `ttbCode`'u kalan satıra çipa olarak yazar ve o satırdaki
// `CongressFollow` kayıtlarını taşır. Yanlış eşleşme → hekimin takip ettiği kongre başka bir
// kongreye bağlanır ve gerçek bir etkinlik kaydı yok olur. Hiçbir derleme/çalışma hatası vermez.
// (`congress-match.test.ts` ile aynı gerekçe — o modülün sözleşmesi de böyle kilitli.)
//
// 🪤 Aşağıdaki "eşleşmemeli" vakaları UYDURMA DEĞİL: 2026-08-19'da dev veritabanında
// (172 küratörlü × 75 TTB) düz benzerlik ölçütleriyle GERÇEKTEN üretilmiş yanlış eşleşmelerdir.
// "Ulusal … Kongresi" bir ŞABLONDUR, sinyal değil — bu çiftler düz Jaccard'da 0.50, trigram
// Dice'ta 0.84 alıyordu (Dice şablonu ÖDÜLLENDİRİR) ama farklı kongrelerdir. Regresyon koruması.
import { describe, it, expect } from "vitest";
import { caprazAdayBul, yapisalAnahtar, normSehir } from "../../scripts/congress-cross-source";

type Satir = {
  id: string; title: string; city: string | null; startDate: Date; endDate: Date | null;
};
const sat = (id: string, title: string, bas: string, son?: string | null, city: string | null = null): Satir => ({
  id, title, city,
  startDate: new Date(`${bas}T00:00:00Z`),
  endDate: son ? new Date(`${son}T00:00:00Z`) : null,
});

// ── Dev veritabanından alınan gerçek satırlar ───────────────────────────────
const KURATORLU: Satir[] = [
  sat("k1", "29. Türk Toraks Derneği Yıllık Kongresi", "2026-04-08", "2026-04-12", "Antalya"),
  sat("k2", "5. Ulusal Kalp Yetersizliği Toplantısı", "2026-09-11", "2026-09-13", "İstanbul"),
  sat("k3", "42. Ulusal Kardiyoloji Kongresi", "2026-10-30", "2026-11-03", "Antalya"),
  sat("k4", "35. Ulusal Patoloji Kongresi", "2026-10-28", "2026-10-31", "İstanbul"),
  sat("k5", "33. Ulusal Uygulamalı Girişimsel Kardiyoloji Kongresi", "2026-04-09", "2026-04-12", "Antalya"),
  // eşi OLMAYAN küratörlü satırlar (çeldiriciler)
  sat("k6", "52. Ulusal Hematoloji Kongresi", "2026-11-03", null, "Antalya"),
  sat("k7", "26. Ulusal Romatoloji Kongresi", "2026-11-25", null, "Antalya"),
  sat("k8", "34. Ulusal Dermatoloji Kongresi", "2026-10-21", null, "Antalya"),
  sat("k9", "35. Ulusal Üroloji Kongresi", "2026-10-22", null, "Kuzey Kıbrıs (KKTC)"),
  sat("k10", "VIII. Moleküler Patoloji Günü", "2026-12-05", null, null),
  sat("k11", "23. Ulusal Hipertansiyon ve Kardiyovasküler Hastalıklar Kongresi", "2026-04-16", null, "Yeni İskele"),
];
const TTB: Satir[] = [
  sat("t1", "Türk Toraks Derneği 29. Yıllık Kongresi", "2026-04-08", "2026-04-12", "Antalya"),
  sat("t2", "5. Ulusal Kalp Yetersizliği Toplantısı", "2026-09-11", "2026-09-13", "İstanbul"),
  sat("t3", "42. Ulusal Kardiyoloji Kongresi", "2026-10-30", "2026-11-03", "Antalya"),
  sat("t4", "35. Ulusal Patoloji Kongresi", "2026-10-28", "2026-10-31", "İstanbul"),
  sat("t5", "33. Ulusal Uygulamalı Girişimsel Kardiyoloji Toplantısı", "2026-04-09", "2026-04-12", "Antalya"),
  // eşi OLMAYAN TTB satırları (çeldiriciler)
  sat("t6", "Türk Nöroşirürji Derneği 39. Bilimsel Kongresi", "2026-04-09", null, "Antalya"),
  sat("t7", "8. Pulmoner Vasküler Hastalıklar Kongresi", "2026-05-21", null, "İstanbul"),
  sat("t8", "Koruyucu Kardiyoloji ve Hipertansiyon Toplantısı; Kardiyobahar Güncelleme", "2026-10-01", null, "KKTC"),
];

const bul = (ttbId: string) => caprazAdayBul(TTB.find((t) => t.id === ttbId)!, KURATORLU, TTB);

describe("caprazAdayBul — gerçek kaynaklar arası çiftler bulunmalı", () => {
  const beklenen: [string, string, string][] = [
    ["t1", "k1", "sözcük sırası farklı: '29. Türk Toraks…' ↔ 'Türk Toraks… 29.'"],
    ["t2", "k2", "birebir aynı ad"],
    ["t3", "k3", "birebir aynı ad"],
    ["t4", "k4", "birebir aynı ad"],
    ["t5", "k5", "yalnız son sözcük farklı: 'Kongresi' ↔ 'Toplantısı'"],
  ];
  for (const [ttbId, kurId, not] of beklenen) {
    it(`${ttbId} → ${kurId} (${not})`, () => {
      const a = bul(ttbId);
      expect(a, "aday bulunamadı").not.toBeNull();
      expect(a!.sol.id).toBe(kurId);
      // Gerçek çiftlerde doğrulayıcı sinyaller TEMİZ olmalı — ölçümde 5/5 böyleydi.
      expect(a!.gunFark).toBe(0);
      expect(a!.sehirCelisiyor).toBe(false);
      expect(a!.bitisCelisiyor).toBe(false);
    });
  }
});

describe("caprazAdayBul — eşi olmayan TTB satırları eşleşmemeli", () => {
  // 🪤 t8 ("Koruyucu Kardiyoloji…") düz benzerlikte "42. Ulusal Kardiyoloji Kongresi"ne,
  //    t7 ("Pulmoner Vasküler…") "23. Ulusal Hipertansiyon…"a yakın çıkıyordu.
  for (const ttbId of ["t6", "t7", "t8"]) {
    it(`${ttbId} için aday üretilmemeli`, () => {
      expect(bul(ttbId)).toBeNull();
    });
  }
});

describe("caprazAdayBul — 'Ulusal X Kongresi' şablonu eşleşme üretmemeli", () => {
  // Patoloji kongresi havuzda VARKEN bile, benzer şablonlu küratörlü satırlar onu çalmamalı:
  // t4 doğru satıra (k4) gitmeli — "VIII. Moleküler Patoloji Günü" (k10) DEĞİL.
  it("35. Ulusal Patoloji Kongresi → Moleküler Patoloji Günü'ne KAYMAZ", () => {
    const a = bul("t4");
    expect(a!.sol.id).toBe("k4");
    expect(a!.sol.id).not.toBe("k10");
  });
});

describe("caprazAdayBul — karşılıklı-en-iyi şartı", () => {
  it("iki TTB satırı aynı küratörlü satırı hedeflerse en az biri elenir", () => {
    // Aynı adın iki TTB kaydı: yalnız biri karşılıklı-en-iyi olabilir.
    const ikiz: Satir[] = [
      sat("x1", "42. Ulusal Kardiyoloji Kongresi", "2026-10-30", null, "Antalya"),
      sat("x2", "42. Ulusal Kardiyoloji Kongresi", "2026-10-30", null, "Antalya"),
    ];
    const sonuc = ikiz.map((t) => caprazAdayBul(t, [KURATORLU[2]], ikiz));
    // Yapısal yol ikisini de aynı satıra bağlar; script tarafı "daha güçlü aday var" diyerek
    // birini İNCELE'ye düşürür. Burada önemli olan: ikisi de AYNI satırı göstermeli.
    expect(sonuc[0]!.sol.id).toBe("k3");
    expect(sonuc[1]!.sol.id).toBe("k3");
  });
});

describe("yardımcılar", () => {
  it("yapısalAnahtar yıl ve sondaki parantezli eki düşürür", () => {
    expect(yapisalAnahtar("35. Ulusal Patoloji Kongresi 2026"))
      .toBe(yapisalAnahtar("35. Ulusal Patoloji Kongresi"));
    expect(yapisalAnahtar("X. Türk Romatoloji Kongresi (TURKROM)"))
      .toBe(yapisalAnahtar("X. Türk Romatoloji Kongresi"));
  });

  it("normSehir parantezli eki atar, Türkçe harfleri katlar", () => {
    expect(normSehir("Kuzey Kıbrıs (KKTC)")).toBe("kuzeykibris");
    expect(normSehir("İstanbul")).toBe("istanbul");
    expect(normSehir(null)).toBe("");
  });

  it("şehir sinyali biri boşken ÇELİŞKİ saymaz (kapı değil, doğrulayıcı)", () => {
    const ttb = sat("z1", "35. Ulusal Patoloji Kongresi", "2026-10-28", null, null);
    const a = caprazAdayBul(ttb, [KURATORLU[3]], [ttb]);
    expect(a!.sehirCelisiyor).toBe(false);
  });
});
