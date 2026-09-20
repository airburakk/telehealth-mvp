// Birim — vaka merkezi üst bandı (kontrol raporu 2026-09-17 H01, v6.283): tamamlanmış başvuruda "kuyruğa eklendi"
// yazmaz; her durum kendi cümlesini taşır; çeviri listesi sözlüğün tamamını kapsar.
import { describe, it, expect } from "vitest";
import { caseHubBand, CASE_HUB_BAND, CASE_HUB_BAND_TEXTS, CASE_HUB_BAND_RECOVERY_SUB } from "@/lib/patient-cases";
import { CASE_STATUS } from "@/lib/constants";

describe("caseHubBand", () => {
  it("NEW/IN_REVIEW/IN_CONSULT/DONE ayrı cümle; DONE'da 'kuyruk' geçmez", () => {
    expect(caseHubBand("NEW", { hasRecovery: false }).title).toMatch(/eşleşmesi bekleniyor/);
    expect(caseHubBand("IN_REVIEW", { hasRecovery: false }).title).toMatch(/inceliyor/);
    expect(caseHubBand("IN_CONSULT", { hasRecovery: false }).title).toMatch(/Görüşme yapıldı/);
    const done = caseHubBand("DONE", { hasRecovery: false });
    expect(done.title).toMatch(/tamamlandı/);
    expect(done.tone).toBe("done");
    expect(`${done.title} ${done.sub}`).not.toMatch(/kuyru/);
  });
  it("takip açıkken DONE alt cümlesi takibe yönlendirir", () => {
    expect(caseHubBand("DONE", { hasRecovery: true }).sub).toBe(CASE_HUB_BAND_RECOVERY_SUB);
    expect(caseHubBand("DONE", { hasRecovery: false }).sub).not.toBe(CASE_HUB_BAND_RECOVERY_SUB);
  });
  it("bilinmeyen/DOCS_PENDING durum güvenli varsayılana (NEW) düşer; CASE_STATUS'un açık durumları sözlükte", () => {
    expect(caseHubBand("YOK", { hasRecovery: false })).toEqual(CASE_HUB_BAND.NEW);
    for (const s of Object.keys(CASE_STATUS).filter((k) => k !== "DOCS_PENDING")) expect(CASE_HUB_BAND[s], s).toBeDefined();
  });
  it("çeviri listesi tüm cümleleri taşır", () => {
    for (const b of Object.values(CASE_HUB_BAND)) {
      expect(CASE_HUB_BAND_TEXTS).toContain(b.title);
      expect(CASE_HUB_BAND_TEXTS).toContain(b.sub);
    }
    expect(CASE_HUB_BAND_TEXTS).toContain(CASE_HUB_BAND_RECOVERY_SUB);
  });
});
