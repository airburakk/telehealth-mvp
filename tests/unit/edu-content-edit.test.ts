import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseEduContentEdit } from "@/lib/edu-content-edit";
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { eduOpportunity: { updateMany: vi.fn() } } }));
import { PUT } from "@/app/api/admin/edu-opportunity/route";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/session";
const valid = { id: "tubitak-2209a", expectedUpdatedAt: "2026-11-14T00:00:00.000Z", deadline: "2026-11-18", deadlineNote: "", eligibility: "Öğrenci başvurusu ve danışman onayı 18 Kasım saat 17.30.", sourceUrl: "https://tubitak.gov.tr/tr/burslar", verifiedAt: "2026-11-14" };
const req = (b: unknown) => new Request("https://doctorium.tr/api/admin/edu-opportunity", { method: "PUT", body: JSON.stringify(b) });
beforeEach(() => { vi.resetAllMocks(); vi.mocked(getCurrentUser).mockResolvedValue({ id: "a", role: "ADMIN" } as SessionUser); vi.mocked(db.eduOpportunity.updateMany).mockResolvedValue({ count: 1 }); });
describe("narrow editorial update", () => {
  it("validates strict real dates and concurrency version", () => {
    expect(parseEduContentEdit(valid).ok).toBe(true);
    for (const patch of [{ deadline: "2026-02-30" }, { verifiedAt: "2026-02-30" }, { expectedUpdatedAt: "" }, { deadline: "", deadlineNote: "" }]) expect(parseEduContentEdit({ ...valid, ...patch }).ok).toBe(false);
  });
  it("rejects privileged fields, unsafe URLs and invalid text", () => {
    for (const patch of [{ approvedAt: "2026-11-14" }, { title: "changed" }, { sourceUrl: "http://example.org" }, { sourceUrl: "https://user:secret@example.org" }, { eligibility: "short" }, { eligibility: "x".repeat(421) }, { eligibility: "Bu bir işe alım ve ilan metnidir." }]) expect(parseEduContentEdit({ ...valid, ...patch }).ok).toBe(false);
  });
  it("rejects unauthenticated and non-admin requests before any write", async () => {
    for (const u of [null, { id: "d", role: "DOCTOR" } as SessionUser]) {
      vi.mocked(getCurrentUser).mockResolvedValue(u);
      expect((await PUT(req(valid))).status).toBe(401);
    }
    expect(db.eduOpportunity.updateMany).not.toHaveBeenCalled();
  });
  it("invalid fields cannot trigger a write", async () => {
    expect((await PUT(req({ ...valid, approvedAt: null }))).status).toBe(400);
    expect(db.eduOpportunity.updateMany).not.toHaveBeenCalled();
  });
  it("updates only content of the exact id/version, preserving approval and follows", async () => {
    expect((await PUT(req(valid))).status).toBe(200);
    expect(db.eduOpportunity.updateMany).toHaveBeenCalledTimes(1);
    const args = vi.mocked(db.eduOpportunity.updateMany).mock.calls[0][0]!;
    expect(args.where).toEqual({ id: valid.id, updatedAt: new Date(valid.expectedUpdatedAt) });
    expect(Object.keys(args.data).sort()).toEqual(["deadline", "deadlineNote", "eligibility", "sourceUrl", "verifiedAt"].sort());
  });
  it("stale or missing record returns conflict, not success", async () => {
    vi.mocked(db.eduOpportunity.updateMany).mockResolvedValue({ count: 0 });
    expect((await PUT(req(valid))).status).toBe(409);
  });
});
