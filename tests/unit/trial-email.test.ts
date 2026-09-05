// Deneme e-posta şablonları + §2b metin sabitleri sözleşmesi (üç katman Faz A3, 2026-09-05).
// Kilitlenenler: her şablon konu/metin/HTML üretir, bağlantıyı taşır, §2b altbilgisini eksik bırakmaz,
// HTML kaçışı yapar, "hekim" yazmaz; kanonik metin "ücretli üyelik başlamaz" olumsuzlamasını içerir.
import { describe, it, expect } from "vitest";
import {
  renderLoginLinkEmail, renderExistingAccountEmail, renderTrialReminderEmail,
  renderTrialEndedEmail, renderTrialPurgeNoticeEmail, escapeHtml,
} from "@/lib/trial-email";
import {
  TRIAL_PROMISE, TRIAL_PROMISE_PARAGRAPHS, TRIAL_PROMISE_SHORT, TRIAL_LOCKED_NOTE, TRIAL_LOCKED_TITLE,
  TRIAL_EMAIL_FOOTER, TRIAL_STEPS, trialBadgeLabel, trialBadgeShort, trialBadgeTitle,
} from "@/lib/doctorium-trial-copy";

const NAME = 'Ayşe <b>"Yılmaz"</b>';
const LINK = "https://doctorium.tr/api/auth/verify-login-link?uid=u1&token=abc";
const VERIFY = "https://doctorium.tr/doktor/baslangic?from=doctorium";

const ALL = [
  renderLoginLinkEmail({ name: NAME, link: LINK, ttlMinutes: 20 }),
  renderExistingAccountEmail({ name: NAME, loginUrl: "https://doctorium.tr/doctorium/giris", resetUrl: "https://doctorium.tr/sifremi-unuttum" }),
  renderTrialReminderEmail({ name: NAME, daysLeft: 7, endsAtLabel: "5 Ekim 2026", verifyUrl: VERIFY }),
  renderTrialReminderEmail({ name: NAME, daysLeft: 1, endsAtLabel: "5 Ekim 2026", verifyUrl: VERIFY }),
  renderTrialEndedEmail({ name: NAME, verifyUrl: VERIFY }),
  renderTrialPurgeNoticeEmail({ name: NAME, purgeDateLabel: "3 Ocak 2027", verifyUrl: VERIFY }),
];

describe("deneme e-postaları", () => {
  it("her şablon konu + metin + HTML üretir ve §2b altbilgisini taşır", () => {
    for (const m of ALL) {
      expect(m.subject.length).toBeGreaterThan(8);
      expect(m.text).toContain(TRIAL_EMAIL_FOOTER);
      expect(m.html).toContain(escapeHtml(TRIAL_EMAIL_FOOTER));
    }
  });
  it("bağlantı/URL hem metinde hem HTML'de", () => {
    expect(ALL[0].text).toContain(LINK);
    expect(ALL[0].html).toContain(escapeHtml(LINK));
    expect(ALL[1].text).toContain("/sifremi-unuttum");
    for (const m of ALL.slice(2)) expect(m.text).toContain(VERIFY);
  });
  it("HTML kaçışı: ad içindeki < > \" ham geçmez", () => {
    for (const m of ALL) {
      expect(m.html).not.toContain("<b>");
      expect(m.html).toContain("&lt;b&gt;");
    }
  });
  it("giriş bağlantısı e-postası TTL'i söyler; mevcut-hesap e-postası token taşımaz", () => {
    expect(ALL[0].text).toContain("20 dakika");
    expect(ALL[1].text).not.toContain("token=");
  });
  it("hatırlatma tekil/çoğul günü doğru yazar; imha bildirimi tarihi taşır", () => {
    expect(ALL[2].subject).toContain("7 gün");
    expect(ALL[3].subject).toContain("1 gün");
    expect(ALL[5].text).toContain("3 Ocak 2027");
  });
  it("hiçbir şablonda 'hekim' geçmez (terim kuralı)", () => {
    for (const m of ALL) expect((m.subject + m.text).toLocaleLowerCase("tr")).not.toContain("hekim");
  });
});

describe("§2b deneme mesajı sabitleri", () => {
  it("kanonik metin üç paragraf; 'ücretli bir üyelik başlamaz' ve 'ücretsizdir' geçer; .edu.tr ve Mezun Belgesi anılır", () => {
    expect(TRIAL_PROMISE_PARAGRAPHS).toHaveLength(3);
    expect(TRIAL_PROMISE).toContain("ücretli bir üyelik başlamaz");
    expect(TRIAL_PROMISE).toContain("ücretsizdir");
    expect(TRIAL_PROMISE).toContain(".edu.tr");
    expect(TRIAL_PROMISE).toContain("Mezun Belgesi");
    expect(TRIAL_PROMISE).toContain("30 günlük");
  });
  it("kısa hâller olumsuzlamayı korur; adımlar 3; 'hekim' yok", () => {
    expect(TRIAL_PROMISE_SHORT).toContain("dönüşmez");
    expect(TRIAL_LOCKED_NOTE).toContain("ücret istenmez");
    expect(TRIAL_LOCKED_TITLE.length).toBeGreaterThan(5);
    expect(TRIAL_STEPS).toHaveLength(3);
    const all = [TRIAL_PROMISE, TRIAL_PROMISE_SHORT, TRIAL_LOCKED_NOTE, TRIAL_EMAIL_FOOTER, ...TRIAL_STEPS.map((s) => s.title + s.body)].join(" ");
    expect(all.toLocaleLowerCase("tr")).not.toContain("hekim");
  });
  it("Header rozeti metinleri", () => {
    expect(trialBadgeLabel(23)).toBe("DENEME · 23 GÜN");
    expect(trialBadgeShort(23)).toBe("23 g");
    expect(trialBadgeTitle("5 Ekim 2026")).toContain("5 Ekim 2026");
    expect(trialBadgeTitle("5 Ekim 2026")).toContain(TRIAL_PROMISE_SHORT);
  });
});
