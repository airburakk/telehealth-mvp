// Kariyer EDU hatırlatması (E2) — saf eşik mantığı + e-posta şablonu. DB'siz.
import { describe, it, expect } from "vitest";
import { EDU_ALERT_THRESHOLDS, daysUntilUtc, dueEduAlert, parseSentAlerts, renderEduDeadlineEmail } from "@/lib/edu-reminder";
import { DOCTORIUM_NOTIFICATION_TYPES } from "@/lib/notify";

const D = (s: string) => new Date(`${s}T00:00:00Z`);
const now = D("2026-10-01");

describe("edu-reminder", () => {
  it("eşikler 7/3/1; gün farkı UTC gün başına göre", () => {
    expect([...EDU_ALERT_THRESHOLDS]).toEqual([7, 3, 1]);
    expect(daysUntilUtc(D("2026-10-08"), now)).toBe(7);
    expect(daysUntilUtc(new Date("2026-10-08T23:59:00Z"), new Date("2026-10-01T00:10:00Z"))).toBe(7);
    expect(daysUntilUtc(D("2026-09-30"), now)).toBe(-1);
  });
  it("dueEduAlert: uzak → yok; 7 gün → '7'; 5 gün (7 gitti) → yok; 3 → '3'; 2 (3 gitti) → yok; 1 ve 0 → '1'; geçmiş → yok", () => {
    const none = new Set<string>();
    expect(dueEduAlert(D("2026-10-20"), none, now)).toBeNull();
    expect(dueEduAlert(D("2026-10-08"), none, now)).toEqual({ key: "7", daysLeft: 7, markKeys: ["7"] });
    expect(dueEduAlert(D("2026-10-06"), new Set(["7"]), now)).toBeNull();
    expect(dueEduAlert(D("2026-10-04"), new Set(["7"]), now)).toEqual({ key: "3", daysLeft: 3, markKeys: ["3", "7"] });
    expect(dueEduAlert(D("2026-10-03"), new Set(["3", "7"]), now)).toBeNull();
    expect(dueEduAlert(D("2026-10-02"), new Set(["3", "7"]), now)).toEqual({ key: "1", daysLeft: 1, markKeys: ["1", "3", "7"] });
    expect(dueEduAlert(D("2026-10-01"), none, now)).toEqual({ key: "1", daysLeft: 0, markKeys: ["1", "3", "7"] });
    expect(dueEduAlert(D("2026-09-30"), none, now)).toBeNull();
    // 2 gün kala takip başlayan: "7" değil, en sıkı uygulanabilir eşik "3" gider ve "7" de işaretlenir.
    expect(dueEduAlert(D("2026-10-03"), none, now)).toEqual({ key: "3", daysLeft: 2, markKeys: ["3", "7"] });
  });
  it("parseSentAlerts bozuk JSON'da boş küme", () => {
    expect([...parseSentAlerts('["7","3"]')]).toEqual(["7", "3"]);
    expect(parseSentAlerts("{").size).toBe(0);
    expect(parseSentAlerts("[1, null, \"x\"]").size).toBe(1);
  });
  it("e-posta şablonu: konu gün sayısını taşır, HTML kaçışlı, 'hekim' yok, ilan dili yok", () => {
    const m = renderEduDeadlineEmail({ name: "Ayşe <Test>", title: "TEV Üniversite Bursu & Destek", organizer: "TEV", daysLeft: 3, deadline: D("2026-10-08"), sourceUrl: "https://www.tev.org.tr/", kariyerUrl: "https://doctorium.tr/doktor/doctorium/kariyer-edu" });
    expect(m.subject).toContain("3 gün kaldı");
    expect(m.html).toContain("&lt;Test&gt;"); expect(m.html).toContain("&amp; Destek");
    expect(m.text).toContain("8 Ekim 2026"); expect(m.text).toContain("süreç bilgisidir");
    for (const w of ["hekim", "ilan değil".replace("ilan değil", "işe alım"), "pozisyon", "maaş"]) expect(m.text.toLocaleLowerCase("tr-TR").includes(w), w).toBe(false);
    const m0 = renderEduDeadlineEmail({ name: "A", title: "T", organizer: "O", daysLeft: 0, deadline: D("2026-10-01"), sourceUrl: "https://x.gov.tr/", kariyerUrl: "https://doctorium.tr/x" });
    expect(m0.subject).toContain("bugün son gün");
  });
  it("EDU_DEADLINE Doctorium bildirim tipleri arasında (zilde görünür)", () => {
    expect([...DOCTORIUM_NOTIFICATION_TYPES]).toContain("EDU_DEADLINE");
  });
});
