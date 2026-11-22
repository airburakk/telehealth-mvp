import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ news: vi.fn(), career: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { newsArticle: { findMany: mocks.news }, careerPathway: { findMany: mocks.career } } }));
import { personalFeedPage } from "@/lib/doctorium";

beforeEach(() => { vi.clearAllMocks(); mocks.news.mockResolvedValue([]); mocks.career.mockResolvedValue([]); });
describe("Student personal feed isolation", () => {
  it("does not query doctor career pathways and marks their cursor exhausted", async () => {
    const page = await personalFeedPage([], ["kariyer"], {}, 40, { excludeDoctorCareer: true });
    expect(mocks.career).not.toHaveBeenCalled();
    expect(page).toEqual({ items: [], cursors: { kariyer: null }, done: true });
  });
  it("does not restart a prior doctor career cursor after membership changes", async () => {
    const page = await personalFeedPage([], ["kariyer"], { kariyer: { id: "old", at: "2026-11-01T00:00:00Z" } }, 40, { excludeDoctorCareer: true });
    expect(mocks.career).not.toHaveBeenCalled();
    expect(page.cursors.kariyer).toBeNull();
    expect(page.done).toBe(true);
  });
  it("keeps academic queries and terminates a mixed empty student page", async () => {
    const page = await personalFeedPage([], ["akademik", "kariyer"], {}, 40, { excludeDoctorCareer: true });
    expect(mocks.news).toHaveBeenCalledOnce();
    expect(mocks.career).not.toHaveBeenCalled();
    expect(page.done).toBe(true);
  });
  it("preserves the doctor career query for the default audience", async () => {
    await personalFeedPage([], ["kariyer"], {}, 40);
    expect(mocks.career).toHaveBeenCalledOnce();
  });
  it("still terminates the new-only student cursor", async () => {
    const page = await personalFeedPage([], ["kariyer"], {}, 40, { excludeDoctorCareer: true, createdSince: new Date("2026-11-11T00:00:00Z") });
    expect(mocks.career).not.toHaveBeenCalled();
    expect(page.done).toBe(true);
  });
});
