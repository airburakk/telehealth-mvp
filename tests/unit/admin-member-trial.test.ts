import { describe, expect, it } from "vitest";
import { memberTrialRow, type MemberTrialInput } from "@/lib/admin-member-trial";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-10-06T09:00:00Z");
const base: MemberTrialInput = {
  diplomaVerifiedAt: null,
  studentVerifiedAt: null,
  doctoriumOptOutAt: null,
  trialEndsAt: null,
  trialAlertsSent: null,
};

describe("memberTrialRow — Üye Analitiği e-Devlet + deneme kolonları", () => {
  it("diploma doğrulanmışsa e-Devlet 'Onaylı', deneme 'Gerek kalmadı', uyarı kutusuna girmez", () => {
    const r = memberTrialRow(
      { ...base, diplomaVerifiedAt: new Date(NOW.getTime() - DAY), trialEndsAt: new Date(NOW.getTime() + 2 * DAY) },
      NOW,
    );
    expect(r.diploma.text).toBe("Onaylı");
    expect(r.diploma.tone).toBe("ok");
    expect(r.trial.text).toBe("Gerek kalmadı");
    expect(r.needsAttention).toBeNull();
  });

  it("deneme yolu dışındaki hesapta deneme kolonu boş, uyarı yok", () => {
    const r = memberTrialRow(base, NOW);
    expect(r.diploma.text).toBe("Paylaşılmadı");
    expect(r.trial.text).toBe("—");
    expect(r.alert.text).toBe("—");
    expect(r.needsAttention).toBeNull();
  });

  it("denemede kalan gün yukarı yuvarlanır; 7 gün ve altı uyarı kutusuna girer", () => {
    const far = memberTrialRow({ ...base, trialEndsAt: new Date(NOW.getTime() + 20 * DAY) }, NOW);
    expect(far.trial.text).toBe("20 gün kaldı");
    expect(far.trial.tone).toBe("ok");
    expect(far.needsAttention).toBeNull();
    expect(far.alert.text).toBe("Henüz gönderilmedi");

    const near = memberTrialRow({ ...base, trialEndsAt: new Date(NOW.getTime() + 2.5 * DAY) }, NOW);
    expect(near.trial.text).toBe("3 gün kaldı");
    expect(near.trial.tone).toBe("warning");
    expect(near.needsAttention).toBe("ending");
  });

  it("son uyarı = kümedeki EN İLERİ anahtar (geç işaretlenen eşikler sayılmaz)", () => {
    const r = memberTrialRow(
      { ...base, trialEndsAt: new Date(NOW.getTime() + 2 * DAY), trialAlertsSent: JSON.stringify(["3", "7"]) },
      NOW,
    );
    expect(r.alert.text).toBe("3 gün kala uyarısı");
  });

  it("süresi dolan hesap: imhaya kalan gün + silinme bildirimi tarihi", () => {
    const endsAt = new Date(NOW.getTime() - 70 * DAY);
    const r = memberTrialRow(
      {
        ...base,
        trialEndsAt: endsAt,
        trialAlertsSent: JSON.stringify(["1", "3", "7", "ended", "purge-notice", "purge-notice@2026-10-05"]),
      },
      NOW,
    );
    expect(r.trial.text).toBe("Süre doldu");
    expect(r.trial.sub).toMatch(/^silinmesine 20 gün/);
    expect(r.alert.text).toBe("Silinme bildirimi");
    expect(r.alert.sub).toMatch(/^gönderildi/);
    expect(r.needsAttention).toBe("locked");
  });

  it("üyeliğini kapatan hesap deneme uyarısına girmez", () => {
    const r = memberTrialRow(
      { ...base, doctoriumOptOutAt: NOW, trialEndsAt: new Date(NOW.getTime() - DAY) },
      NOW,
    );
    expect(r.trial.text).toBe("Üyelik kapatıldı");
    expect(r.needsAttention).toBeNull();
  });
});
