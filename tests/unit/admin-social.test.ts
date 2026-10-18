import { describe, expect, it } from "vitest";
import { SOCIAL_METRIC_LABEL, SOCIAL_PLATFORMS } from "@/lib/admin-social";
import { SOCIAL_METRIC_FIELDS, SOCIAL_PLATFORM_KEYS } from "@/lib/social-metrics";

describe("admin-social — pano kart kayıt defteri", () => {
  it("platform kümesi /api/social-metrics sözleşmesiyle aynı", () => {
    expect(SOCIAL_PLATFORMS.map((p) => p.key).sort()).toEqual([...SOCIAL_PLATFORM_KEYS].sort());
  });

  it("kartın çizdiği her ölçü tabloda bir alan ve etiketli (yoksa kart sessizce hep '—' kalır)", () => {
    for (const p of SOCIAL_PLATFORMS) {
      for (const m of p.metrics) {
        expect(SOCIAL_METRIC_FIELDS as readonly string[]).toContain(m);
        expect(SOCIAL_METRIC_LABEL[m]).toBeTruthy();
      }
    }
  });

  it("X gösterim verir, erişim vermez → kart 'Görüntülenme' çizer, 'Erişim' çizmez (👤 2026-10-18)", () => {
    const x = SOCIAL_PLATFORMS.find((p) => p.key === "x")!;
    expect(x.metrics).toContain("views");
    expect(x.metrics).not.toContain("reach");
    expect(SOCIAL_METRIC_LABEL.views).toBe("Görüntülenme");
  });
});
