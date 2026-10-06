import { describe, expect, it } from "vitest";
import {
  BRANCH_REMINDER_TYPE,
  branchReminderBody,
  branchReminderDue,
  greetingName,
  renderBranchReminderEmail,
} from "@/lib/branch-reminder-copy";
import { DOCTORIUM_NOTIFICATION_TYPES } from "@/lib/notify";
import { SELECTABLE_SPECIALTY_BRANCHES } from "@/lib/specialty-branch";
import { memberTrialRow } from "@/lib/admin-member-trial";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-10-06T07:20:00Z");

describe("branş uyarısı — gönderim kuralı (bir kez + 14 gün sonra bir hatırlatma)", () => {
  it("hiç gitmediyse gider", () => {
    expect(branchReminderDue({ sentCount: 0, lastSentAt: null, now: NOW })).toBe(true);
  });
  it("ilk uyarıdan 14 gün geçmeden hatırlatma gitmez, 14. günde gider", () => {
    expect(branchReminderDue({ sentCount: 1, lastSentAt: new Date(NOW.getTime() - 13 * DAY), now: NOW })).toBe(false);
    expect(branchReminderDue({ sentCount: 1, lastSentAt: new Date(NOW.getTime() - 14 * DAY), now: NOW })).toBe(true);
  });
  it("iki kez gittiyse bir daha gitmez", () => {
    expect(branchReminderDue({ sentCount: 2, lastSentAt: new Date(NOW.getTime() - 90 * DAY), now: NOW })).toBe(false);
  });
});

describe("branş uyarısı — metin (👤 onaylı)", () => {
  it("bildirim gövdesi kayıttaki branşı anar", () => {
    expect(branchReminderBody("Diğer (Sınıflandırılmamış)")).toContain("“Diğer (Sınıflandırılmamış)” olarak kaydedildi");
  });
  it("hitap: doktora Dr., öğrenciye yalnız ad, unvan tekrarlanmaz", () => {
    expect(greetingName("Ayşe Yılmaz", false)).toBe("Dr. Ayşe Yılmaz");
    expect(greetingName("Dr. Ayşe Yılmaz", false)).toBe("Dr. Ayşe Yılmaz");
    expect(greetingName("Ayşe Yılmaz", true)).toBe("Ayşe Yılmaz");
  });
  it("e-posta: konu, düğme, bağlantı; HTML kaçışlı; 'hekim' geçmez", () => {
    const m = renderBranchReminderEmail({ name: "<b>X</b>", isStudent: false, branchLabel: "Diğer (Sınıflandırılmamış)", url: "https://doctorium.tr/doktor/doctorium/tercihler#brans" });
    expect(m.subject).toBe("Doctorium — branşınızı seçer misiniz?");
    expect(m.text).toContain("Branşlarımı seç: https://doctorium.tr/doktor/doctorium/tercihler#brans");
    expect(m.html).not.toContain("<b>X</b>");
    expect(`${m.text}${m.html}`.toLowerCase()).not.toContain("hekim");
  });
  it("yeni tür Doctorium zilinde görünür listede (yoksa bildirim sessizce kaybolur)", () => {
    expect(DOCTORIUM_NOTIFICATION_TYPES).toContain(BRANCH_REMINDER_TYPE);
  });
});

describe("uzmanlık branşı seçenekleri", () => {
  it("'Diğer (Sınıflandırılmamış)' seçilemez; liste dolu ve Türkçe sıralı", () => {
    expect(SELECTABLE_SPECIALTY_BRANCHES).not.toContain("Diğer (Sınıflandırılmamış)");
    expect(SELECTABLE_SPECIALTY_BRANCHES.length).toBeGreaterThan(20);
    expect(SELECTABLE_SPECIALTY_BRANCHES).toContain("Kardiyoloji");
    const sorted = [...SELECTABLE_SPECIALTY_BRANCHES].sort((a, b) => a.localeCompare(b, "tr"));
    expect(SELECTABLE_SPECIALTY_BRANCHES).toEqual(sorted);
  });
});

describe("pano — branş uyarısı durumu", () => {
  const base = {
    diplomaVerifiedAt: null, studentVerifiedAt: null, doctoriumOptOutAt: null, trialAlertsSent: null,
    trialEndsAt: new Date(NOW.getTime() + 20 * DAY), branch: "Diğer (Sınıflandırılmamış)",
  };
  it("henüz gitmediyse ilk gönderim saatini yazar", () => {
    expect(memberTrialRow(base, NOW).branch?.sub).toBe("uyarı henüz gitmedi · ilk gönderim 10:20");
  });
  it("gittiyse tarih + sayaç", () => {
    const r = memberTrialRow({ ...base, branchReminder: { count: 1, last: new Date("2026-10-07T07:20:00Z") } }, NOW);
    expect(r.branch?.sub).toMatch(/^uyarı gitti · .*\(1\/2\)$/);
  });
  it("akış branşı seçen için uyarı gerekmez", () => {
    expect(memberTrialRow({ ...base, feedBranches: true }, NOW).branch?.sub).toBe("akış branşı seçilmiş — uyarı gerekmiyor");
  });
  it("süresi dolmuş denemede portal kapalı — uyarı gitmez", () => {
    const r = memberTrialRow({ ...base, trialEndsAt: new Date(NOW.getTime() - DAY) }, NOW);
    expect(r.branch?.sub).toBe("portal kapalı — uyarı gitmez");
  });
});
