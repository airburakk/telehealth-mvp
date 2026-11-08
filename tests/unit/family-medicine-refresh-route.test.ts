import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ refresh: vi.fn(), audit: vi.fn(), alert: vi.fn() }));
vi.mock("@/lib/family-medicine-refresh-store", () => ({ refreshFamilyMedicineSources: mocks.refresh }));
vi.mock("@/lib/audit", () => ({ recordAccess: mocks.audit }));
vi.mock("@/lib/alerts", () => ({ sendAlert: mocks.alert }));
import { GET } from "@/app/api/cron/refresh-family-medicine/route";

const result = () => ({ checked: 9, baseline: 9, current: 0, changed: 0, unreachable: 0, errors: [], changedSources: [], failureAlerts: [] });
const request = (authorized = true) => new Request("https://aura.example/api/cron/refresh-family-medicine", { headers: authorized ? { authorization: "Bearer unit-test-secret" } : {} });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("BRAND_MODE", "aura");
  vi.stubEnv("CRON_SECRET", "unit-test-secret");
  mocks.refresh.mockResolvedValue(result());
  mocks.audit.mockResolvedValue(undefined);
  mocks.alert.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe("family medicine refresh cron gate and observability", () => {
  it("cannot be triggered anonymously", async () => {
    expect((await GET(request(false))).status).toBe(401);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it("fails closed without configured secret", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(request())).status).toBe(503);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it("is a no-op on Doctorium deployment to prevent duplicate runs", async () => {
    vi.stubEnv("BRAND_MODE", "doctorium");
    expect(await (await GET(request())).json()).toHaveProperty("skipped");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it("records a completed technical run without clinical validation", async () => {
    expect(await (await GET(request())).json()).toMatchObject({ ok: true, checked: 9, clinicalValidation: false });
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "CRON_MAINTENANCE", resourceId: "refresh-family-medicine", detail: expect.stringContaining("sources=9") }));
    expect(mocks.alert).not.toHaveBeenCalled();
  });
  it("shows partial unreachable results and preserves error details in the run summary", async () => {
    mocks.refresh.mockResolvedValue({ ...result(), baseline: 8, unreachable: 1, errors: ["hash:http-403"] });
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: false, unreachable: 1, clinicalValidation: false });
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ detail: expect.stringContaining('ilk="hash:http-403"') }));
  });
  it("alerts on newly changed sources and threshold failures only", async () => {
    mocks.refresh.mockResolvedValue({ ...result(), changed: 1, baseline: 7, unreachable: 1, changedSources: ["Public guide"], failureAlerts: ["Other guide: http-403 (3)"] });
    await GET(request());
    expect(mocks.alert).toHaveBeenCalledTimes(2);
    expect(mocks.alert).toHaveBeenCalledWith("family-medicine-source-changed", expect.any(String), "Public guide");
    expect(mocks.alert).toHaveBeenCalledWith("family-medicine-source-unreachable", expect.any(String), expect.stringContaining("http-403 (3)"));
  });
  it("still attempts the failure alert and returns500 when audit storage also rejects", async () => {
    mocks.refresh.mockRejectedValue(new Error("failed"));
    mocks.audit.mockRejectedValue(new Error("audit unavailable"));
    expect((await GET(request())).status).toBe(500);
    expect(mocks.alert).toHaveBeenCalledWith("cron-refresh-family-medicine", expect.any(String), expect.any(String));
  });
  it("returns500 and logs a failed run when persistence or monitoring fails without leaking error secrets", async () => {
    mocks.refresh.mockRejectedValue(new Error("database password must not escape"));
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("password");
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ detail: "failed=source-refresh-or-storage" }));
    expect(mocks.alert).toHaveBeenCalledWith("cron-refresh-family-medicine", expect.any(String), expect.not.stringContaining("password"));
  });
});