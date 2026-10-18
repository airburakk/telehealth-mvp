import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ user: null as null | { id: string; role: string }, prepare: vi.fn(), drafts: vi.fn(), approve: vi.fn(), revoke: vi.fn(), reconcile: vi.fn(), inspect: vi.fn(), claim: vi.fn(), complete: vi.fn(), queued: vi.fn(), observe: vi.fn(), tasks: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => state.user }));
vi.mock("@/lib/audit", () => ({ reqMeta: () => ({ ip: null, userAgent: null }) }));
vi.mock("@/lib/social-calendar/weekly-store", () => ({ prepareWeeklyPackage: state.prepare, approveWeeklyPackage: state.approve, revokeWeeklyPackage: state.revoke,
  reconcileWeeklyDelivery: state.reconcile, getWeeklyDrafts: state.drafts, getWeeklyPackage: state.inspect, claimWeeklyDelivery: state.claim, completeWeeklyDelivery: state.complete,
  queueWeeklyDelivery: state.queued, observeWeeklyQueue: state.observe, getWeeklyQueueTasks: state.tasks }));
import { POST as admin } from "../../src/app/api/admin/icerik-takvimi/haftalik/route";
import { POST as machine } from "../../src/app/api/social-calendar/haftalik/route";
const request = (body: unknown, token?: string, origin?: string) => new Request("https://doctorium.tr/api/test", { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...(origin ? { origin } : {}) }, body: JSON.stringify(body) });
beforeEach(() => { vi.clearAllMocks(); state.user = null; vi.stubEnv("CONTENT_PLAN_TOKEN", "test-weekly-token"); vi.stubEnv("WEEKLY_PUBLISH_ENABLED", ""); vi.stubEnv("WEEKLY_REMOTE_OBSERVER_VERIFIED", ""); });
afterEach(() => { vi.unstubAllEnvs(); });

describe("weekly API authorization boundaries", () => {
  it("admin endpoint denies missing/non-admin sessions and cross-origin writes", async () => {
    expect((await admin(request({ action: "approve" }))).status).toBe(401);
    state.user = { id: "u", role: "DOCTOR" };
    expect((await admin(request({ action: "approve" }))).status).toBe(401);
    state.user.role = "ADMIN";
    expect((await admin(request({ action: "approve" }, undefined, "https://evil.example"))).status).toBe(403);
    expect(state.approve).not.toHaveBeenCalled();
  });
  it("forwards the explicit confirmation and reviewed version/hash to human approval", async () => {
    state.user = { id: "u", role: "ADMIN" }; state.approve.mockResolvedValue({ id: "week" });
    const res = await admin(request({ action: "approve", id: "week", version: "v", hash: "h", confirmed: true }));
    expect(res.status).toBe(200);
    expect(state.approve).toHaveBeenCalledWith(expect.objectContaining({ id: "week", version: "v", hash: "h", confirmed: true, actor: state.user }));
  });
  it("machine token cannot approve and missing/wrong credentials never touch the store", async () => {
    vi.stubEnv("CONTENT_PLAN_TOKEN", "");
    expect((await machine(request({ action: "inspect" }))).status).toBe(503);
    vi.stubEnv("CONTENT_PLAN_TOKEN", "test-weekly-token");
    expect((await machine(request({ action: "inspect" }, "wrong"))).status).toBe(401);
    expect((await machine(new Request("https://doctorium.tr/api/test", { method: "POST", headers: { authorization: "test-weekly-token" }, body: '{}' }))).status).toBe(401);
    expect((await machine(request({ action: "approve" }, "test-weekly-token"))).status).toBe(400);
    expect(state.approve).not.toHaveBeenCalled(); expect(state.inspect).not.toHaveBeenCalled();
  });
  it("allows automatic DRAFT preparation without a human session but cannot attest or approve", async () => {
    state.prepare.mockResolvedValue({ id: "p", status: "DRAFT", manifestHash: "h" });
    const res = await machine(request({ action: "prepare", manifest: { v: 1 }, approved: true, confirmed: true }, "test-weekly-token"));
    expect(res.status).toBe(200);
    expect(state.prepare).toHaveBeenCalledWith({ manifest: { v: 1 }, actor: null, ip: null, userAgent: null });
    expect(state.approve).not.toHaveBeenCalled(); expect(state.claim).not.toHaveBeenCalled();
    expect((await res.json()).package.status).toBe("DRAFT");
  });
  it("provides existing drafts to the authenticated renderer without a write or claim", async () => {
    state.drafts.mockResolvedValue({ week: "2026-10-19", items: [], missing: [] });
    expect((await machine(request({ action: "drafts", week: "2026-10-19" }, "test-weekly-token"))).status).toBe(200);
    expect(state.drafts).toHaveBeenCalledWith("2026-10-19");
    expect(state.prepare).not.toHaveBeenCalled(); expect(state.approve).not.toHaveBeenCalled(); expect(state.claim).not.toHaveBeenCalled();
  });
  it("claims stay dormant by default; enabling requires explicit reviewed activation", async () => {
    const body = { action: "claim", id: "d", hash: "h", accountId: "x:account", assetHashes: { "post.txt": "a".repeat(64) } };
    expect((await machine(request(body, "test-weekly-token"))).status).toBe(503); expect(state.claim).not.toHaveBeenCalled();
    vi.stubEnv("WEEKLY_PUBLISH_ENABLED", "true"); state.claim.mockResolvedValue({ id: "d" });
    expect((await machine(request(body, "test-weekly-token"))).status).toBe(200);
    expect(state.claim).toHaveBeenCalledWith(expect.objectContaining({ accountId: "x:account", assetHashes: body.assetHashes }));
  });
  it("accepts in-flight result reporting after publishing is disabled and never passes error payloads", async () => {
    state.complete.mockResolvedValue({ state: "UNKNOWN" });
    expect((await machine(request({ action: "result", id: "d", claimToken: "attempt", result: "FAILED", error: "secret raw platform response" }, "test-weekly-token"))).status).toBe(200);
    expect(state.complete).toHaveBeenCalledWith({ id: "d", claimToken: "attempt", result: "FAILED", platformId: "", publishedUrl: "", publishedAt: "", noRequestSent: false });
  });
  it("keeps accepted queue tracking available after disabling new sends but gates unverified definitive observations", async () => {
    state.queued.mockResolvedValue({ state: "QUEUED" });
    expect((await machine(request({ action: "queued", id: "d", claimToken: "t", providerQueueId: "q", dueAt: "2026-10-19T17:30:00Z" }, "test-weekly-token"))).status).toBe(200);
    expect((await machine(request({ action: "queue-observation", observation: "CANCELLED" }, "test-weekly-token"))).status).toBe(503);
    expect(state.observe).not.toHaveBeenCalled();
    state.observe.mockResolvedValue({ state: "CANCEL_UNKNOWN" });
    expect((await machine(request({ action: "queue-observation", observation: "UNKNOWN" }, "test-weekly-token"))).status).toBe(200);
  });
  it("approved dispatch inspection never returns an unapproved package", async () => {
    state.inspect.mockResolvedValue({ status: "DRAFT", manifest: { internal: true } });
    expect(await (await machine(request({ action: "inspect", week: "2026-10-19" }, "test-weekly-token"))).json()).toEqual({ ok: true, package: null });
  });
});
