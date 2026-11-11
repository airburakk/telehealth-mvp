import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ audience: vi.fn(), feed: vi.fn(), fresh: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => ({ id: "u1", role: "DOCTOR" }) }));
vi.mock("@/lib/doctorium-audience", () => ({ currentDoctoriumAudience: mocks.audience }));
vi.mock("@/lib/db", () => ({ db: {
  user: { findUnique: async () => ({ doctorId: "d1" }) },
  doctor: { findUnique: async () => ({ id: "d1", branch: "Kardiyoloji", newsBranches: null, doctoriumViewPrefs: null }) },
} }));
vi.mock("@/lib/doctorium", () => ({
  effectiveBranches: () => ["kardiyoloji"], personalFeedPage: mocks.feed, moduleFeed: mocks.fresh,
  localizeTitles: async (items: unknown[]) => items, savedArticleIds: async () => new Set(),
  todayModuleCounts: async () => ({}), trDayStart: () => new Date("2026-11-11T00:00:00Z"),
  parseViewPrefs: () => ({ sektorel: {} }), FM_TO_MODULES: { kariyer: ["kariyer"], akademik: ["akademik"] },
  PULSE_LABELS: { kariyer: "kariyer", akademik: "akademik" }, SECTOR_SOURCE_SCOPES: {},
}));
vi.mock("@/app/doktor/doctorium/DoctoriumSidebar", () => ({ DoctoriumShell: () => null }));
vi.mock("@/app/doktor/doctorium/ArticleCard", () => ({ ArticleCard: () => null }));
import SayacPage from "@/app/doktor/doctorium/sayac/page";

beforeEach(() => { vi.clearAllMocks(); mocks.feed.mockResolvedValue({ items: [], done: true, cursors: {} }); mocks.fresh.mockResolvedValue([]); });
describe("Student counter route audience boundary", () => {
  it.each(["STUDENT", "VERIFIED"])("passes the authenticated audience to personal feed for %s", async audience => {
    mocks.audience.mockResolvedValue({ audience, doctorId: "d1" });
    await SayacPage({ searchParams: Promise.resolve({ m: "kariyer" }) });
    expect(mocks.feed).toHaveBeenCalledWith(["kardiyoloji"], ["kariyer"], {}, 40, { sektorelSources: undefined, excludeDoctorCareer: audience === "STUDENT" });
  });
  it("keeps new-only academic results on the existing fresh-news path", async () => {
    mocks.audience.mockResolvedValue({ audience: "STUDENT", doctorId: "d1" });
    await SayacPage({ searchParams: Promise.resolve({ m: "akademik", n: "1" }) });
    expect(mocks.fresh).toHaveBeenCalledOnce();
    expect(mocks.feed).not.toHaveBeenCalled();
  });
});
