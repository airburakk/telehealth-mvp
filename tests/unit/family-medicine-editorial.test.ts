import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ row: null as Record<string, unknown> | null, events: [] as unknown[], sourceState: { fingerprint: "fixture-fingerprint" as string | null, blockers: [] as string[] }, role: "ADMIN", sessionRole: "ADMIN", grant: null as unknown, failAudit: false, conflict: false, tx: vi.fn(), findGrant: vi.fn() }));
vi.mock("@/lib/family-medicine-refresh-store", () => ({ readFamilyMedicineWorkflowSourceState: async () => m.sourceState }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => m.sessionRole ? { id: "admin-one", role: m.sessionRole } : null }));
vi.mock("@/lib/db", () => ({ db: { $transaction: m.tx, familyMedicineEditorial: { findMany: async () => m.row ? [m.row] : [] }, familyMedicineEditorialEvent: { findMany: async () => m.events }, familyMedicineReviewerGrant: { findMany: async () => [] } } }));
import { EditorialError, executeEditorial, grantIsActive, isSameOrigin, parseEditorialCommand, schemaMissing } from "../../src/lib/family-medicine-editorial";
import { POST, GET } from "../../src/app/api/admin/aile-hekimligi/route";
const evidence = () => ({ sources: [{ url: "https://shgmmevzuatdb.saglik.gov.tr/TR-117242/saglik-raporlari-yonetmeligi-yayimlandi.html", version: "2026", locator: "md. 1", applicability: "Editor test fixture", verifiedOn: "2026-01-01", effectiveFrom: "2026-01-01", effectiveUntil: null }], nextReviewOn: "2099-01-01", sourceGap: null });
const command = () => ({ action: "save" as const, workflowId: "driver", expectedRevision: 0, evidence: evidence() });
const post = (body: unknown, origin: string | null = "https://doctorium.test", contentType = "application/json") => POST(new Request("https://doctorium.test/api/admin/aile-hekimligi", { method: "POST", headers: { ...(origin ? { origin } : {}), "content-type": contentType }, body: typeof body === "string" ? body : JSON.stringify(body) }));
beforeEach(() => {
  vi.clearAllMocks(); m.sourceState = { fingerprint: "fixture-fingerprint", blockers: [] }; m.row = null; m.events = []; m.role = "ADMIN"; m.sessionRole = "ADMIN"; m.grant = null; m.failAudit = false; m.conflict = false;
  m.findGrant.mockImplementation(async () => m.grant);
  m.tx.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
    const initial = structuredClone(m.row), eventCopy = [...m.events];
    try { return await callback({
      user: { findUnique: async () => ({ role: m.role }) },
      familyMedicineReviewerGrant: { findUnique: m.findGrant },
      familyMedicineEditorial: {
        findUnique: async () => m.row,
        create: async ({ data }: { data: Record<string, unknown> }) => { m.row = { ...data }; return m.row; },
        updateMany: async ({ data }: { data: Record<string, unknown> }) => { if (m.conflict) return { count: 0 }; m.row = { ...m.row, ...data }; return { count: 1 }; },
      },
      familyMedicineEditorialEvent: { create: async ({ data }: { data: unknown }) => { if (m.failAudit) throw new Error("ledger unavailable"); m.events.push(data); return data; } },
    }); } catch (e) { m.row = initial; m.events = eventCopy; throw e; }
  });
});
const activeGrant = () => ({ qualificationReference: "Verified qualification reference", grantedAt: new Date("2026-01-01"), expiresAt: new Date("2099-01-01"), revokedAt: null });
describe("editorial contract validation", () => {
  it("accepts empty draft evidence without faking an approval", () => expect(parseEditorialCommand({ ...command(), evidence: { sources: [], sourceGap: "Needs mapping", nextReviewOn: null } }).action).toBe("save"));
  it.each([null, [], {}, { ...command(), workflowId: "injected" }, { ...command(), expectedRevision: -1 }, { ...command(), expectedRevision: 2147483647 }, { ...command(), expectedRevision: 0.5 }, { ...command(), actorId: "victim" }, { ...command(), approvedAt: "2026-01-01" }])("rejects unknown/forged request fields %j", value => expect(() => parseEditorialCommand(value)).toThrow(EditorialError));
  it.each(["http://example.org", "javascript:alert(1)", "https://user:secret@example.org"])("rejects unsafe source %s", url => { const body = command(); body.evidence.sources[0].url = url; expect(() => parseEditorialCommand(body)).toThrow(); });
  it("rejects impossible dates and unbounded source fields", () => { const body = command(); body.evidence.sources[0].verifiedOn = "2026-02-30"; expect(() => parseEditorialCommand(body)).toThrow(); body.evidence.sources[0].verifiedOn = "2026-01-01"; body.evidence.sources[0].locator = "x".repeat(501); expect(() => parseEditorialCommand(body)).toThrow(); });
  it("detects schema missing only for Prisma schema codes", () => { expect(schemaMissing({ code: "P2021" })).toBe(true); expect(schemaMissing({ code: "P2022" })).toBe(true); expect(schemaMissing(new Error())).toBe(false); });
  it("requires exact Origin and rejects cross-site fetch", () => { expect(isSameOrigin(new Request("https://a.test", { headers: { origin: "https://a.test" } }))).toBe(true); expect(isSameOrigin(new Request("https://a.test"))).toBe(false); expect(isSameOrigin(new Request("https://a.test", { headers: { origin: "https://a.test", "sec-fetch-site": "cross-site" } }))).toBe(false); });
});
describe("transactional evidence and reviews", () => {
  it("writes a server-authored full immutable snapshot in the same serializable transaction", async () => {
    expect(await executeEditorial(command(), "admin-one")).toEqual({ ok: true, revision: 1 });
    expect(m.events).toHaveLength(1); expect(m.events[0]).toMatchObject({ actorId: "admin-one", revision: 1, action: "save", snapshotHash: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(m.row).toMatchObject({ clinicalById: null, legalById: null }); expect(m.tx.mock.calls[0][1]).toEqual({ isolationLevel: "Serializable" });
  });
  it("rolls back the evidence write if mandatory audit insert fails", async () => { m.failAudit = true; await expect(executeEditorial(command(), "admin-one")).rejects.toThrow("ledger unavailable"); expect(m.row).toBeNull(); expect(m.events).toEqual([]); });
  it("rejects stale revision and conditional update conflict", async () => { await executeEditorial(command(), "admin-one"); await expect(executeEditorial(command(), "admin-one")).rejects.toMatchObject({ status: 409 }); m.conflict = true; await expect(executeEditorial({ ...command(), expectedRevision: 1 }, "admin-one")).rejects.toMatchObject({ status: 409 }); expect(m.events).toHaveLength(1); });
  it("rechecks current DB admin role before mutation", async () => { m.role = "DOCTOR"; await expect(executeEditorial(command(), "admin-one")).rejects.toMatchObject({ status: 403 }); expect(m.row).toBeNull(); });
  it("rejects review after catalog changes until evidence is saved again", async () => { await executeEditorial(command(), "admin-one"); m.row!.catalogHash = "old-catalog"; m.grant = activeGrant(); await expect(executeEditorial({ action: "review", workflowId: "driver", expectedRevision: 1, discipline: "clinical" }, "admin-one")).rejects.toMatchObject({ status: 409 }); expect(m.events).toHaveLength(1); });
  it("rejects changed same-URL remote source fingerprint until resave", async () => { await executeEditorial(command(), "admin-one"); m.grant = activeGrant(); m.sourceState.fingerprint = "new-content-hash"; await expect(executeEditorial({ action: "review", workflowId: "driver", expectedRevision: 1, discipline: "clinical" }, "admin-one")).rejects.toMatchObject({ status: 409 }); });
  it("rejects unchecked or stale sources even if evidence was saved", async () => { await executeEditorial(command(), "admin-one"); m.grant = activeGrant(); m.sourceState.blockers = ["Kaynak güncel değil"]; await expect(executeEditorial({ action: "review", workflowId: "driver", expectedRevision: 1, discipline: "clinical" }, "admin-one")).rejects.toMatchObject({ status: 409 }); });
  it("allows unmonitored draft but blocks expert approval", async () => { const body = command(); body.evidence.sources[0].url = "https://example.org/unmonitored"; await executeEditorial(body, "admin-one"); m.grant = activeGrant(); await expect(executeEditorial({ action: "review", workflowId: "driver", expectedRevision: 1, discipline: "clinical" }, "admin-one")).rejects.toMatchObject({ status: 400 }); });
  it("does not treat ADMIN as expert grant", async () => { await executeEditorial(command(), "admin-one"); await expect(executeEditorial({ action: "review", workflowId: "driver", expectedRevision: 1, discipline: "clinical" }, "admin-one")).rejects.toMatchObject({ status: 403 }); expect(m.findGrant).toHaveBeenCalled(); });
  it("checks grant expiry/revocation and qualification reference", () => { const now = new Date("2026-11-07"); expect(grantIsActive(activeGrant(), now)).toBe(true); expect(grantIsActive({ ...activeGrant(), revokedAt: now }, now)).toBe(false); expect(grantIsActive({ ...activeGrant(), expiresAt: now }, now)).toBe(false); expect(grantIsActive({ ...activeGrant(), qualificationReference: " " }, now)).toBe(false); });
  it("attributes review server-side and invalidates all reviews on edit", async () => { await executeEditorial(command(), "admin-one"); m.grant = activeGrant(); await executeEditorial({ action: "review", workflowId: "driver", expectedRevision: 1, discipline: "clinical" }, "admin-one"); expect(m.row).toMatchObject({ clinicalById: "admin-one", clinicalAt: expect.any(Date), revision: 2 }); await executeEditorial({ ...command(), expectedRevision: 2 }, "admin-two"); expect(m.row).toMatchObject({ clinicalById: null, clinicalAt: null, legalById: null, revision: 3 }); });
  it("requires two distinct reviewers and supports audited revocation", async () => { await executeEditorial(command(), "admin-one"); m.grant = activeGrant(); await executeEditorial({ action: "review", workflowId: "driver", expectedRevision: 1, discipline: "clinical" }, "admin-one"); await expect(executeEditorial({ action: "review", workflowId: "driver", expectedRevision: 2, discipline: "legal" }, "admin-one")).rejects.toMatchObject({ status: 403 }); await executeEditorial({ action: "revoke", workflowId: "driver", expectedRevision: 2, discipline: "clinical" }, "admin-two"); expect(m.row?.clinicalById).toBeNull(); expect(m.events[2]).toMatchObject({ action: "revoke:clinical", actorId: "admin-two" }); });
  it("never approves incomplete evidence even with a grant", async () => { await executeEditorial({ ...command(), evidence: { sources: [], nextReviewOn: null, sourceGap: "Missing" } }, "admin-one"); m.grant = activeGrant(); await expect(executeEditorial({ action: "review", workflowId: "driver", expectedRevision: 1, discipline: "clinical" }, "admin-one")).rejects.toMatchObject({ status: 400 }); });
});
describe("admin API boundary", () => {
  it("requires authenticated ADMIN for GET and POST", async () => { m.sessionRole = ""; expect((await GET()).status).toBe(401); expect((await post(command())).status).toBe(401); m.sessionRole = "DOCTOR"; expect((await GET()).status).toBe(403); expect((await post(command())).status).toBe(403); expect(m.tx).not.toHaveBeenCalled(); });
  it("rejects missing/foreign origin, non-JSON, invalid JSON and large chunked body", async () => { expect((await post(command(), null)).status).toBe(403); expect((await post(command(), "https://evil.test")).status).toBe(403); expect((await post(command(), "https://doctorium.test", "text/plain")).status).toBe(415); expect((await post("{")).status).toBe(400); expect((await post("x".repeat(65537))).status).toBe(413); expect(m.tx).not.toHaveBeenCalled(); });
  it("returns no-store and success only after audit commit", async () => { const result = await post(command()); expect(result.status).toBe(200); expect(result.headers.get("cache-control")).toBe("no-store"); expect(m.events).toHaveLength(1); });
  it("reports missing schema without inventing success", async () => { m.tx.mockRejectedValue({ code: "P2021" }); const result = await post(command()); expect(result.status).toBe(503); expect(await result.json()).toMatchObject({ code: "SCHEMA_MISSING" }); });
});

it("keeps retired workflow history readable without authorizing new mutations", async () => {
  m.row = { workflowId: "retired-topic", revision: 1, catalogHash: "old-hash", evidence: evidence() };
  const response = await GET();
  expect(response.status).toBe(200);
  expect((await response.json()).items[0].catalogChanged).toBe(true);
  expect(() => parseEditorialCommand({ ...command(), workflowId: "retired-topic" })).toThrow(EditorialError);
});
