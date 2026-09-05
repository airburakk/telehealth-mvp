// Deneme süpürmesi — saf sözleşmeler (üç katman Faz A4, 2026-09-05). DB-bağlı sweepTrials burada koşmaz (vitest DB-siz);
// kilitlenenler: doğrulama bağlantısı Doctorium kanonik kökünden kurulur (cron AURA projesinde koşar) ve kilit ekranı
// parametresini taşır; bildirim tipleri Doctorium zil allow-list'inde (aksi hâlde portalda hiç görünmez, fail-closed).
import { describe, it, expect } from "vitest";
import { trialVerifyUrl, TRIAL_VERIFY_PATH } from "@/lib/trial-sweep";
import { DOCTORIUM_CANONICAL_URL } from "@/lib/brand";
import { DOCTORIUM_NOTIFICATION_TYPES } from "@/lib/notify";
import { CRON_SCHEDULES } from "@/lib/cron-guard";

describe("trial-sweep bağlantıları", () => {
  it("doğrulama URL'si Doctorium kanonik kökünden; 'süre doldu' varyantı kilit parametresini taşır", () => {
    expect(trialVerifyUrl(false)).toBe(`${DOCTORIUM_CANONICAL_URL}${TRIAL_VERIFY_PATH}`);
    expect(trialVerifyUrl(true)).toBe(`${DOCTORIUM_CANONICAL_URL}${TRIAL_VERIFY_PATH}&trial=ended`);
    expect(TRIAL_VERIFY_PATH).toContain("from=doctorium");
  });
});

describe("bildirim tipleri Doctorium zilinde görünür (fail-closed allow-list)", () => {
  it("TRIAL_REMINDER · TRIAL_ENDED · TRIAL_PURGE_NOTICE listede", () => {
    const types: readonly string[] = DOCTORIUM_NOTIFICATION_TYPES;
    for (const t of ["TRIAL_REMINDER", "TRIAL_ENDED", "TRIAL_PURGE_NOTICE"]) expect(types).toContain(t);
  });
});

describe("cron kaydı", () => {
  it("/api/cron/trial-sweep günlük sabit saatte kayıtlı", () => {
    expect(CRON_SCHEDULES["/api/cron/trial-sweep"]).toMatch(/^\d{1,2} \d{1,2} \* \* \*$/);
  });
});
