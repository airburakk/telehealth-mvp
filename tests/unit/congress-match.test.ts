// Kongre adı eşleştirme sözleşmesi (v6.119) — `scripts/congress-match.ts`.
//
// NEDEN VAR: bu fonksiyonun yanlış "evet"i SESSİZ VERİ KAYBIDIR. İki araç onu kullanıyor —
// `merge-congress-research.ts` (yeniden adlandırma tespiti: yanlış eşleşme, alakasız bir kongrenin
// satırını EZER) ve `prune-congress-orphans.ts` (yetim → halef: yanlış eşleşme, doktorun takibini
// YANLIŞ kongreye taşır ve doğru satırı SİLER). Hiçbiri derleme/çalışma hatası vermez.
//
// 🪤 İlk uygulama `length > 3` ile belirteç süzüyordu ve kongre adlarının en ayırt edici
// parçasını (ERA · EHA · ACS · AUA · TOD — hepsi 3 harf) atıyordu. Geriye jenerik "congress"
// kalınca payda 1 olup benzerlik %100 çıkıyordu. Aşağıdaki "eşleşmemeli" vakaları bu turda
// GERÇEKTEN üretilmiş yanlış eşleşmelerdir — regresyon koruması olarak duruyorlar.
import { describe, it, expect } from "vitest";
import { nameSimilarity, stripYear, bestMatch, BENZERLIK_ESIGI } from "../../scripts/congress-match";

const esles = (a: string, b: string) => nameSimilarity(a, b) >= BENZERLIK_ESIGI;

describe("nameSimilarity — yanlış eşleşmeler (v6.119'da gerçekten üretildiler)", () => {
  const yanlisCiftler: [string, string][] = [
    ["ACS Clinical Congress (American College of Surgeons)", "EHA Congress"],
    ["64. ERA Congress (European Renal Association)", "EHA Congress"],
    ["122. AUA Annual Meeting (American Urological Association)", "AAD Annual Meeting"],
    ["23. Ulusal Hipertansiyon ve Kardiyovasküler Hastalıklar Kongresi", "60. TOD Ulusal Kongresi"],
    ["16. ESPRAS Quadrennial Congress (Joint Meeting ESPRAS & Swiss Plastic Surgery)", "EHA Congress"],
    ["ECE (European Congress of Endocrinology)", "EHA Congress"],
  ];
  for (const [a, b] of yanlisCiftler) {
    it(`"${a.slice(0, 40)}" ≠ "${b}"`, () => {
      expect(esles(a, b), `${a} ↔ ${b}`).toBe(false);
    });
  }
});

describe("nameSimilarity — gerçek halefler eşleşmeli", () => {
  const dogruCiftler: [string, string][] = [
    ["64. ERA Congress (European Renal Association)", "ERA Congress"],
    ["122. AUA Annual Meeting (American Urological Association)", "AUA Annual Meeting"],
    ["ACS Clinical Congress (American College of Surgeons)", "ACS Clinical Congress 2026"],
    ["ECE (European Congress of Endocrinology)", "European Congress of Endocrinology (ECE)"],
    ["AAOS Annual Meeting", "AAOS Annual Meeting 2027"],
    ["ACR Convergence (American College of Rheumatology)", "ACR Convergence"],
    ["EASD Annual Meeting (European Association for the Study of Diabetes)", "EASD Annual Meeting"],
    [
      "23. Ulusal Hipertansiyon ve Kardiyovasküler Hastalıklar Kongresi",
      "Ulusal Hipertansiyon ve Kardiyovasküler Hastalıklara Bütüncül Yaklaşımlar Kongresi",
    ],
    [
      "16. ESPRAS Quadrennial Congress (Joint Meeting ESPRAS & Swiss Plastic Surgery)",
      "ESPRAS Congress (Joint Meeting ESPRAS & Swiss Plastic Surgery)",
    ],
    ["Uluslararası Katılımlı Türk Romatoloji Kongresi", "Uluslararası Katılımlı Türk Romatoloji Kongresi (TURKROM)"],
  ];
  for (const [a, b] of dogruCiftler) {
    it(`"${a.slice(0, 40)}" ≈ "${b.slice(0, 40)}"`, () => {
      expect(esles(a, b), `${a} ↔ ${b}`).toBe(true);
    });
  }
});

describe("kenar durumlar", () => {
  it("tamamı jenerik olan ad ASLA eşleşmez (uydurma halef üretilmesin)", () => {
    // Her iki tarafta da ayırt edici belirteç yok → eşleşme uydurulamaz.
    expect(nameSimilarity("Ulusal Kongre", "Uluslararası Kongre")).toBe(0);
    expect(nameSimilarity("Annual Meeting", "Annual Congress")).toBe(0);
  });

  it("kısa kısaltmalar KORUNUR — ayırt ediciliğin taşıyıcısı onlar", () => {
    expect(esles("TOD Ulusal Kongresi", "TOD Ulusal Kongresi 2026")).toBe(true);
    expect(esles("TOD Ulusal Kongresi", "TND Ulusal Kongresi")).toBe(false);
  });

  it("edisyon numarası eşleşmeyi etkilemez", () => {
    expect(esles("42. Ulusal Kardiyoloji Kongresi", "43. Ulusal Kardiyoloji Kongresi")).toBe(true);
  });

  it("stripYear yalnız 4 haneli yıl belirtecini düşürür", () => {
    expect(stripYear("AAOS Annual Meeting 2027")).toBe("AAOS Annual Meeting");
    expect(stripYear("MSToronto2026")).toBe("MSToronto2026"); // sözcük sınırı yok → dokunulmaz
    expect(stripYear("ACC.27")).toBe("ACC.27");
  });

  it("simetriktir", () => {
    const a = "64. ERA Congress (European Renal Association)", b = "ERA Congress";
    expect(nameSimilarity(a, b)).toBe(nameSimilarity(b, a));
  });
});

// ── bestMatch: IDF ağırlıklı havuz eşleştirmesi ────────────────────────────────────────────
// 🪤 v6.119'da GERÇEK VERİ KAYBINA yol açan hata: pairwise benzerlik, havuzun her adında geçen
// belirteci (romatoloji branşında "romatoloji") ayırt edici sanıyordu. "…(TURKROM)" satırı
// yeniden adlandırma ararken %100 berabere kalıp YANLIŞ satırı yuttu ve
// "Ulusal Romatoloji Kongresi" kaynaktan SİLİNDİ.
describe("bestMatch — IDF ağırlığı yanlış eşleşmeyi keser", () => {
  const romatolojiHavuzu = [
    "Ulusal Romatoloji Kongresi",
    "3. TRASD Antalya Romatoloji Sempozyumu",
    "Ankara Romatoloji Vaskülit Çalıştayı ve Yıl Sonu Buluşması",
    "Romatoloji Görüntüleme Sempozyumu",
    "EULAR Congress (European Congress of Rheumatology)",
    "ACR Convergence",
  ];

  it("'romatoloji' havuzun her adında geçtiği için eşleşme ÜRETMEZ", () => {
    // "Ulusal Romatoloji Kongresi"nin tek ayırt edici belirteci "romatoloji" — havuzda
    // yaygın olduğu için ağırlığı ~0; hiçbir adayla eşiği aşmamalı.
    const m = bestMatch("Ulusal Romatoloji Kongresi", romatolojiHavuzu.filter((x) => x !== "Ulusal Romatoloji Kongresi"), (x) => x);
    expect((m?.score ?? 0) >= BENZERLIK_ESIGI, `yanlış halef: ${m?.item}`).toBe(false);
  });

  it("TURKROM, 'Ulusal Romatoloji Kongresi'ni YUTMAZ", () => {
    const m = bestMatch("Uluslararası Katılımlı Türk Romatoloji Kongresi (TURKROM)", romatolojiHavuzu, (x) => x);
    expect(m?.item).not.toBe("Ulusal Romatoloji Kongresi");
  });

  it("nadir kısaltma hâlâ eşleşir (ERA · AUA · ACS)", () => {
    const havuz = ["ERA Congress", "EHA Congress", "AUA Annual Meeting", "AAD Annual Meeting", "ACS Clinical Congress 2026"];
    for (const [hedef, beklenen] of [
      ["64. ERA Congress (European Renal Association)", "ERA Congress"],
      ["122. AUA Annual Meeting (American Urological Association)", "AUA Annual Meeting"],
      ["ACS Clinical Congress (American College of Surgeons)", "ACS Clinical Congress 2026"],
    ] as [string, string][]) {
      const m = bestMatch(hedef, havuz, (x) => x);
      expect(m?.item, hedef).toBe(beklenen);
      expect((m?.score ?? 0) >= BENZERLIK_ESIGI, hedef).toBe(true);
    }
  });

  it("boş havuzda null döner", () => {
    expect(bestMatch("ERA Congress", [], (x: string) => x)).toBeNull();
  });
});

// ── Silme eşiği (prune-congress-orphans.ts SILME_ESIGI = 0.8) ─────────────────────────────
// Silme, yeniden adlandırmadan daha tehlikelidir: yanlış ad geri alınabilir, yanlış SİLME
// gerçek kaydı ve doktorun takibini yok eder. Bu yüzden iki eşik AYRIDIR.
describe("silme eşiği — yeniden adlandırmadan katı", () => {
  const SILME_ESIGI = 0.8; // prune-congress-orphans.ts ile aynı değer

  it("ESPRAS ≠ ASPS: 0.6'yı geçer ama 0.8'i GEÇEMEZ (2026-08-19 prod dry-run vakası)", () => {
    // Ortak belirteçler yalnız "plastic + surgery" — ikisi de plastik cerrahi havuzunda jenerik.
    // Gerçek halef ("ESPRAS Congress …") prod'a henüz seed edilmediği için havuzda yoktu.
    const havuz = ["Plastic Surgery The Meeting (ASPS)", "ISAPS Olympiad World Congress", "TPRECD Ulusal Kurultayı"];
    const m = bestMatch("16. ESPRAS Quadrennial Congress (Joint Meeting ESPRAS & Swiss Plastic Surgery)", havuz, (x) => x);
    expect((m?.score ?? 0) >= SILME_ESIGI, `silinecekti: ${m?.item} (%${Math.round((m?.score ?? 0) * 100)})`).toBe(false);
  });

  it("gerçek halef havuzdayken silme eşiğini RAHAT geçer", () => {
    const havuz = [
      "ESPRAS Congress (Joint Meeting ESPRAS & Swiss Plastic Surgery)",
      "Plastic Surgery The Meeting (ASPS)",
      "ISAPS Olympiad World Congress",
    ];
    const m = bestMatch("16. ESPRAS Quadrennial Congress (Joint Meeting ESPRAS & Swiss Plastic Surgery)", havuz, (x) => x);
    expect(m?.item).toBe("ESPRAS Congress (Joint Meeting ESPRAS & Swiss Plastic Surgery)");
    expect((m?.score ?? 0) >= SILME_ESIGI).toBe(true);
  });
});
