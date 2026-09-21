// Entegrasyon — GET /api/cases route handler yetkisi + canCaseBeAccessedBy atama matrisi GERÇEK dev DB'ye karşı.
// getCurrentUser mock'lanır (oturum); db MOCK DEĞİL → gerçek dev branch (setup.ts yönlendirir).
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));
import { getCurrentUser } from "@/lib/auth";
import { GET } from "@/app/api/cases/route";
import { canCaseBeAccessedBy, caseAccessLevel } from "@/lib/ownership";
import { seedFixture, cleanupFixture, type Fixture } from "./helpers";
import type { SessionUser } from "@/lib/session";

const TEST_DB = process.env.TEST_DATABASE_URL;
const asUser = (u: Partial<SessionUser> | null) => vi.mocked(getCurrentUser).mockResolvedValue((u as SessionUser) ?? null);
const listReq = () => new Request("http://localhost/api/cases");
const u = (id: string, role: string) => ({ id, role }) as SessionUser;
const FIXTURE_BRANCH = "Kardiyoloji"; // helpers.ts seedFixture — tüm fixture doktor/vaka branşı

describe.skipIf(!TEST_DB)("entegrasyon: GET /api/cases yetki (gerçek dev DB)", () => {
  let f: Fixture;
  beforeAll(async () => { f = await seedFixture(); });
  afterAll(async () => { if (f) await cleanupFixture(f); });

  it("kimliksiz → 401", async () => { asUser(null); expect((await GET(listReq())).status).toBe(401); });
  it("hasta → 403 (staff-only)", async () => { asUser(u(f.patientId, "PATIENT")); expect((await GET(listReq())).status).toBe(403); });
  it("partner → 403 (hasta DB erişimi yok)", async () => { asUser(u("partner-x", "PARTNER")); expect((await GET(listReq())).status).toBe(403); });
  // 200 mutlu-yolları liste gövdesini çözer (decryptCaseFields) → KEK ister. KEK bilerek CI'a
  // KONMAZ (en kritik sır GitHub Secrets'a yayılmaz) → bu ikisi yalnız yerelde (KEK'li .env) koşar;
  // deny-yolları (401/403 + atama matrisi) KEK'siz her ortamda kapıdır.
  it.skipIf(!process.env.DATA_ENCRYPTION_KEK)("doktor → 200 + sayfalı zarf (kuyruk döner)", async () => {
    asUser(u(f.d1UserId, "DOCTOR"));
    const r = await GET(listReq());
    expect(r.status).toBe(200);
    const body = await r.json(); // v4.17: dizi → {items,total,page,pageSize,totalPages} zarfı
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe("number");
  });
  it.skipIf(!process.env.DATA_ENCRYPTION_KEK)("koordinatör/etik/admin → 200", async () => {
    for (const role of ["COORDINATOR", "ETHICS", "ADMIN"]) {
      asUser(u(`staff-${role}`, role));
      expect((await GET(listReq())).status).toBe(200);
    }
  });

  // ── Liste KAPSAMI (kontrol raporu 2026-09-17 K02 — lib/case-access tek kaynak) ──────────────────────
  it("AKTİVASYONSUZ (verified ama activatedAt null) doktor → 200 + BOŞ küme (eskiden yalnız verified'a bakılıyordu)", async () => {
    asUser(u(f.unactUserId, "DOCTOR"));
    const r = await GET(listReq());
    expect(r.status).toBe(200); // boş liste decrypt istemez → KEK'siz ortamda da koşar
    const body = await r.json();
    expect(body.total).toBe(0);
    expect(body.items).toEqual([]);
  });

  it.skipIf(!process.env.DATA_ENCRYPTION_KEK)("d1 kuyruğu: atanan + kendi havuzu VAR; başka-doktora-atanmış · silme-kilitli · DOCS_PENDING YOK", async () => {
    asUser(u(f.d1UserId, "DOCTOR"));
    const body = await (await GET(listReq())).json();
    const ids = new Set((body.items as { id: string }[]).map((c) => c.id));
    expect(ids.has(f.assignedCaseId)).toBe(true);
    expect(ids.has(f.unassignedCaseId)).toBe(true);
    expect(ids.has(f.d2AssignedCaseId)).toBe(false);
    expect(ids.has(f.lockedCaseId)).toBe(false);
    expect(ids.has(f.docsPendingCaseId)).toBe(false);
    // DTO: ham attachments/tourismPlan/freeCare değil türetimler
    const first = body.items[0] as Record<string, unknown>;
    expect("attachments" in first).toBe(false);
    expect(typeof first.hasFiles).toBe("boolean");
    expect(typeof first.lane).toBe("string");
    // K06 1C-a: havuz (atanmamış) satırı kimliksiz — ad yalnız atanmış vakada çözülür
    const rows = body.items as { id: string; patientName: string }[];
    expect(rows.find((c) => c.id === f.unassignedCaseId)?.patientName).toBe("Anonim hasta");
    expect(rows.find((c) => c.id === f.assignedCaseId)?.patientName).not.toBe("Anonim hasta");
  });

  it.skipIf(!process.env.DATA_ENCRYPTION_KEK)("personel kuyruğu: kilitli vaka HİÇBİR rolde listelenmez; DOCS_PENDING gözetim için görünür", async () => {
    asUser(u("staff-COORDINATOR", "COORDINATOR"));
    const body = await (await GET(new Request("http://localhost/api/cases?pageSize=100"))).json();
    const ids = new Set((body.items as { id: string }[]).map((c) => c.id));
    expect(ids.has(f.lockedCaseId)).toBe(false);
    expect(ids.has(f.docsPendingCaseId)).toBe(true);
  });
});

describe.skipIf(!TEST_DB)("entegrasyon: canCaseBeAccessedBy atama matrisi (gerçek doktor/vaka satırları)", () => {
  let f: Fixture;
  beforeAll(async () => { f = await seedFixture(); });
  afterAll(async () => { if (f) await cleanupFixture(f); });

  it("hasta: kendi vakası → true, başka hasta vakası → false", async () => {
    expect(await canCaseBeAccessedBy(u(f.patientId, "PATIENT"), { userId: f.patientId, doctorId: f.d1DoctorId, branch: FIXTURE_BRANCH, deletionLockedAt: null })).toBe(true);
    expect(await canCaseBeAccessedBy(u(f.patientId, "PATIENT"), { userId: f.otherPatientId, doctorId: null, branch: FIXTURE_BRANCH, deletionLockedAt: null })).toBe(false);
  });

  it("doğrulanmış doktor: kendisine ATANMIŞ → true (full)", async () => {
    expect(await canCaseBeAccessedBy(u(f.d1UserId, "DOCTOR"), { userId: f.patientId, doctorId: f.d1DoctorId, branch: FIXTURE_BRANCH, deletionLockedAt: null })).toBe(true);
  });

  it("K06 1C-a: ATANMAMIŞ kendi-branş havuz vakası → canCaseBeAccessedBy FALSE, seviye 'preview' (kimliksiz önizleme; kabul sonrası full)", async () => {
    const pool = { userId: f.patientId, doctorId: null, branch: FIXTURE_BRANCH, deletionLockedAt: null };
    expect(await canCaseBeAccessedBy(u(f.d1UserId, "DOCTOR"), pool)).toBe(false);
    expect(await caseAccessLevel(u(f.d1UserId, "DOCTOR"), pool)).toBe("preview");
  });

  it("BRANŞ-DARALTMASI: doğrulanmış doktor atanmamış YABANCI branş vakasına erişemez", async () => {
    // d1 branşı Kardiyoloji → atanmamış Onkoloji vakası branş uyuşmazlığından reddedilir (savunma-derinliği)
    expect(await canCaseBeAccessedBy(u(f.d1UserId, "DOCTOR"), { userId: f.patientId, doctorId: null, branch: "Onkoloji", deletionLockedAt: null })).toBe(false);
  });

  it("ÇAPRAZ-HEKİM: başka doktora atanmış vaka → false (IDOR engeli)", async () => {
    expect(await canCaseBeAccessedBy(u(f.d2UserId, "DOCTOR"), { userId: f.patientId, doctorId: f.d1DoctorId, branch: FIXTURE_BRANCH, deletionLockedAt: null })).toBe(false);
  });

  it("DOĞRULANMAMIŞ doktor → hiçbir vakaya erişemez (atanmamış dahil)", async () => {
    expect(await canCaseBeAccessedBy(u(f.unverUserId, "DOCTOR"), { userId: f.patientId, doctorId: null, branch: FIXTURE_BRANCH, deletionLockedAt: null })).toBe(false);
    expect(await canCaseBeAccessedBy(u(f.unverUserId, "DOCTOR"), { userId: f.patientId, doctorId: f.unverDoctorId, branch: FIXTURE_BRANCH, deletionLockedAt: null })).toBe(false);
  });

  it("K06 1C-b: koordinatör/yönetici klinik okumaz (false) + seviye logistics; Etik Kurul none — liste ucu yine 200 (lojistik)", async () => {
    const c = { userId: f.patientId, doctorId: f.d1DoctorId, branch: FIXTURE_BRANCH, deletionLockedAt: null };
    for (const role of ["COORDINATOR", "ADMIN"]) {
      expect(await canCaseBeAccessedBy(u(`staff-${role}`, role), c)).toBe(false);
      expect(await caseAccessLevel(u(`staff-${role}`, role), c)).toBe("logistics");
    }
    expect(await caseAccessLevel(u("staff-ETHICS", "ETHICS"), c)).toBe("none");
  });

  it("partner → hiçbir vakaya erişemez", async () => {
    expect(await canCaseBeAccessedBy(u("partner-x", "PARTNER"), { userId: f.patientId, doctorId: null, branch: FIXTURE_BRANCH, deletionLockedAt: null })).toBe(false);
  });
});
