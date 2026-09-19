// Kod Paket D — formlar (2026-09-19): 18+ kapısı (S3) · OAuth yaş damgası · yakını adına beyan (R6) · turizm sorumluluk
// bildirimi B.3 (R12) · autocomplete eşlemesi. Saf sözleşmeler; DB/ağ yok. Doğum tarihi hiçbir yerde saklanmaz — burada
// yalnız hesap ve damga doğrulanır.
import { describe, it, expect } from "vitest";
import { MIN_PATIENT_AGE, isAdultPatient, isValidBirthDate, maxPatientBirthDate, UNDERAGE_MESSAGE } from "@/lib/patient-age";
import { issueAgeGateToken, verifyAgeGateToken, AGE_GATE_TTL_SEC, ageGateCookieOptions } from "@/lib/age-gate";
import { oauthBannerMessage } from "@/lib/oauth-banner";
import { onBehalfError, parseForWhom, FREE_CARE_ON_BEHALF_DECLARATION, FREE_CARE_ON_BEHALF_VERSION } from "@/lib/free-care-declaration";
import { TOURISM_DISCLAIMER, TOURISM_DISCLAIMER_TITLE, TOURISM_DISCLAIMER_BODY, TOURISM_DISCLAIMER_VERSION, tourismDisclaimer } from "@/lib/tourism-disclaimer";
import { STAFF_ROLE_CONFIGS, STAFF_AUTOCOMPLETE_BY_KEY } from "@/lib/staff-application-config";

const NOW = new Date("2026-09-19T12:00:00Z");

describe("18+ kapısı — hasta kaydı (A01 madde 3.2 · A02 madde 3.1, S3)", () => {
  it("sınır 18; tam 18. yaş günü geçer, bir gün eksik geçmez; biçimsiz/gelecek fail-closed", () => {
    expect(MIN_PATIENT_AGE).toBe(18);
    expect(isAdultPatient("2008-09-19", NOW)).toBe(true);
    expect(isAdultPatient("2008-09-20", NOW)).toBe(false);
    for (const s of ["", "19.09.2008", "2008-02-30", "2030-01-01", "abc"]) expect(isAdultPatient(s, NOW), s).toBe(false);
    expect(isValidBirthDate("2008-09-19")).toBe(true);
    expect(isValidBirthDate("2008-9-19")).toBe(false);
    expect(maxPatientBirthDate(NOW)).toBe("2008-09-19");
  });

  it("ret metni: veli/vasi akışı açılmaz (S3) — TR + EN, 'hekim' yok", () => {
    expect(UNDERAGE_MESSAGE.tr).toContain("18");
    expect(UNDERAGE_MESSAGE.tr).toContain("yasal temsilci");
    expect(UNDERAGE_MESSAGE.en).toContain("18");
    expect(`${UNDERAGE_MESSAGE.tr}${UNDERAGE_MESSAGE.en}`.toLocaleLowerCase("tr")).not.toContain("hekim");
  });
});

describe("OAuth yaş damgası (lib/age-gate) — tarih taşımaz, süreli, imzalı", () => {
  it("üretilen damga doğrulanır; süresi dolunca ve kurcalanınca düşer", () => {
    const tok = issueAgeGateToken(NOW);
    expect(tok).toMatch(/^\d+\.[A-Za-z0-9_-]+$/);
    expect(tok).not.toContain("2008"); // damga doğum tarihi/yaş içermez
    expect(verifyAgeGateToken(tok, NOW)).toBe(true);
    expect(verifyAgeGateToken(tok, new Date(NOW.getTime() + (AGE_GATE_TTL_SEC + 1) * 1000))).toBe(false);
    expect(verifyAgeGateToken(tok.slice(0, -2) + "xx", NOW)).toBe(false);
    const [exp, sig] = tok.split(".");
    expect(verifyAgeGateToken(`${Number(exp) + 3600}.${sig}`, NOW)).toBe(false); // süre uzatma → imza uymaz
    for (const bad of [null, undefined, "", ".", "abc", "123", "123."]) expect(verifyAgeGateToken(bad, NOW), String(bad)).toBe(false);
  });

  it("çerez: httpOnly, 15 dk; üretimde cross-site Apple POST'u için sameSite none + secure", () => {
    const o = ageGateCookieOptions();
    expect(o.httpOnly).toBe(true);
    expect(o.maxAge).toBe(15 * 60);
    expect(["lax", "none"]).toContain(o.sameSite);
    if (o.sameSite === "none") expect(o.secure).toBe(true);
  });

  it("banner: ?oauth=age hesap açılmadan önce doğum tarihi ister, sağlayıcı adını söyler", () => {
    expect(oauthBannerMessage("age", "google", "kayıt")).toContain("18");
    expect(oauthBannerMessage("age", "apple", "kayıt")).toContain("Apple");
  });
});

describe("yakını adına başvuru beyanı (A02 madde 3.4 · A01 madde 12, R6)", () => {
  it("kendisi için → kutu sorulmaz; yakını için → kutu zorunlu (sunucu 400 metni)", () => {
    expect(onBehalfError("self", false)).toBeNull();
    expect(onBehalfError("relative", true)).toBeNull();
    expect(onBehalfError("relative", false)).toContain("beyan kutusunu");
    expect(parseForWhom("relative")).toBe("relative");
    for (const v of ["self", undefined, null, "x", 1]) expect(parseForWhom(v)).toBe("self");
  });

  it("beyan metni TR/EN: rıza + yasal temsilci + madde 3.4 atfı; sürüm 1", () => {
    expect(FREE_CARE_ON_BEHALF_VERSION).toBe(1);
    expect(FREE_CARE_ON_BEHALF_DECLARATION.tr).toContain("yasal temsilcisiyim");
    expect(FREE_CARE_ON_BEHALF_DECLARATION.tr).toContain("madde 3.4");
    expect(FREE_CARE_ON_BEHALF_DECLARATION.en).toContain("legal representative");
    expect(FREE_CARE_ON_BEHALF_DECLARATION.en).toContain("Section 3.4");
  });
});

describe("sağlık turizmi sorumluluk bildirimi — A08 B.3 (R12) vault'tan", () => {
  it("TR başlık/gövde: kasıt/ağır ihmal saklı, Etik Kurul açılmaz, 'cezai' ÇIKTI, markdown kalıntısı yok", () => {
    expect(TOURISM_DISCLAIMER_TITLE).toBe("Önemli: Sağlık turizmi sorumluluk bildirimi");
    expect(TOURISM_DISCLAIMER_BODY).toContain("Etik Kurul başvurusu açılmaz");
    expect(TOURISM_DISCLAIMER_BODY).toContain("ağır");
    expect(TOURISM_DISCLAIMER_BODY).toContain("kaydınıza işlenir");
    expect(TOURISM_DISCLAIMER_BODY).not.toContain("cezai");
    expect(TOURISM_DISCLAIMER_BODY).not.toContain("**");
    expect(TOURISM_DISCLAIMER_BODY).not.toContain("\n");
    expect(TOURISM_DISCLAIMER_VERSION).toBe("1.0");
  });

  it("EN ikinci kanonik ayrı metin; her iki dilde 'hekim' yok", () => {
    const en = tourismDisclaimer("en");
    expect(en.title).toBe("Important: Health tourism liability notice");
    expect(en.body).toContain("no Ethics Board application is opened");
    expect(en.body).not.toContain("**");
    for (const l of ["tr", "en"] as const) {
      expect(`${TOURISM_DISCLAIMER[l].title} ${TOURISM_DISCLAIMER[l].body}`.toLocaleLowerCase("tr")).not.toContain("hekim");
    }
  });
});

describe("autocomplete — personel formu eşlemesi tam (yeni alan eklenince bu test söyler)", () => {
  it("her rol-config alanının anahtarı eşlemede var; parola/e-posta dışı kimlik alanları anlamsal ipucu taşır", () => {
    const keys = new Set(Object.values(STAFF_ROLE_CONFIGS).flatMap((c) => c.fields.map((f) => f.key)));
    for (const k of keys) expect(STAFF_AUTOCOMPLETE_BY_KEY[k], k).toBeTruthy();
    expect(STAFF_AUTOCOMPLETE_BY_KEY.name).toBe("name");
    expect(STAFF_AUTOCOMPLETE_BY_KEY.phone).toBe("tel");
    expect(STAFF_AUTOCOMPLETE_BY_KEY.licenseNo).toBe("off");
  });
});
