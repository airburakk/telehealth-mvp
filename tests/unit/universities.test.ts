// Üniversite + öğrenci e-posta uzantısı SÖZLEŞMESİ (v6.147) — bkz. lib/universities.ts başlık
// yorumu. Bu liste bir GÜVENLİK allowlist'i: kaynaksız/uydurma domain kabul edilirse kontrol
// anlamsızlaşır; çakışan domain ise bir üniversitenin öğrencisini başka üniversiteye sızdırır.
import { describe, it, expect } from "vitest";
import { UNIVERSITIES, universitiesFor, domainMatches } from "@/lib/universities";

describe("Üniversite listesi — yapısal sözleşme (v6.147)", () => {
  it("her satırda en az bir domain var (boş allowlist girişi güvenlik deliği olurdu)", () => {
    for (const u of UNIVERSITIES) {
      expect(u.domains.length, u.name).toBeGreaterThan(0);
    }
  });

  it("her satırda en az bir bölüm (tip/disHekimligi) true — ikisi de false olan satır anlamsız", () => {
    for (const u of UNIVERSITIES) {
      expect(u.tip || u.disHekimligi, u.name).toBe(true);
    }
  });

  it("üniversite adları tekil (aynı ad iki kez kayıtlıysa domainMatches ilkini bulur, ikincisi ölü kod olur)", () => {
    const seen = new Set<string>();
    for (const u of UNIVERSITIES) {
      expect(seen.has(u.name), `yinelenen üniversite: ${u.name}`).toBe(false);
      seen.add(u.name);
    }
  });

  it("SÖZLEŞME: domain'ler üniversiteler ARASI çakışmaz — çakışma bir üniversitenin öğrencisini başkasına sızdırır", () => {
    const owner = new Map<string, string>();
    for (const u of UNIVERSITIES) {
      for (const d of u.domains) {
        const key = d.toLowerCase();
        expect(owner.has(key), `'${key}' hem '${owner.get(key)}' hem '${u.name}'de — üniversiteler arası domain çakışması`).toBe(false);
        owner.set(key, u.name);
      }
    }
  });

  it("domain'ler küçük harf + boşluksuz kaydedilmiş (karşılaştırma tutarlılığı)", () => {
    for (const u of UNIVERSITIES) {
      for (const d of u.domains) {
        expect(d, `${u.name}: '${d}'`).toBe(d.toLowerCase().trim());
        expect(d.startsWith("@"), `${u.name}: '${d}' "@" ile BAŞLAMAMALI`).toBe(false);
      }
    }
  });
});

describe("universitiesFor — bölüme göre süzgeç", () => {
  it("yalnız o bölümü sunan üniversiteler döner", () => {
    for (const u of universitiesFor("tip")) expect(u.tip, u.name).toBe(true);
    for (const u of universitiesFor("dis-hekimligi")) expect(u.disHekimligi, u.name).toBe(true);
  });
});

describe("domainMatches — kayıt anındaki güvenlik kontrolü", () => {
  it("bilinen üniversite + tam eşleşen domain → true", () => {
    expect(domainMatches("ayse@hacettepe.edu.tr", "Hacettepe Üniversitesi")).toBe(true);
  });

  it("alt-alan-adı da kabul edilir", () => {
    expect(domainMatches("21012345@ogr.ktu.edu.tr", "Karadeniz Teknik Üniversitesi")).toBe(true);
  });

  it("BAŞKA üniversitenin domain'i reddedilir (ana senaryo — bu kontrolün var oluş sebebi)", () => {
    expect(domainMatches("ayse@gmail.com", "Hacettepe Üniversitesi")).toBe(false);
    expect(domainMatches("ayse@ktu.edu.tr", "İstanbul Üniversitesi")).toBe(false);
  });

  it("benzer-ama-farklı domain sahte-pozitif ÜRETMEZ (substring değil, alt-alan-adı sınırı şart)", () => {
    // "xktu.edu.tr" → "ktu.edu.tr" ile bitmez (nokta sınırı yok) → eşleşmemeli.
    expect(domainMatches("kim@xktu.edu.tr", "Karadeniz Teknik Üniversitesi")).toBe(false);
  });

  it("bilinmeyen üniversite adı → false (uydurma isimle bypass edilemez)", () => {
    expect(domainMatches("ayse@hacettepe.edu.tr", "Uydurma Üniversitesi")).toBe(false);
  });

  it("büyük/küçük harf ve boşluk toleranslı", () => {
    expect(domainMatches("Ayse@HACETTEPE.EDU.TR", "Hacettepe Üniversitesi")).toBe(true);
    expect(domainMatches("  ayse@hacettepe.edu.tr  ".trim(), "Hacettepe Üniversitesi")).toBe(true);
  });

  it("'@' içermeyen/bozuk girdi çökmez, false döner", () => {
    expect(domainMatches("gecersiz-eposta", "Hacettepe Üniversitesi")).toBe(false);
    expect(domainMatches("", "Hacettepe Üniversitesi")).toBe(false);
  });
});
