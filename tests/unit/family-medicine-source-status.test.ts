import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const m = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/lib/family-medicine-refresh-store", () => ({ listFamilyMedicineSourceChecks: m.list }));
import { FamilyMedicineSourceStatus } from "@/components/FamilyMedicineSourceStatus";
beforeEach(() => vi.clearAllMocks());
describe("family medicine source status", () => {
  it("does not label storage failure as current or unchecked success", async () => {
    m.list.mockRejectedValue(new Error("private database details"));
    const html = renderToStaticMarkup(await FamilyMedicineSourceStatus());
    expect(html).toContain("kontrol durumu alınamadı");
    expect(html).not.toContain("private database details");
  });
  it("shows separate source attempt, successful access and review warning", async () => {
    m.list.mockResolvedValue({ lastRunAt: null, lastAttemptAt: "2026-11-08T06:00:00Z", sources: [{
      sourceKey: "fixture", title: "Resmî kaynak", url: "https://example.gov.tr/", status: "changed",
      checkedAt: "2026-11-08T06:00:00Z", lastSuccessAt: "2026-11-04T06:00:00Z", changedAt: "2026-11-04T06:00:00Z", stale: true,
    }] });
    const html = renderToStaticMarkup(await FamilyMedicineSourceStatus());
    expect(html).toContain("yeniden inceleme gerekli");
    expect(html).toContain("Teknik kontrol bayat");
    expect(html).toContain("Son başarılı erişim");
    expect(html).toContain("klinik olarak onaylı olduğunu göstermez");
  });
});
