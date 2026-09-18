// AURA hasta/personel pasiflik süpürmesi + kurumsal başvuru ret imhası — SAF sözleşmeler (A06 madde 3.1b / 3.16,
// kod Paket C, 2026-09-18). DB-bağlı gövdeler (sweepAuraAbandonedAccounts · purgeRejectedStaffApplications ·
// countAuraTies) burada koşmaz (vitest DB-siz — abandoned-sweep.test.ts deseni); yalnız saf karar fonksiyonları,
// "ortak süpürme" süre paritesi, kapsam/allow-list sözleşmeleri ve e-posta metni test edilir.
import { describe, it, expect } from "vitest";
import { AURA_SWEEP_ROLES, auraLoginPath, auraLoginUrl } from "@/lib/aura-abandoned-sweep";
import { abandonedActionFor, isNoticeCurrent, ABANDONED_MS, NOTICE_THRESHOLD_MS } from "@/lib/abandoned-sweep";
import { AURA_NON_CLINICAL_RESOURCE_TYPES, hasAuraTies, type AuraTies } from "@/lib/aura-account-purge";
import { renderAuraAbandonedNoticeEmail, formatDateEn } from "@/lib/aura-abandoned-email";
import { rejectedApplicationPurgeDue, STAFF_APPLICATION_REJECTED_RETENTION_DAYS } from "@/lib/staff-application";
import { REJECTED_RETENTION_DAYS } from "@/lib/doc-purge";
import { AURA_CANONICAL_URL } from "@/lib/brand";
import { ROLES } from "@/lib/roles";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-09-18T00:00:00.000Z");

describe("kapsam — ROLES eksi DOCTOR (Doctorium süpürmesi + 3.17 elle kapatma)", () => {
  it("AURA_SWEEP_ROLES tam olarak DOCTOR dışındaki tüm rollerdir; yeni rol eklenirse bu test söyler", () => {
    const expected = ROLES.filter((r) => r !== "DOCTOR").sort();
    expect([...AURA_SWEEP_ROLES].sort()).toEqual(expected);
    expect(AURA_SWEEP_ROLES).not.toContain("DOCTOR");
  });

  it("giriş bağlantısı: hasta /giris, personel /kurumsal-giris — AURA kanonik kökünden", () => {
    expect(auraLoginPath("PATIENT")).toBe("/giris");
    for (const r of ["COORDINATOR", "ETHICS", "ADMIN", "PARTNER", "AGENCY", "HEALTH_PRO"]) expect(auraLoginPath(r)).toBe("/kurumsal-giris");
    expect(auraLoginUrl("PATIENT")).toBe(`${AURA_CANONICAL_URL}/giris`);
    expect(auraLoginUrl("AGENCY")).toBe(`${AURA_CANONICAL_URL}/kurumsal-giris`);
  });
});

describe("ortak süpürme — süreler Doctorium 3.1b ile AYNI (S5: 3 yıl + 30 gün bildirim)", () => {
  it("3 yıl ve 30 gün önce bildirim eşiği", () => {
    expect(ABANDONED_MS).toBe(3 * 365 * DAY_MS);
    expect(NOTICE_THRESHOLD_MS).toBe(ABANDONED_MS - 30 * DAY_MS);
  });

  it("isNoticeCurrent: bildirimden SONRA giriş yapılmışsa damga bayattır (bildirimsiz imha korkuluğu)", () => {
    const lastActivity = new Date("2026-01-10T00:00:00.000Z");
    expect(isNoticeCurrent(null, lastActivity)).toBe(false);
    expect(isNoticeCurrent(undefined, lastActivity)).toBe(false);
    expect(isNoticeCurrent(new Date("2026-01-01T00:00:00.000Z"), lastActivity)).toBe(false); // bildirim eski, sonra girmiş
    expect(isNoticeCurrent(new Date("2026-02-01T00:00:00.000Z"), lastActivity)).toBe(true); // bildirim bu döneme ait
  });

  it("bayat damgayla 3 yıl dolan hesap ÖNCE yeniden bildirim alır, imha edilmez", () => {
    const lastActivity = new Date(NOW.getTime() - ABANDONED_MS - DAY_MS);
    const staleNotice = new Date(lastActivity.getTime() - 400 * DAY_MS); // önceki pasiflik döneminden kalma
    const action = abandonedActionFor({ lastActivity, alreadyNoticed: isNoticeCurrent(staleNotice, lastActivity), now: NOW });
    expect(action).toBe("notice");
  });
});

describe("hesap-yalnız korkuluğu — hasAuraTies (fail-closed)", () => {
  const zero: AuraTies = { ownedRecords: 0, actionTraces: 0, partnerTraces: 0, auditClinical: 0 };

  it("hiç bağ yok → silinebilir", () => {
    expect(hasAuraTies(zero)).toBe(false);
  });

  it("her sayaç tek başına bağdır", () => {
    for (const k of Object.keys(zero) as (keyof AuraTies)[]) {
      expect(hasAuraTies({ ...zero, [k]: 1 }), k).toBe(true);
    }
  });

  it("denetim zinciri deny-list'i yalnız hesabın KENDİ kayıt tiplerini dışlar; klinik tipler bağ sayılır", () => {
    const list: readonly string[] = AURA_NON_CLINICAL_RESOURCE_TYPES;
    for (const own of ["User", "SYSTEM", "KvkkApplication", "STAFF_APPLICATION"]) expect(list).toContain(own);
    for (const clinical of ["CASE", "CASE_DOCUMENT", "CONSULTATION", "RECOVERY", "COMPLAINT", "Patient", "DOCTOR"]) {
      expect(list, clinical).not.toContain(clinical);
    }
  });
});

describe("ret imhası — 90 gün itiraz penceresi (A06 3.16 · A10 madde 6)", () => {
  it("pencere Doctorium diploma ret penceresiyle (doc-purge) AYNI", () => {
    expect(STAFF_APPLICATION_REJECTED_RETENTION_DAYS).toBe(90);
    expect(STAFF_APPLICATION_REJECTED_RETENTION_DAYS).toBe(REJECTED_RETENTION_DAYS);
  });

  it("reviewedAt yoksa ASLA (fail-closed); 89 gün → hayır; 90 gün → evet", () => {
    expect(rejectedApplicationPurgeDue(null, NOW)).toBe(false);
    expect(rejectedApplicationPurgeDue(undefined, NOW)).toBe(false);
    expect(rejectedApplicationPurgeDue(new Date(NOW.getTime() - 89 * DAY_MS), NOW)).toBe(false);
    expect(rejectedApplicationPurgeDue(new Date(NOW.getTime() - 90 * DAY_MS), NOW)).toBe(true);
  });
});

describe("bildirim e-postası (TR kanonik / EN ikinci kanonik)", () => {
  const purgeDate = new Date("2029-09-18T00:00:00.000Z");

  it("TR: konu 30 gün, gövde imha tarihi + giriş bağlantısı + dayanak satırı; HTML kaçışlı", () => {
    const m = renderAuraAbandonedNoticeEmail({ name: "Ayşe <Test>", purgeDateLabel: "18 Eylül 2029", loginUrl: `${AURA_CANONICAL_URL}/giris`, lang: "tr" });
    expect(m.subject).toBe("AURA hesabınız 30 gün içinde silinecek");
    expect(m.text).toContain("18 Eylül 2029");
    expect(m.text).toContain(`${AURA_CANONICAL_URL}/giris`);
    expect(m.text).toContain("üç yıl kuralı");
    expect(m.html).toContain("Ayşe &lt;Test&gt;");
    expect(m.html).not.toContain("<Test>");
  });

  it("EN: konu ve gövde İngilizce, tarih EN biçiminde", () => {
    const label = formatDateEn(purgeDate);
    expect(label).toBe("18 September 2029");
    const m = renderAuraAbandonedNoticeEmail({ name: "John", purgeDateLabel: label, loginUrl: `${AURA_CANONICAL_URL}/giris`, lang: "en" });
    expect(m.subject).toBe("Your AURA account will be deleted in 30 days");
    expect(m.text).toContain("18 September 2029");
    expect(m.text).toContain("Sign in");
    expect(m.text).not.toContain("Giriş");
  });

  it("terim kuralı: e-posta metinlerinde 'hekim' geçmez", () => {
    for (const lang of ["tr", "en"] as const) {
      const m = renderAuraAbandonedNoticeEmail({ name: "X", purgeDateLabel: "d", loginUrl: "u", lang });
      expect(`${m.subject}${m.text}${m.html}`.toLocaleLowerCase("tr")).not.toContain("hekim");
    }
  });
});
