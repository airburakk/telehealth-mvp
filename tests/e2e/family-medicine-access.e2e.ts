import { test, expect } from "@playwright/test";
test.describe("family medicine editorial access boundaries", () => {
  test.beforeEach(async ({ baseURL }) => {
    test.skip(!baseURL || !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname), "Local demo only");
  });
  test("rejects an unauthenticated API caller", async ({ request }) => {
    expect((await request.get("/api/admin/aile-hekimligi")).status()).toBe(401);
  });
  test("does not grant a doctor admin or expert access", async ({ request, baseURL }) => {
    expect((await request.post("/api/auth/login", { data: { email: "doktor@air.test", password: "1234" } })).ok()).toBeTruthy();
    expect((await request.get("/api/admin/aile-hekimligi")).status()).toBe(403);
    expect((await request.post("/api/admin/aile-hekimligi", { headers: { origin: baseURL! }, data: { action: "save", workflowId: "driver", expectedRevision: 0, evidence: { sources: [], nextReviewOn: null, sourceGap: "test" } } })).status()).toBe(403);
  });
  test("admin cannot bypass origin or inject reviewer identity", async ({ request, baseURL }) => {
    expect((await request.post("/api/auth/login", { data: { email: "admin@air.test", password: "1234" } })).ok()).toBeTruthy();
    const data = { action: "review", workflowId: "driver", expectedRevision: 0, discipline: "clinical" };
    expect((await request.post("/api/admin/aile-hekimligi", { headers: { origin: "https://untrusted.example" }, data })).status()).toBe(403);
    expect((await request.post("/api/admin/aile-hekimligi", { headers: { origin: baseURL! }, data: { ...data, actorId: "forged-reviewer" } })).status()).toBe(400);
    const read = await request.get("/api/admin/aile-hekimligi");
    expect([200, 503]).toContain(read.status());
    if (read.status() === 503) expect((await read.json()).code).toBe("SCHEMA_MISSING");
    // No successful mutation is attempted: no migration or reviewer grant is required.
  });
});
