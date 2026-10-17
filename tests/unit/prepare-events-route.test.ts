import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ prepare: vi.fn(), student: vi.fn(), remind: vi.fn(), audit: vi.fn(), alert: vi.fn() }));
vi.mock("@/lib/social-calendar/prepare-events", () => ({ prepareEventDraft: mocks.prepare }));
vi.mock("@/lib/social-calendar/prepare-students", () => ({ prepareStudentDraft: mocks.student }));
vi.mock("@/lib/social-calendar/reminder-run", () => ({ rubrikHatirlatmasi: mocks.remind }));
vi.mock("@/lib/audit", () => ({ recordAccess: mocks.audit }));
vi.mock("@/lib/alerts", () => ({ sendAlert: mocks.alert }));
import { GET } from "@/app/api/cron/rubrik-hatirlatma/route";

beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("BRAND_MODE", "aura"); vi.stubEnv("CRON_SECRET", "test-only");
  mocks.prepare.mockResolvedValue({ status: "created", slotDay: "2026-10-19", checked: 1, reasons: [], itemId: "draft" });
  mocks.student.mockResolvedValue({ status: "created", slotDay: "2026-10-23", checked: 1, reasons: [], itemId: "student-draft" });
  mocks.remind.mockResolvedValue({ bugun: "2026-10-18", maddeler: [], gonderildi: false, atlama: "gerek-yok" });
});
afterEach(() => vi.unstubAllEnvs());
const request = () => new Request("https://example.org/api/cron/rubrik-hatirlatma", { headers: { authorization: "Bearer test-only" } });

describe("preparation on the existing reminder cron", () => {
  it("keeps the authentication and single-deployment gates before writes or fetches", async () => {
    expect((await GET(new Request("https://example.org"))).status).toBe(401);
    vi.stubEnv("BRAND_MODE", "doctorium");
    expect(await (await GET(request())).json()).toHaveProperty("skipped");
    vi.stubEnv("BRAND_MODE", "aura"); vi.stubEnv("CRON_SECRET", "");
    expect((await GET(request())).status).toBe(503);
    expect(mocks.prepare).not.toHaveBeenCalled(); expect(mocks.remind).not.toHaveBeenCalled();
    expect(mocks.student).not.toHaveBeenCalled();
  });
  it("prepares before reminding and persists a distinct audit result", async () => {
    const res = await GET(request());
    expect(await res.json()).toMatchObject({ preparation: { status: "created" }, ok: true });
    expect(mocks.prepare.mock.invocationCallOrder[0]).toBeLessThan(mocks.remind.mock.invocationCallOrder[0]!);
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "CRON_MAINTENANCE", resourceId: "rubrik-taslak", detail: expect.stringContaining('"status":"created"') }));
  });
  it("retains the reminder and records an explicit error if preparation fails", async () => {
    mocks.prepare.mockRejectedValue(new Error("sensitive database details"));
    const result = await (await GET(request())).json();
    expect(result).toMatchObject({ preparation: { status: "error" } });
    expect(JSON.stringify(result)).not.toContain("sensitive");
    expect(mocks.remind).toHaveBeenCalledTimes(1);
    expect(mocks.alert).toHaveBeenCalledWith("cron-rubrik-taslak", expect.any(String), "rubrik-hatirlatma: preparation-error");
  });
  it("isolates student preparation failure from events and the existing reminder", async () => {
    mocks.student.mockRejectedValue(new Error("sensitive db details"));
    const result = await (await GET(request())).json();
    expect(result).toMatchObject({ preparation: { status: "created" }, studentPreparation: { status: "error" } });
    expect(mocks.remind).toHaveBeenCalledTimes(1);
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ resourceId: "ogrenci-taslak", detail: '{"status":"error"}' }));
    expect(mocks.alert).toHaveBeenCalledWith("cron-ogrenci-taslak", expect.any(String), "rubrik-hatirlatma: student-preparation-error");
  });
});
