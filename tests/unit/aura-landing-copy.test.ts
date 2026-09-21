// aura-landing/copy — 9 dil landing sözlüğü bütünlüğü (v5.9.1, 2026-07-12; bg 2026-07-23).
// Emekli landing-copy.test.ts'in yerini alır (eski landing ölü kodla birlikte silindi);
// aynı yapısal-asimetri korumasını CANLI aura landing sözlüğüne uygular: yeni dil eklenirken/
// metin değişirken eksik çeviri veya dizi-boyu kayması (chapters/hiw adımları) derlemede değil
// burada yakalanır. air_lang dil-adı↔kod köprüsü de korunur (landing↔hasta yüzeyi dil taşıması).
import { describe, it, expect } from "vitest";
import { COPY, LANGS, LANG_CODES, langDir, type Lang } from "@/lib/aura-landing/copy";
import { LANGUAGES, LANG_NAME_BY_CODE, langCodeFor } from "@/lib/constants";

// İç içe anahtar kümesini düzleştir (dizilerde uzunluk da imzaya girer).
function shape(o: unknown, prefix = ""): string[] {
  if (Array.isArray(o)) return [`${prefix}[${o.length}]`, ...o.flatMap((v, i) => shape(v, `${prefix}[${i}]`))];
  if (o && typeof o === "object") {
    return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => shape(v, prefix ? `${prefix}.${k}` : k));
  }
  return [`${prefix}:${typeof o}`];
}

describe("aura-landing/copy", () => {
  it("9 locale tanımlı ve COPY ile birebir örtüşür", () => {
    expect(LANG_CODES).toEqual(["en", "tr", "de", "fr", "ru", "ar", "fa", "az", "bg"]);
    expect(Object.keys(COPY).sort()).toEqual([...LANG_CODES].sort());
  });

  it("tüm locale'lerin yapı imzası EN ile birebir aynı (eksik/fazla anahtar veya dizi boyu yok)", () => {
    // EN birincil (landing EN-first): referans yapı imzası.
    const ref = shape(COPY.en).sort();
    for (const code of LANG_CODES) {
      expect(shape(COPY[code]).sort(), `locale=${code}`).toEqual(ref);
    }
  });

  // NOT: "hiçbir metin boş değil" kontrolü BİLİNÇLİ olarak yok — aura landing sözlüğü
  // dile-özgü söz dizimi için çok sayıda kasıtlı-boş parça içerir (hero prefix/suffix,
  // letterform wordBefore/wordAfter/lineAfter, chapter cümle parçaları). Boş-string bir
  // yapısal bütünlük ihlali değil; kasıtlı vs. unutulmuş boş ayırt edilemez → yanlış-pozitif.
  // Gerçek koruma yapı-imzası simetrisidir (eksik/fazla anahtar + dizi boyu).

  it("langDir: ar/fa → rtl, diğerleri ltr", () => {
    const rtl: Lang[] = ["ar", "fa"];
    for (const code of LANG_CODES) {
      expect(langDir(code)).toBe(rtl.includes(code) ? "rtl" : "ltr");
    }
  });

  it("landing kopyasında 'Pro Bono' geçmez (yeni ad: Ücretsiz Sağlık Hizmeti)", () => {
    expect(JSON.stringify(COPY)).not.toMatch(/pro\s*bono/i);
  });

  // V03 (kontrol raporu 2026-09-17, v6.280): güven sayfası vaatleri = kod kanıtı. Doktor doğrulaması yalnız DİPLOMA'yı
  // (e-Devlet, REQUIRED_DOC_TYPES) zorunlu anlatır — uzmanlık belgesi/MMSS ihtiyari; "üç rıza" sabit sayısı yok
  // (REVOCABLE_SCOPES: AI ön değerlendirme · AI tercüme · sağlık beyanı + genel KVKK); KVKK başvurusu platform içi
  // forma bağlanır (reportCta → /kvkk-basvuru). 9 dilde yapısal kilit + TR/EN içerik kilidi.
  it("güven sayfası V03: 9 dilde doktor kartı e-Devlet'i anar, reportCta dolu; TR/EN'de eski iddialar yok", () => {
    for (const code of LANG_CODES) {
      const t = COPY[code].trustPage;
      const doctors = t.sections.find((s) => s.key === "doctors");
      const report = t.sections.find((s) => s.key === "report");
      expect(doctors?.body, `locale=${code}`).toMatch(/e-Devlet/);
      expect(report?.note.text.length ?? 0, `locale=${code}`).toBeGreaterThan(20);
      expect(t.reportCta.length, `locale=${code}`).toBeGreaterThan(3);
    }
    const tr = COPY.tr.trustPage.sections;
    const en = COPY.en.trustPage.sections;
    const by = (list: typeof tr, key: string) => list.find((s) => s.key === key)!;
    expect(by(tr, "doctors").body).toMatch(/ihtiyari/);
    expect(by(tr, "doctors").body).not.toMatch(/mesleki belgelerini yükler/);
    expect(by(tr, "consent").body).not.toMatch(/Üç ayrı rıza/);
    expect(by(tr, "consent").body).toMatch(/sağlık beyanı/);
    expect(tr.find((s) => s.n === "01")!.body).toMatch(/ABD'deki sağlayıcılara/);
    expect(by(tr, "report").body).toMatch(/30 gün/);
    expect(by(tr, "report").note.label).not.toMatch(/Taslak/);
    expect(by(en, "consent").body).not.toMatch(/Three separate consents/);
    expect(by(en, "doctors").body).toMatch(/optionally/);
    expect(by(en, "report").note.label).not.toMatch(/Draft/);
  });
});

// Tek dil anahtarı köprüsü — `air_lang` dil ADI tutar; landing/public sayfalar kod-bazlıdır.
// Eşleme kopuk olursa landing↔hasta yüzeyleri dil taşıması sessizce bozulur.
describe("dil kodu ↔ dil adı köprüsü (air_lang birleştirmesi)", () => {
  it("LANG_NAME_BY_CODE tüm LANGUAGES adlarını birebir kapsar", () => {
    expect(Object.values(LANG_NAME_BY_CODE).sort()).toEqual([...LANGUAGES].sort());
  });

  it("her landing locale kodu geçerli bir dil adına eşlenir ve gidiş-dönüş tutarlıdır", () => {
    for (const { code } of LANGS) {
      const name = LANG_NAME_BY_CODE[code];
      expect(name, `code=${code}`).toBeTruthy();
      expect(LANGUAGES, `code=${code}`).toContain(name);
      expect(langCodeFor(name), `name=${name}`).toBe(code);
    }
  });

  it("langCodeFor: bilinmeyen/boş ad → undefined (air_lang ezilmez, görüntü fallback)", () => {
    expect(langCodeFor("Klingonca")).toBeUndefined();
    expect(langCodeFor(null)).toBeUndefined();
    expect(langCodeFor(undefined)).toBeUndefined();
    expect(langCodeFor("")).toBeUndefined();
  });
});

// V06 (v6.291): TR vitrin mikro metin kilitleri — anglisizm/jargon geri gelmesin (👤 onaylı tablo 2026-09-21).
describe("V06 TR mikro metin (v6.291)", () => {
  it("TR sözlükte 'ekle-only', 'Yargınız sizde kalsın', 'FHIR konuşan' geçmez; 'Klinik karar sizde.' vardır", () => {
    const tr = JSON.stringify(COPY.tr);
    for (const yasak of ["ekle-only", "Yargınız sizde kalsın", "FHIR konuşan"]) expect(tr).not.toContain(yasak);
    expect(tr).toContain("Klinik karar sizde.");
  });
});

// V04 (v6.294): how-it-works rehberlerinde ücret/demo sınırları hizmet bazında — 9 dilde yer tutucu ZORUNLU, literal tutar YASAK
// (tutar tek kaynaktan dolar: lib/aura-landing/fees.ts). Adım dizini: consult[1] ödeme · so[1] başvuru/paket · tourism[3] teklif · freecare[1] başvuru.
describe("V04 rehber ücret yer tutucuları (v6.294)", () => {
  type Guide = { key: string; steps: { t: string; d: string }[] };
  const guidesOf = (code: string) => (COPY as unknown as Record<string, { hiw: { guides: Guide[] } }>)[code].hiw.guides;
  const step = (code: string, key: string, i: number) => guidesOf(code).find((g) => g.key === key)!.steps[i].d;
  it("her dilde consult[1] {consultFee}, so[1] {soFee} içerir; tourism[3] ve freecare[1] ödeme cümlesi taşır", () => {
    for (const code of LANG_CODES) {
      expect(step(code, "consult", 1), code).toContain("{consultFee}");
      expect(step(code, "so", 1), code).toContain("{soFee}");
      expect(step(code, "tourism", 3).length, code).toBeGreaterThan(60);
      expect(step(code, "freecare", 1).length, code).toBeGreaterThan(30);
    }
  });
  it("rehber metinlerinde literal tutar yok (60 USD / 600 USD) — tek kaynak fees.ts", () => {
    for (const code of LANG_CODES) {
      const j = JSON.stringify(guidesOf(code));
      expect(j, code).not.toMatch(/\b(60|600) USD/);
    }
  });
});

// V01 (v6.296, 👤 karar A): hero alt açıklaması hizmet bazlı, ana CTA hizmet seçimi (#care), demo rozeti 9 dilde.
describe("V01 hero A (v6.296)", () => {
  type Hero = { lede: string; ctaPrimary: string; ctaSecondary: string; demo: string; headline: string };
  const hero = (code: string) => (COPY as unknown as Record<string, { v2: { hero: Hero } }>)[code].v2.hero;
  it("TR/EN metinleri onaylı tabloya kilitli; başlık değişmedi", () => {
    expect(hero("tr").headline).toBe("Bakım, sınırların ötesinde.");
    expect(hero("en").headline).toBe("Care, without borders.");
    expect(hero("tr").ctaPrimary).toBe("Hizmet seçin");
    expect(hero("en").ctaPrimary).toBe("Choose a service");
    expect(hero("tr").lede).toContain("Uygunluk, kapsam ve ücret seçtiğiniz hizmete göre açıklanır.");
    expect(hero("en").lede).toContain("Eligibility, scope and fees are explained for the service you choose.");
  });
  it("her dilde demo rozeti var ve MVP ibaresi taşır", () => {
    for (const code of LANG_CODES) expect(hero(code).demo, code).toMatch(/MVP/);
  });
});

// Paket 6 (v6.299): hero hareket düğmesi + rehber Duraklat/Devam et etiketleri 9 dilde (yapı-imzası testi varlığı, bu test içeriği kilitler).
describe("Paket 6 video kontrol etiketleri (v6.299)", () => {
  type D = { v2: { hero: { motionPause: string; motionPlay: string } }; hiw: { pause: string; resume: string } };
  it("her dilde dört etiket dolu ve çiftler birbirinden farklı", () => {
    for (const code of LANG_CODES) {
      const d = (COPY as unknown as Record<string, D>)[code];
      for (const s of [d.v2.hero.motionPause, d.v2.hero.motionPlay, d.hiw.pause, d.hiw.resume]) expect(s.trim().length, code).toBeGreaterThan(1);
      expect(d.v2.hero.motionPause, code).not.toBe(d.v2.hero.motionPlay);
      expect(d.hiw.pause, code).not.toBe(d.hiw.resume);
    }
    expect((COPY as unknown as Record<string, D>).tr.v2.hero.motionPause).toBe("Hareketi durdur");
    expect((COPY as unknown as Record<string, D>).tr.hiw.resume).toBe("Devam et");
  });
});
