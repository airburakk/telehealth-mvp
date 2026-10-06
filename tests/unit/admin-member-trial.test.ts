import { describe, expect, it } from "vitest";
import { branchIssue, memberTrialRow, type MemberTrialInput } from "@/lib/admin-member-trial";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-10-06T09:00:00Z");
const base: MemberTrialInput = {
  diplomaVerifiedAt: null,
  studentVerifiedAt: null,
  doctoriumOptOutAt: null,
  trialEndsAt: null,
  trialAlertsSent: null,
  branch: "Kardiyoloji",
};

describe("memberTrialRow — Üye Analitiği e-Devlet + deneme + uyarı hücreleri", () => {
  it("diploma doğrulanmışsa e-Devlet 'Onaylı', deneme 'Süre durdu', dikkat kutusuna girmez", () => {
    const r = memberTrialRow(
      { ...base, diplomaVerifiedAt: new Date(NOW.getTime() - DAY), trialEndsAt: new Date(NOW.getTime() + 2 * DAY) },
      NOW,
    );
    expect(r.diploma.text).toBe("Onaylı");
    expect(r.diploma.tone).toBe("ok");
    expect(r.trial.text).toBe("Süre durdu");
    expect(r.alert.text).toBe("—");
    expect(r.reasons).toEqual([]);
  });

  it("deneme yolu dışındaki hesap: 'Deneme yok', belge paylaşılmadıysa kırmızı", () => {
    const r = memberTrialRow(base, NOW);
    expect(r.diploma).toMatchObject({ text: "Paylaşılmadı", tone: "danger" });
    expect(r.trial.text).toBe("Deneme yok");
    expect(r.reasons).toEqual([]);
  });

  it("işleyen deneme HER ZAMAN dikkat kutusuna girer (canlıdaki 20+ gün kalan hesaplar görünmüyordu)", () => {
    const far = memberTrialRow({ ...base, trialEndsAt: new Date(NOW.getTime() + 21 * DAY) }, NOW);
    expect(far.trial).toMatchObject({ text: "21 gün kaldı", tone: "info" });
    expect(far.reasons).toEqual(["trial"]);
    expect(far.daysLeft).toBe(21);
    expect(far.alert.text).toBe("Henüz uyarı gitmedi");
    expect(far.alert.sub).toMatch(/^sıradaki: 7 gün kala uyarısı · /);

    const near = memberTrialRow({ ...base, trialEndsAt: new Date(NOW.getTime() + 2.5 * DAY) }, NOW);
    expect(near.trial).toMatchObject({ text: "3 gün kaldı", tone: "warning" });
    expect(near.reasons).toEqual(["ending"]);
  });

  it("son uyarı = kümedeki EN İLERİ anahtar (geç işaretlenen eşikler sayılmaz) + sıradaki eşik", () => {
    const r = memberTrialRow(
      { ...base, trialEndsAt: new Date(NOW.getTime() + 2 * DAY), trialAlertsSent: JSON.stringify(["3", "7"]) },
      NOW,
    );
    expect(r.alert.text).toBe("3 gün kala uyarısı gitti");
    expect(r.alert.sub).toMatch(/^sıradaki: 1 gün kala uyarısı/);
  });

  it("süresi dolan hesap: imhaya kalan gün + silinme bildirimi tarihi", () => {
    const r = memberTrialRow(
      {
        ...base,
        trialEndsAt: new Date(NOW.getTime() - 70 * DAY),
        trialAlertsSent: JSON.stringify(["1", "3", "7", "ended", "purge-notice", "purge-notice@2026-10-05"]),
      },
      NOW,
    );
    expect(r.trial.text).toBe("Süre doldu · portal kapalı");
    expect(r.trial.sub).toMatch(/^silinmesine 20 gün/);
    expect(r.alert.text).toBe("Silinme bildirimi gitti");
    expect(r.reasons).toEqual(["locked"]);
  });

  it("üyeliğini kapatan hesap deneme uyarısına girmez", () => {
    const r = memberTrialRow({ ...base, doctoriumOptOutAt: NOW, trialEndsAt: new Date(NOW.getTime() - DAY) }, NOW);
    expect(r.trial.text).toBe("Üyelik kapatıldı");
    expect(r.reasons).toEqual([]);
  });

  it("deneme + sınıflandırılmamış branş: iki gerekçe birden", () => {
    const r = memberTrialRow(
      { ...base, branch: "Diğer (Sınıflandırılmamış)", trialEndsAt: new Date(NOW.getTime() + 21 * DAY) },
      NOW,
    );
    expect(r.reasons).toEqual(["trial", "branch"]);
    expect(r.branch?.text).toBe("Branş sınıflandırılmamış");
  });
});

describe("branchIssue — branş sınıflandırması (canlıda görülen değerler)", () => {
  it("geçerli branş → işaret yok", () => {
    expect(branchIssue("Kardiyoloji")).toBeNull();
  });
  it("'Diğer (Sınıflandırılmamış)' → sınıflandırılmamış", () => {
    expect(branchIssue("Diğer (Sınıflandırılmamış)")).toMatchObject({ text: "Branş sınıflandırılmamış", tone: "warning" });
  });
  it("listede olmayan değer (eski öğrenci kaydı 'Tıp Fakültesi') → listede yok", () => {
    expect(branchIssue("Tıp Fakültesi")).toMatchObject({ text: "Branş listede yok", sub: "Tıp Fakültesi" });
  });
  it("boş → seçilmemiş", () => {
    expect(branchIssue("  ")?.text).toBe("Branş seçilmemiş");
    expect(branchIssue(null)?.text).toBe("Branş seçilmemiş");
  });
});
