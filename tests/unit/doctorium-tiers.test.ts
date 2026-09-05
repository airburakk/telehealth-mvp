// Doctorium üyelik katmanları — saf sözleşmeler (kullanıcı kararı 2026-09-05: deneme · doğrulanmış ·
// öğrenci). Bu dosya öncelik tablosunu, yüzey bayraklarını ve deneme takvimini KİLİTLER; tarih
// mantığı `now` parametreli olduğundan saat/dilim bağımsızdır.
import { describe, it, expect } from "vitest";
import {
  doctoriumAudience, hasPortalAccess, audienceFlags, audienceLabel,
  TRIAL_DAYS, LOCKED_PURGE_DAYS, TRIAL_PURGE_NOTICE_DAYS, TRIAL_ALERT_THRESHOLDS,
  TRIAL_TITLE, DOCTORIUM_STUDENT_SUFFIX,
  trialWindow, trialDaysLeft, dueTrialAlerts, shouldPurgeLockedTrial,
  parseTrialAlerts, serializeTrialAlerts, formatTrialEndsAt,
  type DoctoriumAudience,
} from "@/lib/doctorium-tiers";

const D = (s: string | null) => (s ? new Date(s) : null);
const NOW = new Date("2026-09-05T09:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const plusDays = (base: Date, n: number) => new Date(base.getTime() + n * DAY);
const none = { diplomaVerifiedAt: null, studentVerifiedAt: null, doctoriumOptOutAt: null, trialEndsAt: null };

describe("doctoriumAudience — öncelik tablosu (optOut > diploma > öğrenci > deneme)", () => {
  it("hiç damga yok → NONE", () => {
    expect(doctoriumAudience(none, NOW)).toBe("NONE");
  });
  it("trialEndsAt alanı hiç verilmezse (A1: kolon yok) null sayılır", () => {
    expect(doctoriumAudience({ diplomaVerifiedAt: null, studentVerifiedAt: null, doctoriumOptOutAt: null }, NOW)).toBe("NONE");
  });
  it("doğrulanmış diploma → VERIFIED", () => {
    expect(doctoriumAudience({ ...none, diplomaVerifiedAt: D("2026-08-19") }, NOW)).toBe("VERIFIED");
  });
  it("öğrenci damgası → STUDENT", () => {
    expect(doctoriumAudience({ ...none, studentVerifiedAt: D("2026-08-14") }, NOW)).toBe("STUDENT");
  });
  it("deneme bitişi gelecekte → TRIAL; geçmişte ya da tam şimdi → LOCKED", () => {
    expect(doctoriumAudience({ ...none, trialEndsAt: plusDays(NOW, 10) }, NOW)).toBe("TRIAL");
    expect(doctoriumAudience({ ...none, trialEndsAt: plusDays(NOW, -1) }, NOW)).toBe("LOCKED");
    expect(doctoriumAudience({ ...none, trialEndsAt: NOW }, NOW)).toBe("LOCKED");
  });
  it("üyelikten çıkış damgası HER ŞEYİ ezer (diploma + deneme dolu olsa da NONE)", () => {
    expect(doctoriumAudience({
      diplomaVerifiedAt: D("2026-08-19"), studentVerifiedAt: D("2026-08-14"),
      doctoriumOptOutAt: D("2026-08-29"), trialEndsAt: plusDays(NOW, 10),
    }, NOW)).toBe("NONE");
  });
  it("diploma, öğrenci ve deneme damgalarını ezer (deneme süresi bitmiş olsa da VERIFIED)", () => {
    expect(doctoriumAudience({ ...none, diplomaVerifiedAt: D("2026-08-19"), studentVerifiedAt: D("2026-08-14") }, NOW)).toBe("VERIFIED");
    expect(doctoriumAudience({ ...none, diplomaVerifiedAt: D("2026-08-19"), trialEndsAt: plusDays(NOW, -40) }, NOW)).toBe("VERIFIED");
  });
  it("öğrenci damgası denemeyi ezer (öğrenci hesabı deneme damgası almaz ama alsa da STUDENT kalır)", () => {
    expect(doctoriumAudience({ ...none, studentVerifiedAt: D("2026-08-14"), trialEndsAt: plusDays(NOW, -5) }, NOW)).toBe("STUDENT");
  });
  it("bilinçli kenar: eski öğrenci, diploması doğrulanmış, klinik aktivasyonu yok → VERIFIED (2. katman)", () => {
    // Eski isStudentOnly (studentVerifiedAt ∧ ¬activatedAt) bu kişiyi "öğrenci-sınırlı" sayardı;
    // yeni model diplomaya bakar — activatedAt kitle kararına GİRMEZ.
    expect(doctoriumAudience({ ...none, diplomaVerifiedAt: D("2027-07-01"), studentVerifiedAt: D("2026-08-14") }, NOW)).toBe("VERIFIED");
  });
});

describe("hasPortalAccess", () => {
  it("VERIFIED · STUDENT · TRIAL girer; LOCKED · NONE giremez", () => {
    const open: DoctoriumAudience[] = ["VERIFIED", "STUDENT", "TRIAL"];
    const closed: DoctoriumAudience[] = ["LOCKED", "NONE"];
    for (const a of open) expect(hasPortalAccess(a)).toBe(true);
    for (const a of closed) expect(hasPortalAccess(a)).toBe(false);
  });
});

describe("audienceFlags — TAM matris (pazarlama yüzeyleri YALNIZ VERIFIED)", () => {
  it("VERIFIED: her şey açık, öğrenci yüzeyi/deneme rozeti yok", () => {
    expect(audienceFlags("VERIFIED")).toEqual({
      canSeeSponsored: true, canSeeSurveys: true, canEarnPoints: true, canRedeem: true,
      showsStudentSurfaces: false, showsTrialBadge: false,
    });
  });
  it("STUDENT: pazarlama kapalı, öğrenci yüzeyleri açık", () => {
    expect(audienceFlags("STUDENT")).toEqual({
      canSeeSponsored: false, canSeeSurveys: false, canEarnPoints: false, canRedeem: false,
      showsStudentSurfaces: true, showsTrialBadge: false,
    });
  });
  it("TRIAL: pazarlama kapalı, yalnız deneme rozeti", () => {
    expect(audienceFlags("TRIAL")).toEqual({
      canSeeSponsored: false, canSeeSurveys: false, canEarnPoints: false, canRedeem: false,
      showsStudentSurfaces: false, showsTrialBadge: true,
    });
  });
  it("LOCKED ve NONE: hiçbir yüzey", () => {
    const allOff = {
      canSeeSponsored: false, canSeeSurveys: false, canEarnPoints: false, canRedeem: false,
      showsStudentSurfaces: false, showsTrialBadge: false,
    };
    expect(audienceFlags("LOCKED")).toEqual(allOff);
    expect(audienceFlags("NONE")).toEqual(allOff);
  });
  it("etiketler Türkçe ve 'hekim' içermez", () => {
    const all: DoctoriumAudience[] = ["VERIFIED", "STUDENT", "TRIAL", "LOCKED", "NONE"];
    for (const a of all) {
      const l = audienceLabel(a);
      expect(l.length).toBeGreaterThan(3);
      expect(l.toLocaleLowerCase("tr")).not.toContain("hekim");
    }
  });
});

describe("sabitler (kullanıcı kararları 2026-09-05)", () => {
  it("deneme 30 gün · imha bitimden 90 gün sonra · bildirim 30 gün önce · eşikler 7/3/1", () => {
    expect(TRIAL_DAYS).toBe(30);
    expect(LOCKED_PURGE_DAYS).toBe(90);
    expect(TRIAL_PURGE_NOTICE_DAYS).toBe(30);
    expect([...TRIAL_ALERT_THRESHOLDS]).toEqual([7, 3, 1]);
  });
  it("deneme ünvanı dürüst ('Dr.', uzmanlık iddiası yok); öğrenci eki tek sabit ve 'hekim' içermez", () => {
    expect(TRIAL_TITLE).toBe("Dr.");
    expect(DOCTORIUM_STUDENT_SUFFIX.length).toBeGreaterThan(0);
    expect(DOCTORIUM_STUDENT_SUFFIX.toLocaleLowerCase("tr")).not.toContain("hekim");
  });
});

describe("trialWindow / trialDaysLeft", () => {
  it("pencere tam 30 gün", () => {
    const w = trialWindow(NOW);
    expect(w.trialStartedAt).toEqual(NOW);
    expect(w.trialEndsAt.getTime() - w.trialStartedAt.getTime()).toBe(30 * DAY);
  });
  it("kalan gün yukarı yuvarlanır: bitişe 1 ms kala 1, tam bitişte 0, sonrası 0", () => {
    const ends = plusDays(NOW, 30);
    expect(trialDaysLeft(ends, NOW)).toBe(30);
    expect(trialDaysLeft(ends, new Date(ends.getTime() - 1))).toBe(1);
    expect(trialDaysLeft(ends, ends)).toBe(0);
    expect(trialDaysLeft(ends, plusDays(ends, 3))).toBe(0);
    expect(trialDaysLeft(ends, new Date(NOW.getTime() + 0.5 * DAY))).toBe(30); // 29,5 gün → 30
  });
});

describe("dueTrialAlerts — kaçırılan günü telafi eden, bayat mesaj atmayan hatırlatma", () => {
  const ends = plusDays(NOW, 30);
  const S = (...k: string[]) => new Set(k);
  it("8 gün kala hiçbir şey", () => {
    expect(dueTrialAlerts({ endsAt: ends, sent: S(), now: plusDays(ends, -8) })).toEqual({ send: [], markSent: [] });
  });
  it("7 gün kala '7'", () => {
    expect(dueTrialAlerts({ endsAt: ends, sent: S(), now: plusDays(ends, -7) })).toEqual({ send: ["7"], markSent: ["7"] });
  });
  it("'7' gönderilmiş, 3 gün kala '3'", () => {
    expect(dueTrialAlerts({ endsAt: ends, sent: S("7"), now: plusDays(ends, -3) })).toEqual({ send: ["3"], markSent: ["3"] });
  });
  it("2 gün kala hiç uyarı gitmemişse yalnız '3' gider, '7' sessizce gönderilmiş sayılır", () => {
    expect(dueTrialAlerts({ endsAt: ends, sent: S(), now: plusDays(ends, -2) })).toEqual({ send: ["3"], markSent: ["7", "3"] });
  });
  it("aynı eşik iki kez gitmez", () => {
    expect(dueTrialAlerts({ endsAt: ends, sent: S("7", "3"), now: plusDays(ends, -2) })).toEqual({ send: [], markSent: [] });
  });
  it("1 gün kala '1'", () => {
    expect(dueTrialAlerts({ endsAt: ends, sent: S("7", "3"), now: plusDays(ends, -1) })).toEqual({ send: ["1"], markSent: ["1"] });
  });
  it("bitişte 'ended' bir kez; kalan eşikler bayat olmasın diye işaretlenir", () => {
    const r = dueTrialAlerts({ endsAt: ends, sent: S("7", "3"), now: ends });
    expect(r.send).toEqual(["ended"]);
    expect(r.markSent).toEqual(["1", "ended"]);
    expect(dueTrialAlerts({ endsAt: ends, sent: S("7", "3", "1", "ended"), now: plusDays(ends, 5) })).toEqual({ send: [], markSent: [] });
  });
  it("imha bildirimi bitimden (90−30)=60 gün sonra, bir kez", () => {
    const sent = S("7", "3", "1", "ended");
    expect(dueTrialAlerts({ endsAt: ends, sent, now: plusDays(ends, 59) })).toEqual({ send: [], markSent: [] });
    expect(dueTrialAlerts({ endsAt: ends, sent, now: plusDays(ends, 60) })).toEqual({ send: ["purge-notice"], markSent: ["purge-notice"] });
    expect(dueTrialAlerts({ endsAt: ends, sent: S(...sent, "purge-notice"), now: plusDays(ends, 61) })).toEqual({ send: [], markSent: [] });
  });
  it("cron uzun süre koşmamışsa 'ended' ve 'purge-notice' aynı turda gider", () => {
    const r = dueTrialAlerts({ endsAt: ends, sent: S(), now: plusDays(ends, 70) });
    expect(r.send).toEqual(["ended", "purge-notice"]);
    expect(r.markSent).toEqual(["7", "3", "1", "ended", "purge-notice"]);
  });
});

describe("shouldPurgeLockedTrial — FAIL-CLOSED imha", () => {
  const ends = plusDays(NOW, 30);
  it("90 günden önce silinmez", () => {
    expect(shouldPurgeLockedTrial({ endsAt: ends, sent: new Set(["purge-notice"]), now: plusDays(ends, 89) })).toBe(false);
  });
  it("imha bildirimi gitmemişse 90 gün dolsa da SİLİNMEZ", () => {
    expect(shouldPurgeLockedTrial({ endsAt: ends, sent: new Set(["ended"]), now: plusDays(ends, 120) })).toBe(false);
  });
  it("bildirim gitmiş + 90 gün dolmuş → silinir", () => {
    expect(shouldPurgeLockedTrial({ endsAt: ends, sent: new Set(["ended", "purge-notice"]), now: plusDays(ends, 90) })).toBe(true);
  });
});

describe("trialAlertsSent JSON tur", () => {
  it("bozuk/boş değer boş küme; geçerli liste küme; serileştirme sıralı", () => {
    expect(parseTrialAlerts(null).size).toBe(0);
    expect(parseTrialAlerts("{bozuk").size).toBe(0);
    expect(parseTrialAlerts('["7", 3, "ended"]')).toEqual(new Set(["7", "ended"]));
    expect(serializeTrialAlerts(new Set(["ended", "3", "7"]))).toBe('["3","7","ended"]');
    expect(parseTrialAlerts(serializeTrialAlerts(new Set(["7", "3"])))).toEqual(new Set(["3", "7"]));
  });
});

describe("formatTrialEndsAt — tr-TR, Türkiye saati", () => {
  it("UTC gece yarısından önceki an Türkiye'de ertesi güne düşer (dilim etkisi kanıtı)", () => {
    // 2026-10-04 22:30 UTC = 2026-10-05 01:30 Türkiye → etiket 5 Ekim olmalı.
    const label = formatTrialEndsAt(new Date("2026-10-04T22:30:00.000Z"));
    expect(label).toContain("5");
    expect(label).toContain("Ekim");
    expect(label).toContain("2026");
  });
});
