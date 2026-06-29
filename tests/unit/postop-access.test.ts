// Birim testleri — lib/postop-access.ts (E2EE Faz 2A post-op erişim daraltma). recoveryClosed/autoCloseDays saf.
import { describe, it, expect, vi } from "vitest";

// Modül import zinciri db'yi çeker (caseRecoveryClosed kullanır) → mock; saf fonksiyonlar db'ye dokunmaz.
vi.mock("@/lib/db", () => ({ db: { recovery: { findUnique: vi.fn() } } }));

import { autoCloseDays, recoveryClosed } from "@/lib/postop-access";

const DAY = 86_400_000;

describe("autoCloseDays", () => {
  it("branş protokolü + tampon (30 gün) döner", () => {
    expect(autoCloseDays("Saç Ekimi")).toBe(210); // 180 + 30
    expect(autoCloseDays("Onkoloji")).toBe(60); //   30 + 30
    expect(autoCloseDays("Ortopedi")).toBe(72); //   42 + 30
  });
  it("eşleşmeyen branş → varsayılan protokol (90) + tampon", () => {
    expect(autoCloseDays("Dermatoloji")).toBe(120); // 90 + 30
  });
});

describe("recoveryClosed", () => {
  it("status COMPLETED → manuel kapalı", () => {
    const r = recoveryClosed({ status: "COMPLETED", startedAt: new Date(), branch: "Onkoloji" });
    expect(r).toEqual({ closed: true, reason: "MANUAL" });
  });

  it("ACTIVE + süre dolmamış → açık", () => {
    const r = recoveryClosed({ status: "ACTIVE", startedAt: new Date(), branch: "Onkoloji" });
    expect(r.closed).toBe(false);
  });

  it("ACTIVE + süre+tampon aşıldı → otomatik kapalı", () => {
    const r = recoveryClosed({
      status: "ACTIVE",
      startedAt: new Date(Date.now() - 365 * DAY), // 1 yıl önce (Onkoloji eşiği 60 gün)
      branch: "Onkoloji",
    });
    expect(r).toEqual({ closed: true, reason: "AUTO" });
  });

  it("reopenedAt otomatik kapanma penceresini sıfırdan başlatır", () => {
    const r = recoveryClosed({
      status: "ACTIVE",
      startedAt: new Date(Date.now() - 365 * DAY), // eski
      reopenedAt: new Date(), // ama yeniden açıldı → pencere şimdiden sayılır
      branch: "Onkoloji",
    });
    expect(r.closed).toBe(false);
  });
});
