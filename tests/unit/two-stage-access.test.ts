// İki aşamalı doktor girişi (v6.87) — saf mantık sözleşmeleri.
// DB'li yollar (refreshChamberLetter, setHrContactConsent) entegrasyon işidir; burada iki kapının
// BAĞIMSIZLIĞI kilitlenir: CHAMBER yalnız Doctorium'u açar (klinik aktivasyona girdi DEĞİL),
// klinik aktivasyon Doctorium'u da açar (mevcut aktif doktorlar backfill'siz geçer).
import { describe, it, expect } from "vitest";
import {
  ALL_DOC_TYPES, REQUIRED_DOC_TYPES, hasDoctoriumAccess, hasChamberLetter, canActivate,
  canCompleteOnboarding, missingOnboardingSteps,
} from "@/lib/doctor-activation";
import { HR_CONTACT_SCOPE, HR_CONTACT_REVOKE_SCOPE } from "@/lib/hr-consent";
import { SPONSOR_CONSENT_SCOPE, SPONSOR_REVOKE_SCOPE } from "@/lib/sponsor";

const D = (s: string | null) => (s ? new Date(s) : null);

describe("Doctorium kapısı (Aşama 1): yazı VEYA klinik aktivasyon", () => {
  it("ikisi de yoksa kapalı", () => {
    expect(hasDoctoriumAccess({ chamberLetterAt: null, activatedAt: null })).toBe(false);
  });
  it("tabip odası yazısı tek başına açar (klinik belgeler beklemez)", () => {
    expect(hasDoctoriumAccess({ chamberLetterAt: D("2026-08-11"), activatedAt: null })).toBe(true);
  });
  it("klinik aktivasyon tek başına açar (mevcut aktif doktorlar CHAMBER'sız içeride)", () => {
    expect(hasDoctoriumAccess({ chamberLetterAt: null, activatedAt: D("2026-07-01") })).toBe(true);
  });
});

describe("belge tipleri: CHAMBER kabul edilir ama Aşama 2'ye girdi DEĞİL", () => {
  it("CHAMBER geçerli belge tipidir (API kabul kapısı ALL_DOC_TYPES'tan okur)", () => {
    expect(ALL_DOC_TYPES).toContain("CHAMBER");
  });
  it("CHAMBER zorunlu klinik belgelerden DEĞİLDİR (Aşama 2 gereksinimleri değişmedi)", () => {
    expect(REQUIRED_DOC_TYPES).not.toContain("CHAMBER");
    expect([...REQUIRED_DOC_TYPES]).toEqual(["DIPLOMA", "MMSS"]);
  });
  it("yalnız CHAMBER yüklü doktor klinik AKTİVE OLMAZ (MMSS metadata'sı tam olsa bile)", () => {
    const fullMmss = { mmssInsurer: "X", mmssPolicyNo: "P1", mmssCoverageLimit: 1_000_000 };
    expect(canActivate([{ type: "CHAMBER" }], fullMmss)).toBe(false);
  });
  it("hasChamberLetter yalnız CHAMBER tipini sayar", () => {
    expect(hasChamberLetter([{ type: "DIPLOMA" }, { type: "MMSS" }])).toBe(false);
    expect(hasChamberLetter([{ type: "CHAMBER" }])).toBe(true);
  });
});

describe("finish kapısı: OAuth boş-kimlik hesabı branşsız/şehirsiz onboarding BİTİREMEZ", () => {
  // Diğer her adımı tam bir doktor — yalnız kimlik alanları senaryoya göre değişir.
  const full = {
    mmssInsurer: "X", mmssPolicyNo: "P1", mmssCoverageLimit: 1_000_000,
    procedures: '{"K001":100}', licenseNo: "12345", specBoard: "Kardiyoloji Uzmanlık Belgesi",
  };
  const docs = [{ type: "DIPLOMA" }, { type: "MMSS" }];

  it("branch/city boş (Google/Apple varsayılanı) → finish reddedilir, eksikler adlandırılır", () => {
    const d = { ...full, branch: "", city: "" };
    expect(canCompleteOnboarding(docs, d)).toBe(false);
    const missing = missingOnboardingSteps(docs, d);
    expect(missing).toContain("Branş bilgisi (profilinizi tamamlayın)");
    expect(missing).toContain("Şehir bilgisi (profilinizi tamamlayın)");
  });

  it("kimlik dolu (e-posta kaydı / profil-tamamla sonrası) → finish açık", () => {
    expect(canCompleteOnboarding(docs, { ...full, branch: "Kardiyoloji", city: "Ankara" })).toBe(true);
  });
});

describe("İK onam scope sözleşmesi (ConsentRecord kova ayrımı)", () => {
  it("grant/revoke ayrı scope (aç-kapa-aç döngüsü zincirde ayrı iz bırakır)", () => {
    expect(HR_CONTACT_SCOPE).not.toBe(HR_CONTACT_REVOKE_SCOPE);
  });
  it("İK scope'ları sponsor scope'larıyla ÇAKIŞMAZ (yanlış kovaya yazım = ispat karışması)", () => {
    const all = [HR_CONTACT_SCOPE, HR_CONTACT_REVOKE_SCOPE, SPONSOR_CONSENT_SCOPE, SPONSOR_REVOKE_SCOPE];
    expect(new Set(all).size).toBe(all.length);
  });
});
