// AŞAMA 2 güvenlik katmanları (v6.126) — saf mantık sözleşmeleri.
// Kilitlenenler: katman matrisi (SMS zorunlu + kurum bağından biri) · canActivate gate'inin
// DORMANT güvenliği (gate kapalı/verilmemişken v6.124 davranışı birebir) · iş e-postası
// serbest-sağlayıcı reddi · OTP üretim/hash sözleşmeleri.
import { describe, it, expect } from "vitest";
import { hasStage2Layers, isWorkEmail, isPlausiblePhone, genOtpCode, hashOtp } from "@/lib/doctor-verify";
import { canActivate } from "@/lib/doctor-activation";

const D = (s: string | null) => (s ? new Date(s) : null);
const noMmss = { mmssInsurer: null, mmssPolicyNo: null, mmssCoverageLimit: null };
const kabulluDiploma = [{ type: "DIPLOMA", status: "ACCEPTED" }];

describe("hasStage2Layers — SMS zorunlu + kurum bağından biri (§8.2)", () => {
  const M = (sms: string | null, email: string | null, phone: string | null) =>
    hasStage2Layers({ smsVerifiedAt: D(sms), workEmailVerifiedAt: D(email), clinicPhoneVerifiedAt: D(phone) });

  it("hiçbiri yoksa kapalı", () => expect(M(null, null, null)).toBe(false));
  it("🔴 SMS'siz hiçbir kombinasyon geçmez (kurum bağı ikisi de olsa bile)", () => {
    expect(M(null, "2026-08-19", null)).toBe(false);
    expect(M(null, null, "2026-08-19")).toBe(false);
    expect(M(null, "2026-08-19", "2026-08-19")).toBe(false);
  });
  it("SMS tek başına da yetmez (kurum bağı şart)", () => expect(M("2026-08-19", null, null)).toBe(false));
  it("SMS + iş e-postası GEÇER", () => expect(M("2026-08-19", "2026-08-19", null)).toBe(true));
  it("SMS + klinik telefonu GEÇER (kurumsal e-postası olmayan doktor tıkanmaz)", () =>
    expect(M("2026-08-19", null, "2026-08-19")).toBe(true));
});

describe("canActivate × katman kapısı — DORMANT güvenli varsayılan", () => {
  const bosKatman = { smsVerifiedAt: null, workEmailVerifiedAt: null, clinicPhoneVerifiedAt: null };
  const tamKatman = { smsVerifiedAt: D("2026-08-19"), workEmailVerifiedAt: D("2026-08-19"), clinicPhoneVerifiedAt: null };

  it("parametre verilmezse v6.124 davranışı (onaylı diploma yeter)", () => {
    expect(canActivate(kabulluDiploma, noMmss)).toBe(true);
  });
  it("gate KAPALIYKEN katmanlar boş olsa da v6.124 davranışı sürer", () => {
    expect(canActivate(kabulluDiploma, noMmss, { enabled: false, layers: bosKatman })).toBe(true);
  });
  it("gate AÇIKKEN katmansız doktor AKTİVE OLMAZ", () => {
    expect(canActivate(kabulluDiploma, noMmss, { enabled: true, layers: bosKatman })).toBe(false);
  });
  it("gate AÇIK + katmanlar tam → aktive olur", () => {
    expect(canActivate(kabulluDiploma, noMmss, { enabled: true, layers: tamKatman })).toBe(true);
  });
  it("🔴 katmanlar tam olsa bile ONAYSIZ diploma kurtarmaz (katman diploma yerine geçmez)", () => {
    expect(canActivate([{ type: "DIPLOMA", status: "PENDING" }], noMmss, { enabled: true, layers: tamKatman })).toBe(false);
  });
});

describe("isWorkEmail — serbest sağlayıcı reddi (kurum bağı kanıtı)", () => {
  it("kurum alan adları kabul", () => {
    expect(isWorkEmail("dr.ayse@hacettepe.edu.tr")).toBe(true);
    expect(isWorkEmail("a.yilmaz@memorial.com.tr")).toBe(true);
  });
  it("serbest sağlayıcılar RET", () => {
    for (const e of ["a@gmail.com", "a@hotmail.com", "a@outlook.com", "a@yandex.com.tr", "a@icloud.com", "a@proton.me"]) {
      expect(isWorkEmail(e)).toBe(false);
    }
  });
  it("biçimsiz girdi RET", () => {
    expect(isWorkEmail("degil")).toBe(false);
    expect(isWorkEmail("a@b")).toBe(false);
    expect(isWorkEmail("")).toBe(false);
  });
  it("büyük harf/boşluk toleransı", () => {
    expect(isWorkEmail("  Dr.Ayse@HACETTEPE.EDU.TR ")).toBe(true);
    expect(isWorkEmail(" A@GMAIL.COM ")).toBe(false);
  });
});

describe("isPlausiblePhone", () => {
  it("TR cep biçimleri kabul", () => {
    expect(isPlausiblePhone("05321234567")).toBe(true);
    expect(isPlausiblePhone("+90 532 123 45 67")).toBe(true);
  });
  it("kısa/harfli girdi RET", () => {
    expect(isPlausiblePhone("12345")).toBe(false);
    expect(isPlausiblePhone("telefon")).toBe(false);
  });
});

describe("OTP sözleşmeleri", () => {
  it("kod daima 6 hane (başta sıfır korunur)", () => {
    for (let i = 0; i < 50; i++) expect(genOtpCode()).toMatch(/^\d{6}$/);
  });
  it("hash satır id'sine bağlı (aynı kod farklı satırda farklı hash — gökkuşağı tablosu kırılır)", () => {
    expect(hashOtp("123456", "a")).not.toBe(hashOtp("123456", "b"));
    expect(hashOtp("123456", "a")).toBe(hashOtp("123456", "a"));
  });
  it("hash ham kodu içermez", () => {
    expect(hashOtp("123456", "x")).not.toContain("123456");
  });
});
