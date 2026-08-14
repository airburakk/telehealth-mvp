// İki aşamalı doktor girişi (v6.87) — saf mantık sözleşmeleri.
// DB'li yollar (refreshChamberLetter, setHrContactConsent) entegrasyon işidir; burada iki kapının
// BAĞIMSIZLIĞI kilitlenir: CHAMBER yalnız Doctorium'u açar (klinik aktivasyona girdi DEĞİL),
// klinik aktivasyon Doctorium'u da açar (mevcut aktif doktorlar backfill'siz geçer).
// v6.95: üçüncü Aşama 1 damgası (öğrenci belgesi) + isStudentOnly pazarlama süzgeci sözleşmeleri.
import { describe, it, expect } from "vitest";
import {
  ALL_DOC_TYPES, REQUIRED_DOC_TYPES, hasDoctoriumAccess, hasChamberLetter, hasStudentCert,
  canActivate, canCompleteOnboarding, missingOnboardingSteps, hasClinicalAccess,
  isStudentOnly, isEduEmail,
} from "@/lib/doctor-activation";
import { HR_CONTACT_SCOPE, HR_CONTACT_REVOKE_SCOPE } from "@/lib/hr-consent";
import { SPONSOR_CONSENT_SCOPE, SPONSOR_REVOKE_SCOPE } from "@/lib/sponsor";
import { DOCTOR_TITLES, STUDENT_TITLE } from "@/lib/doctor-signup";

const D = (s: string | null) => (s ? new Date(s) : null);

describe("Doctorium kapısı (Aşama 1): yazı VEYA öğrenci belgesi VEYA klinik aktivasyon", () => {
  it("üçü de yoksa kapalı", () => {
    expect(hasDoctoriumAccess({ chamberLetterAt: null, activatedAt: null, studentVerifiedAt: null })).toBe(false);
  });
  it("tabip odası yazısı tek başına açar (klinik belgeler beklemez)", () => {
    expect(hasDoctoriumAccess({ chamberLetterAt: D("2026-08-11"), activatedAt: null, studentVerifiedAt: null })).toBe(true);
  });
  it("klinik aktivasyon tek başına açar (mevcut aktif doktorlar CHAMBER'sız içeride)", () => {
    expect(hasDoctoriumAccess({ chamberLetterAt: null, activatedAt: D("2026-07-01"), studentVerifiedAt: null })).toBe(true);
  });
  it("öğrenci belgesi tek başına açar (v6.95 — üçüncü damga)", () => {
    expect(hasDoctoriumAccess({ chamberLetterAt: null, activatedAt: null, studentVerifiedAt: D("2026-08-14") })).toBe(true);
  });
});

describe("Klinik yüzey kapısı (Aşama 2): yalnız activatedAt açar", () => {
  it("aktivasyonsuz doktor klinik yüzeye giremez", () => {
    expect(hasClinicalAccess({ activatedAt: null })).toBe(false);
  });
  it("klinik aktivasyon açar", () => {
    expect(hasClinicalAccess({ activatedAt: D("2026-08-11") })).toBe(true);
  });
  it("Aşama 1 doktoru (yalnız CHAMBER): Doctorium AÇIK, klinik yüzey KAPALI — kapılar tek yönde bağımsız", () => {
    const stage1 = { chamberLetterAt: D("2026-08-11"), activatedAt: null, studentVerifiedAt: null };
    expect(hasDoctoriumAccess(stage1)).toBe(true);
    expect(hasClinicalAccess(stage1)).toBe(false);
  });
  it("Aşama 2 doktoru her iki kapıdan geçer (CHAMBER'sız mevcut aktif doktorlar dahil)", () => {
    const stage2 = { chamberLetterAt: null, activatedAt: D("2026-07-01"), studentVerifiedAt: null };
    expect(hasDoctoriumAccess(stage2)).toBe(true);
    expect(hasClinicalAccess(stage2)).toBe(true);
  });
  it("öğrenci damgası DOLUYKEN klinik yüzey yine KAPALI (yeni şartı dolu ver — negatif-test ilkesi)", () => {
    const student = { chamberLetterAt: null, activatedAt: null, studentVerifiedAt: D("2026-08-14") };
    expect(hasDoctoriumAccess(student)).toBe(true);
    expect(hasClinicalAccess(student)).toBe(false);
  });
});

describe("Öğrenci üyeliği (v6.95): isStudentOnly pazarlama süzgeci", () => {
  it("yalnız öğrenci damgası → öğrenci-sınırlı (sponsor/anket/ödül kapalı)", () => {
    expect(isStudentOnly({ studentVerifiedAt: D("2026-08-14"), activatedAt: null })).toBe(true);
  });
  it("mezuniyet: damga DURURKEN klinik aktivasyon gelince süzgeç kalkar (damga silinmez)", () => {
    expect(isStudentOnly({ studentVerifiedAt: D("2026-08-14"), activatedAt: D("2027-07-01") })).toBe(false);
  });
  it("damgasız doktor öğrenci-sınırlı DEĞİL (süzgeç normal doktora dokunmaz)", () => {
    expect(isStudentOnly({ studentVerifiedAt: null, activatedAt: null })).toBe(false);
    expect(isStudentOnly({ studentVerifiedAt: null, activatedAt: D("2026-07-01") })).toBe(false);
  });
});

describe("isEduEmail: akademik e-posta SİNYALİ (kapı açmaz, yalnız rozet)", () => {
  it("akademik uzantılar tanınır (.edu.tr alt-domain dahil, .edu, .ac.<cc>)", () => {
    expect(isEduEmail("ogrenci@istanbul.edu.tr")).toBe(true);
    expect(isEduEmail("ali@std.medipol.edu.tr")).toBe(true);
    expect(isEduEmail("student@harvard.edu")).toBe(true);
    expect(isEduEmail("s.jones@ucl.ac.uk")).toBe(true);
  });
  it("akademik olmayan / bozuk girdi reddedilir", () => {
    expect(isEduEmail("kisi@gmail.com")).toBe(false);
    expect(isEduEmail("kisi@edu.example.com")).toBe(false); // "edu" domain ortasında — uzantı değil
    expect(isEduEmail("adres-at-yok.edu.tr")).toBe(false);
    expect(isEduEmail("")).toBe(false);
    expect(isEduEmail(null)).toBe(false);
    expect(isEduEmail(undefined)).toBe(false);
  });
});

describe("belge tipleri: CHAMBER/STUDENT_CERT kabul edilir ama Aşama 2'ye girdi DEĞİL", () => {
  it("CHAMBER ve STUDENT_CERT geçerli belge tipidir (API kabul kapısı ALL_DOC_TYPES'tan okur)", () => {
    expect(ALL_DOC_TYPES).toContain("CHAMBER");
    expect(ALL_DOC_TYPES).toContain("STUDENT_CERT");
  });
  it("CHAMBER/STUDENT_CERT zorunlu klinik belgelerden DEĞİLDİR (Aşama 2 gereksinimleri değişmedi)", () => {
    expect(REQUIRED_DOC_TYPES).not.toContain("CHAMBER");
    expect(REQUIRED_DOC_TYPES).not.toContain("STUDENT_CERT");
    expect([...REQUIRED_DOC_TYPES]).toEqual(["DIPLOMA", "MMSS"]);
  });
  it("yalnız CHAMBER/STUDENT_CERT yüklü doktor klinik AKTİVE OLMAZ (MMSS metadata'sı tam olsa bile)", () => {
    const fullMmss = { mmssInsurer: "X", mmssPolicyNo: "P1", mmssCoverageLimit: 1_000_000 };
    expect(canActivate([{ type: "CHAMBER" }], fullMmss)).toBe(false);
    expect(canActivate([{ type: "STUDENT_CERT" }], fullMmss)).toBe(false);
  });
  it("hasChamberLetter/hasStudentCert yalnız kendi tipini sayar", () => {
    expect(hasChamberLetter([{ type: "DIPLOMA" }, { type: "MMSS" }])).toBe(false);
    expect(hasChamberLetter([{ type: "CHAMBER" }])).toBe(true);
    expect(hasStudentCert([{ type: "CHAMBER" }, { type: "DIPLOMA" }])).toBe(false);
    expect(hasStudentCert([{ type: "STUDENT_CERT" }])).toBe(true);
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

describe("Öğrenci hunisi kayıt sözleşmesi (v6.95)", () => {
  it("STUDENT_TITLE doktor ünvan listesinde DEĞİL (doktor kayıt formunda seçilemez; huniler ayrık)", () => {
    expect(DOCTOR_TITLES as readonly string[]).not.toContain(STUDENT_TITLE);
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
