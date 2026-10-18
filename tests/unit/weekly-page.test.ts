import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const state = vi.hoisted(() => ({ findMany: vi.fn(), getPackage: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => ({ id: "admin", role: "ADMIN" }) }));
vi.mock("@/lib/db", () => ({ db: { contentPlanItem: { findMany: state.findMany } } }));
vi.mock("@/lib/social-calendar/weekly-store", () => ({ getWeeklyPackage: state.getPackage }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), redirect: () => { throw new Error("redirect"); } }));
import WeeklyReviewPage from "../../src/app/admin/icerik-takvimi/haftalik/page";

describe("weekly review page safety", () => {
  it("shows the precise account/time/media and an unchecked explicit approval while declaring n8n inactive", async () => {
    state.findMany.mockResolvedValue([{ id: "item", payload: JSON.stringify({ v: 1, slides: [{ role: "kapak", title: "Review title", body: "Review text" }], caption: "Caption", hashtags: [], sources: [] }) }]);
    state.getPackage.mockResolvedValue({ id: "p", status: "DRAFT", updatedAt: new Date("2026-10-18T00:00:00Z"), manifestHash: "a".repeat(64), approvedBy: null, revokedReason: null,
      manifest: { entries: [{ id: "item", seriesKey: "etkinlik-radari", scheduledAt: "2026-10-19T09:00:00.000Z", channels: ["youtube"], accounts: { youtube: "youtube:review-account" }, assets: [{ channel: "youtube", name: "review.mp4", url: "https://example.com/review.mp4" }] }] }, deliveries: [] });
    const html = renderToStaticMarkup(await WeeklyReviewPage({ searchParams: Promise.resolve({ hafta: "2026-10-19" }) }));
    expect(html).toContain("youtube:review-account"); expect(html).toContain("12:00"); expect(html).toContain("https://example.com/review.mp4");
    expect(html).toContain("henüz doğrulanıp etkinleştirilmedi");
    expect(html).toContain("taraf adı veya kimlik bilgisi bulunmadığını doğruladım");
    expect(html).toContain('type="checkbox"'); expect(html).not.toContain('checked=""');
    expect(html).toMatch(/disabled=""[^>]*>Haftalık paketi onayla/);
  });
  it("does not offer approval or query item data without a prepared package", async () => {
    state.findMany.mockClear(); state.getPackage.mockResolvedValue(null);
    const html = renderToStaticMarkup(await WeeklyReviewPage({ searchParams: Promise.resolve({ hafta: "2026-10-19" }) }));
    expect(html).toContain("paket henüz yok"); expect(html).not.toContain("Haftalık paketi onayla");
    expect(state.findMany).not.toHaveBeenCalled();
  });
});
