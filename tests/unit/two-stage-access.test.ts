// İki aşamalı doktor girişi — saf mantık sözleşmeleri.
// v6.124 (kullanıcı kararı 2026-08-19): Doctorium kapısı e-DEVLET DOĞRULAMALI DİPLOMA'dır
// (diplomaVerifiedAt) VEYA öğrenci damgası.
// v6.147 (kullanıcı kararı 2026-08-23): öğrenci damgasının MEKANİZMASI değişti (STUDENT_CERT
// belgesi → üniversite e-postası tıklama-doğrulaması, bkz. lib/universities.ts +
// api/auth/verify-student-email) ama hasDoctoriumAccess FORMÜLÜ aynı — hasStudentCert/isEduEmail
// silindi, ALL_DOC_TYPES artık STUDENT_CERT içermez.
// Burada iki kapının BAĞIMSIZLIĞI kilitlenir: diploma doğrulaması Doctorium'u açar ama klinik
// yüzey (activatedAt) ayrı damgadır; öğrenci damgası klinik yüzey AÇMAZ.
import { describe, it, expect } from "vitest";
import {
  ALL_DOC_TYPES, REQUIRED_DOC_TYPES, hasDoctoriumAccess,
  canActivate, canCompleteOnboarding, missingOnboardingSteps, hasClinicalAccess,
  isStudentOnly, canAdminVerifyDoctor,
  doctoriumAudience, audienceFlags,
} from "@/lib/doctor-activation";
import { HR_CONTACT_SCOPE, HR_CONTACT_REVOKE_SCOPE } from "@/lib/hr-consent";
import { SPONSOR_CONSENT_SCOPE, SPONSOR_REVOKE_SCOPE } from "@/lib/sponsor";
import { DOCTOR_TITLES, STUDENT_TITLE } from "@/lib/doctor-signup";

const D = (s: string | null) => (s ? new Date(s) : null);

describe("Doctorium kapısı (Aşama 1, v6.124): doğrulanmış diploma VEYA öğrenci belgesi", () => {
  it("ikisi de yoksa kapalı", () => {
    expect(hasDoctoriumAccess({ diplomaVerifiedAt: null, studentVerifiedAt: null, doctoriumOptOutAt: null, trialEndsAt: null })).toBe(false);
  });
  it("doğrulanmış diploma tek başına açar", () => {
    expect(hasDoctoriumAccess({ diplomaVerifiedAt: D("2026-08-19"), studentVerifiedAt: null, doctoriumOptOutAt: null, trialEndsAt: null })).toBe(true);
  });
  it("öğrenci belgesi tek başına açar (v6.95 yolu sürer)", () => {
    expect(hasDoctoriumAccess({ diplomaVerifiedAt: null, studentVerifiedAt: D("2026-08-14"), doctoriumOptOutAt: null, trialEndsAt: null })).toBe(true);
  });
});

// v6.187 — üyelikten çıkış (kullanıcı kararı 2026-08-29): AURA klinik hesabı da olan doktor
// Doctorium üyeliğinden çıkabilir; hesabı kapanmaz. Damganın kapıyı TEK BAŞINA kapatması şart,
// çünkü diplomaVerifiedAt çıkışta SİLİNMEZ (klinik tarafın da dayanağıdır).
describe("Doctorium üyelikten çıkış (v6.187): doctoriumOptOutAt kapıyı kapatır", () => {
  it("doğrulanmış diploma VARKEN bile çıkış damgası kapıyı kapatır", () => {
    expect(hasDoctoriumAccess({
      diplomaVerifiedAt: D("2026-08-19"), studentVerifiedAt: null, doctoriumOptOutAt: D("2026-08-29"), trialEndsAt: null,
    })).toBe(false);
  });
  it("öğrenci damgası VARKEN bile çıkış damgası kapıyı kapatır", () => {
    expect(hasDoctoriumAccess({
      diplomaVerifiedAt: null, studentVerifiedAt: D("2026-08-14"), doctoriumOptOutAt: D("2026-08-29"), trialEndsAt: null,
    })).toBe(false);
  });
  it("çıkış damgası null'lanınca (yeniden üyelik) kapı geri açılır", () => {
    expect(hasDoctoriumAccess({
      diplomaVerifiedAt: D("2026-08-19"), studentVerifiedAt: null, doctoriumOptOutAt: null, trialEndsAt: null,
    })).toBe(true);
  });
});

describe("Admin onayı (verified) diploma şartına bağlı — v6.196", () => {
  // GERÇEK BULGU (prod ölçümü 2026-09-02): 13 admin onaylı / 11 diploma doğrulanmış → 2 hesap
  // "onaylı ama diplomasız". verified doktoru HASTA HAVUZUNA çıkarır; bu kapı o yolu kapatır.
  it("diploması doğrulanmamış doktor onaylanamaz", () => {
    expect(canAdminVerifyDoctor({ diplomaVerifiedAt: null })).toBe(false);
  });
  it("diploma damgası varsa onay MÜMKÜN olur (otomatik DEĞİL — takdir admin'de kalır)", () => {
    expect(canAdminVerifyDoctor({ diplomaVerifiedAt: D("2026-09-02") })).toBe(true);
  });
  it("kapı YALNIZ diplomaya bakar: klinik aktivasyon onun yerine GEÇMEZ", () => {
    // activatedAt ⊂ diplomaVerifiedAt olsa da bu fonksiyon aktivasyonu okumaz; birinin diğerinin
    // yerine geçtiğini varsayan bir gelecek değişiklik burada kırılsın.
    expect(canAdminVerifyDoctor({ diplomaVerifiedAt: null } as { diplomaVerifiedAt: Date | null })).toBe(false);
  });
});

describe("Klinik yüzey kapısı (Aşama 2): yalnız activatedAt açar", () => {
  it("aktivasyonsuz doktor klinik yüzeye giremez", () => {
    expect(hasClinicalAccess({ activatedAt: null })).toBe(false);
  });
  it("klinik aktivasyon açar", () => {
    expect(hasClinicalAccess({ activatedAt: D("2026-08-11") })).toBe(true);
  });
  it("Aşama 1 doktoru (diploma doğrulı, aktivasyonsuz): Doctorium AÇIK, klinik yüzey KAPALI", () => {
    expect(hasDoctoriumAccess({ diplomaVerifiedAt: D("2026-08-19"), studentVerifiedAt: null, doctoriumOptOutAt: null, trialEndsAt: null })).toBe(true);
    expect(hasClinicalAccess({ activatedAt: null })).toBe(false);
  });
  it("öğrenci damgası DOLUYKEN klinik yüzey yine KAPALI (yeni şartı dolu ver — negatif-test ilkesi)", () => {
    expect(hasDoctoriumAccess({ diplomaVerifiedAt: null, studentVerifiedAt: D("2026-08-14"), doctoriumOptOutAt: null, trialEndsAt: null })).toBe(true);
    expect(hasClinicalAccess({ activatedAt: null })).toBe(false);
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

describe("belge tipleri: DIPLOMA tek zorunlu/kapı-tutan belge", () => {
  it("kabul edilen belge tipleri KAPALI liste (v6.147 STUDENT_CERT çıktı; v6.212 liste bire bir kilitli)", () => {
    // ALL_DOC_TYPES yükleme API'sinin kabul kapısıdır — listede olmayan tip 400 alır.
    expect([...ALL_DOC_TYPES]).toEqual(["DIPLOMA", "MMSS", "CERTIFICATE", "ACADEMIC"]);
  });
  it("v6.105+v6.119: ONAYLI diploma tek başına aktive eder — MMSS hiç yokken bile", () => {
    const noMmss = { mmssInsurer: null, mmssPolicyNo: null, mmssCoverageLimit: null };
    expect(canActivate([{ type: "DIPLOMA", status: "ACCEPTED" }], noMmss)).toBe(true);
    // ...ama diploma YOKSA MMSS'nin tam olması kurtarmaz (zorunlu belge hâlâ zorunlu).
    const fullMmss = { mmssInsurer: "X", mmssPolicyNo: "P1", mmssCoverageLimit: 1_000_000 };
    expect(canActivate([{ type: "MMSS", status: "ACCEPTED" }], fullMmss)).toBe(false);
  });
  it("v6.105 (kullanıcı kararı 2026-08-17): tek zorunlu mesleki belge Tıp Diploması", () => {
    // MMSS aktivasyon şartından ÇIKTI — kartı/formu İHTİYARİ olarak duruyor (teminat limiti
    // /paket sigorta paketini beslemeye devam eder). Şartı geri koymak = diziye "MMSS" eklemek.
    expect([...REQUIRED_DOC_TYPES]).toEqual(["DIPLOMA"]);
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

// 2026-09-05 — ÜÇ KATMAN (deneme · doğrulanmış · öğrenci): hasDoctoriumAccess artık lib/doctorium-tiers
// çözücüsüne delege eder; deneme penceresi (trialEndsAt) kapıyı SÜRELİ açar. Tam matris
// tests/unit/doctorium-tiers.test.ts'te; burada yalnız kapı sözleşmesi ve eski/yeni süzgeç farkı kilitlenir.
describe("Deneme katmanı (2026-09-05): trialEndsAt kapıyı süreli açar", () => {
  const NOW = new Date("2026-09-05T09:00:00.000Z");
  const DAY = 24 * 60 * 60 * 1000;
  const later = new Date(NOW.getTime() + 10 * DAY);
  const earlier = new Date(NOW.getTime() - DAY);
  const base = { diplomaVerifiedAt: null, studentVerifiedAt: null, doctoriumOptOutAt: null, trialEndsAt: null };

  it("bitişi gelecekte deneme → AÇIK", () => {
    expect(hasDoctoriumAccess({ ...base, trialEndsAt: later }, NOW)).toBe(true);
  });
  it("bitişi geçmiş deneme (LOCKED) → KAPALI", () => {
    expect(hasDoctoriumAccess({ ...base, trialEndsAt: earlier }, NOW)).toBe(false);
  });
  it("diploma doğrulanınca bitmiş deneme kapıyı kapatamaz (VERIFIED baskın)", () => {
    expect(hasDoctoriumAccess({ ...base, diplomaVerifiedAt: D("2026-09-01"), trialEndsAt: earlier }, NOW)).toBe(true);
  });
  it("üyelikten çıkış süren denemeyi de kapatır", () => {
    expect(hasDoctoriumAccess({ ...base, doctoriumOptOutAt: D("2026-09-04"), trialEndsAt: later }, NOW)).toBe(false);
  });
  it("trialEndsAt null → eski formülle aynı sonuç (diploma ∨ öğrenci; alan A2 sonrası zorunlu)", () => {
    expect(hasDoctoriumAccess(base, NOW)).toBe(false);
    expect(hasDoctoriumAccess({ ...base, diplomaVerifiedAt: D("2026-08-19") }, NOW)).toBe(true);
  });
  it("bilinçli kenar: eski öğrenci + doğrulanmış diploma, klinik aktivasyon yok → isStudentOnly true (eski) ama kitle VERIFIED", () => {
    const d = { diplomaVerifiedAt: D("2027-07-01"), studentVerifiedAt: D("2026-08-14"), doctoriumOptOutAt: null, trialEndsAt: null, activatedAt: null };
    expect(isStudentOnly(d)).toBe(true);
    expect(doctoriumAudience(d, NOW)).toBe("VERIFIED");
    expect(audienceFlags(doctoriumAudience(d, NOW)).canSeeSponsored).toBe(true);
  });
});
