// Birim — lib/capacity-period (kontrol raporu 2026-09-17 D08, v6.284): kapasite dönemi Türkiye takvim ayı; sayı yalnız
// dönemde biten görüşmeler; aşım etiketlenir, sıfır kapasite bölme hatası üretmez.
import { describe, it, expect } from "vitest";
import { capacityPeriod, capacityUsage } from "@/lib/capacity-period";

const NOW = new Date("2026-09-20T01:00:00.000Z"); // 04:00 TSİ, 20 Eylül

describe("capacityPeriod", () => {
  it("Türkiye saatiyle ay sınırları (UTC+3) ve Türkçe etiket", () => {
    const p = capacityPeriod(NOW);
    expect(p.label).toBe("Eylül 2026");
    expect(p.start.toISOString()).toBe("2026-08-31T21:00:00.000Z");
    expect(p.end.toISOString()).toBe("2026-09-30T21:00:00.000Z");
  });
  it("ay başına yakın UTC anı TSİ'ye göre sınıflanır (31 Ağu 22:00 UTC = 1 Eyl 01:00 TSİ)", () => {
    expect(capacityPeriod(new Date("2026-08-31T22:00:00.000Z")).label).toBe("Eylül 2026");
    expect(capacityPeriod(new Date("2026-08-31T20:59:00.000Z")).label).toBe("Ağustos 2026");
  });
});

describe("capacityUsage", () => {
  const c = (iso: string) => ({ endedAt: new Date(iso), startedAt: new Date(iso) });
  it("yalnız dönemdeki görüşmeler sayılır; aşım hesaplanır", () => {
    const u = capacityUsage([c("2026-09-01T10:00:00Z"), c("2026-09-19T10:00:00Z"), c("2026-08-15T10:00:00Z"), c("2026-10-01T10:00:00Z")], 1, NOW);
    expect(u.used).toBe(2);
    expect(u.overflow).toBe(1);
    expect(u.percent).toBe(100);
    expect(u.period.label).toBe("Eylül 2026");
  });
  it("endedAt yoksa startedAt; kapasite 0 bölme hatası üretmez", () => {
    const u = capacityUsage([{ endedAt: null, startedAt: new Date("2026-09-05T10:00:00Z") }], 0, NOW);
    expect(u.used).toBe(1);
    expect(u.capacity).toBe(0);
    expect(u.overflow).toBe(1);
    expect(u.percent).toBe(100);
    expect(capacityUsage([], 20, NOW)).toMatchObject({ used: 0, overflow: 0, percent: 0 });
  });
});
