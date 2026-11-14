import { describe, it, expect, vi, beforeEach } from "vitest";
import { EDU_KINDS, EDU_KIND_LABEL, parseEduKind, resolveEduKind } from "@/lib/edu-opportunities";
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { eduOpportunity: { create: vi.fn() } } }));
import { POST } from "@/app/api/admin/edu-opportunity/route";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/session";
const data = { kind: "kongre", title: "Student research congress", organizer: "University", country: "TR", deadline: "2027-03-05", startsAt: "2027-04-02", eligibility: "Medical and health sciences students; registration opens 2026-12-01; fee not announced.", sourceUrl: "https://utopik.uskudaruniversitesi.edu.tr/tr/2027", verifiedAt: "2026-11-14" };
const req = (body: unknown) => new Request("https://doctorium.tr/api/admin/edu-opportunity", { method: "POST", body: JSON.stringify(body) });
beforeEach(() => { vi.resetAllMocks(); vi.mocked(getCurrentUser).mockResolvedValue({ id: "admin", role: "ADMIN" } as SessionUser); vi.mocked(db.eduOpportunity.create).mockResolvedValue({ id: "test" } as never); });
describe("Student congress category", () => {
  it("supports filtering and persisted opening preference", () => {
    expect(EDU_KINDS).toContain("kongre"); expect(EDU_KIND_LABEL.kongre).toBe("Kongre / sempozyum");
    expect(parseEduKind("kongre")).toBe("kongre"); expect(resolveEduKind(undefined, "kongre")).toBe("kongre");
    expect(resolveEduKind("hepsi", "kongre")).toBeNull(); expect(parseEduKind("unknown")).toBeNull();
  });
  it("creates a congress as a draft by default without changing schema", async () => {
    expect((await POST(req(data))).status).toBe(200);
    expect(db.eduOpportunity.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({kind:"kongre",approvedAt:null,deadline:new Date("2027-03-05T00:00:00Z"),startsAt:"2027-04-02"}) }));
  });
  it("preserves admin authorization", async () => {
    for (const user of [null, {id:"student",role:"DOCTOR"} as SessionUser]) { vi.mocked(getCurrentUser).mockResolvedValue(user); expect((await POST(req(data))).status).toBe(401); }
    expect(db.eduOpportunity.create).not.toHaveBeenCalled();
  });
  it("rejects unknown kinds without a database write", async () => {
    expect((await POST(req({...data,kind:"unknown"}))).status).toBe(400); expect(db.eduOpportunity.create).not.toHaveBeenCalled();
  });
});
