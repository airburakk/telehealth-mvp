// Birim — lib/postop.ts ölçüm güncelliği (kontrol raporu 2026-09-19 D01).
// Sözleşme: "Stabil" YALNIZ güncel ölçümde; ölçüm yokken "Ölçüm yok", eskiyken "Ölçüm gecikti (N gün)"; alarm/izlem
// bulgusu eskise gizlenmez, yaşı eklenir. Eşik tek sabitten (STALE_AFTER_DAYS — 👤 klinik onayı bekleyen yer tutucu).
import { describe, it, expect } from "vitest";
import { measurementState, measurementAgeDays, recoveryStatusMeta, severityMeta, STALE_AFTER_DAYS } from "@/lib/postop";

const NOW = new Date("2026-09-19T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

describe("measurementState", () => {
  it("ölçüm yok → NO_DATA; eşik içinde → CURRENT; eşik aşıldı → STALE", () => {
    expect(measurementState(null, NOW)).toBe("NO_DATA");
    expect(measurementState(undefined, NOW)).toBe("NO_DATA");
    expect(measurementState(daysAgo(0), NOW)).toBe("CURRENT");
    expect(measurementState(daysAgo(STALE_AFTER_DAYS), NOW)).toBe("CURRENT"); // tam eşik hâlâ güncel
    expect(measurementState(daysAgo(STALE_AFTER_DAYS + 0.5), NOW)).toBe("STALE");
    expect(measurementState(daysAgo(60).toISOString(), NOW)).toBe("STALE"); // ISO string de kabul
  });

  it("ölçüm yaşı tam gün, negatif değil", () => {
    expect(measurementAgeDays(daysAgo(4.9), NOW)).toBe(4);
    expect(measurementAgeDays(new Date(NOW.getTime() + 60_000), NOW)).toBe(0);
  });
});

describe("recoveryStatusMeta — 'Stabil' yalnız güncel ölçümde", () => {
  it("ölçüm yokken 'Stabil' YAZMAZ → 'Ölçüm yok', nötr ton, measured:false", () => {
    const m = recoveryStatusMeta("NONE", "NO_DATA", null);
    expect(m.label).toBe("Ölçüm yok");
    expect(m.label).not.toMatch(/stabil/i);
    expect(m.measured).toBe(false);
    expect(m.tone).not.toBe(severityMeta("NONE").tone); // yeşil başarı tonu kullanılmaz
  });

  it("eski ölçümde 'Stabil' YAZMAZ → 'Ölçüm gecikti (N gün)', uyarı tonu", () => {
    const m = recoveryStatusMeta("NONE", "STALE", 12);
    expect(m.label).toBe("Ölçüm gecikti (12 gün)");
    expect(m.measured).toBe(false);
    expect(m.tone).toBe("var(--c-warning)");
  });

  it("güncel normal ölçüm → severityMeta ile birebir ('Stabil')", () => {
    expect(recoveryStatusMeta("NONE", "CURRENT", 1)).toEqual({ ...severityMeta("NONE"), measured: true });
  });

  it("alarm/izlem bulgusu eski olsa da GİZLENMEZ; yaşı etikete eklenir", () => {
    const red = recoveryStatusMeta("RED", "STALE", 5);
    expect(red.label).toBe("Alarm bulgusu · 5 gün önce");
    expect(red.tone).toBe(severityMeta("RED").tone);
    expect(recoveryStatusMeta("WATCH", "CURRENT", 0).label).toBe("Yakın izlem");
  });
});
