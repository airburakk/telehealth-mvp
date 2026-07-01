// Entegrasyon — GET /api/cases route handler yetkisi + canCaseBeAccessedBy atama matrisi GERÇEK dev DB'ye karşı.
// getCurrentUser mock'lanır (oturum); db MOCK DEĞİL → gerçek dev branch (setup.ts yönlendirir).
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));
import { getCurrentUser } from "@/lib/auth";
import { GET } from "@/app/api/cases/route";
import { canCaseBeAccessedBy } from "@/lib/ownership";
import { seedFixture, cleanupFixture, type Fixture } from "./helpers";
import type { SessionUser } from "@/lib/session";

const TEST_DB = process.env.TEST_DATABASE_URL;
const asUser = (u: Partial<SessionUser> | null) => vi.mocked(getCurrentUser).mockResolvedValue((u as SessionUser) ?? null);
const listReq = () => new Request("http://localhost/api/cases");
const u = (id: string, role: string) => ({ id, role }) as SessionUser;

describe.skipIf(!TEST_DB)("entegrasyon: GET /api/cases yetki (gerçek dev DB)", () => {
  let f: Fixture;
  beforeAll(async () => { f = await seedFixture(); });
  afterAll(async () => { if (f) await cleanupFixture(f); });

  it("kimliksiz → 401", async () => { asUser(null); expect((await GET(listReq())).status).toBe(401); });
  it("hasta → 403 (staff-only)", async () => { asUser(u(f.patientId, "PATIENT")); expect((await GET(listReq())).status).toBe(403); });
  it("partner → 403 (hasta DB erişimi yok)", async () => { asUser(u("partner-x", "PARTNER")); expect((await GET(listReq())).status).toBe(403); });
  it("doktor → 200 + dizi (kuyruk döner)", async () => {
    asUser(u(f.d1UserId, "DOCTOR"));
    const r = await GET(listReq());
    expect(r.status).toBe(200);
    expect(Array.isArray(await r.json())).toBe(true);
  });
  it("koordinatör/etik/admin → 200", async () => {
    for (const role of ["COORDINATOR", "ETHICS", "ADMIN"]) {
      asUser(u(`staff-${role}`, role));
      expect((await GET(listReq())).status).toBe(200);
    }
  });
});

describe.skipIf(!TEST_DB)("entegrasyon: canCaseBeAccessedBy atama matrisi (gerçek hekim/vaka satırları)", () => {
  let f: Fixture;
  beforeAll(async () => { f = await seedFixture(); });
  afterAll(async () => { if (f) await cleanupFixture(f); });

  it("hasta: kendi vakası → true, başka hasta vakası → false", async () => {
    expect(await canCaseBeAccessedBy(u(f.patientId, "PATIENT"), { userId: f.patientId, doctorId: f.d1DoctorId })).toBe(true);
    expect(await canCaseBeAccessedBy(u(f.patientId, "PATIENT"), { userId: f.otherPatientId, doctorId: null })).toBe(false);
  });

  it("doğrulanmış hekim: kendisine ATANMIŞ + ATANMAMIŞ (kuyruk) → true", async () => {
    expect(await canCaseBeAccessedBy(u(f.d1UserId, "DOCTOR"), { userId: f.patientId, doctorId: f.d1DoctorId })).toBe(true);
    expect(await canCaseBeAccessedBy(u(f.d1UserId, "DOCTOR"), { userId: f.patientId, doctorId: null })).toBe(true);
  });

  it("ÇAPRAZ-HEKİM: başka hekime atanmış vaka → false (IDOR engeli)", async () => {
    expect(await canCaseBeAccessedBy(u(f.d2UserId, "DOCTOR"), { userId: f.patientId, doctorId: f.d1DoctorId })).toBe(false);
  });

  it("DOĞRULANMAMIŞ hekim → hiçbir vakaya erişemez (atanmamış dahil)", async () => {
    expect(await canCaseBeAccessedBy(u(f.unverUserId, "DOCTOR"), { userId: f.patientId, doctorId: null })).toBe(false);
    expect(await canCaseBeAccessedBy(u(f.unverUserId, "DOCTOR"), { userId: f.patientId, doctorId: f.unverDoctorId })).toBe(false);
  });

  it("partner → hiçbir vakaya erişemez", async () => {
    expect(await canCaseBeAccessedBy(u("partner-x", "PARTNER"), { userId: f.patientId, doctorId: null })).toBe(false);
  });
});
