// Entegrasyon — AI route IDOR (T3): analyze-docs çapraz-hekim → 403 (AI'ya GİTMEDEN, gerçek DB).
// Sadece REDDEDİLEN yollar test edilir (403/401): bunlar canCaseBeAccessedBy'de kısa devre yapar,
// Anthropic çağrısı OLMAZ → API anahtarı/maliyet gerekmez. 200 yolu (AI çağırır) kapsam dışı.
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));
import { getCurrentUser } from "@/lib/auth";
import { POST } from "@/app/api/cases/[id]/analyze-docs/route";
import { seedFixture, cleanupFixture, type Fixture } from "./helpers";
import type { SessionUser } from "@/lib/session";

const TEST_DB = process.env.TEST_DATABASE_URL;
const asUser = (u: Partial<SessionUser> | null) => vi.mocked(getCurrentUser).mockResolvedValue((u as SessionUser) ?? null);
const call = (caseId: string) =>
  POST(new Request(`http://localhost/api/cases/${caseId}/analyze-docs`, { method: "POST", body: "{}" }), {
    params: Promise.resolve({ id: caseId }),
  });

describe.skipIf(!TEST_DB)("entegrasyon: analyze-docs IDOR (gerçek dev DB)", () => {
  let f: Fixture;
  beforeAll(async () => { f = await seedFixture(); });
  afterAll(async () => { if (f) await cleanupFixture(f); });

  it("ÇAPRAZ-HEKİM (D1'e atanmış vakaya D2) → 403, AI çağrılmadan", async () => {
    asUser({ id: f.d2UserId, role: "DOCTOR" });
    expect((await call(f.assignedCaseId)).status).toBe(403);
  });

  it("kimliksiz → 401", async () => {
    asUser(null);
    expect((await call(f.assignedCaseId)).status).toBe(401);
  });

  it("hasta (klinik personel değil) → 401", async () => {
    asUser({ id: f.patientId, role: "PATIENT" });
    expect((await call(f.assignedCaseId)).status).toBe(401);
  });

  it("var olmayan vaka → 404 (staff)", async () => {
    asUser({ id: f.d1UserId, role: "DOCTOR" });
    expect((await call("yok-boyle-vaka")).status).toBe(404);
  });
});
