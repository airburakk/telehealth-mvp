import { describe, expect, it } from "vitest";
import { EDU_OPPORTUNITIES, approvedEduOpportunities } from "@/lib/edu-opportunities";

describe("2209-A 2026 official deadline extension", () => {
  it("uses the verified extended student/advisor deadline, not the later e-sign window", () => {
    const item = EDU_OPPORTUNITIES.find((o) => o.id === "tubitak-2209a")!;
    expect(item.deadline).toBe("2026-11-18");
    expect(item.deadlineNote).toBeNull();
    expect(item.eligibility).toContain("18 Kasım 2026 saat 17.30 (Türkiye)");
    expect(item.eligibility).toContain("öğrenci başvurusu ve danışman onayı");
    expect(item.eligibility).toContain("23-30 Kasım 2026");
    expect(item.sourceUrl).toBe("https://tubitak.gov.tr/tr/burslar/lisans-onlisans/destek-programlari/2209-universite-ogrencileri-arastirma-projeleri-destekleme-programi");
    expect(item.verifiedAt).toBe("2026-11-14");
    expect(item.approvedAt).toBe("2026-09-05");
    expect(approvedEduOpportunities().some((o) => o.id === item.id)).toBe(true);
  });
});
