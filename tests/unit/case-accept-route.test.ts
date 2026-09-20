// Birim — POST /api/cases/[id]/accept (K06 1C-a, 2026-09-20): havuzdaki (atanmamış, KENDİ branşı) vakayı üstlenme.
// Sözleşme: yalnız doğrulanmış + klinik-aktive DOCTOR · yabancı branş 403 · silme kilidi 404 · zaten bana atanmış 200
// (idempotent, YAZIM YOK) · başkasına atanmış 409 · NEW/IN_REVIEW dışı 409 · atomik updateMany (doctorId:null + branş +
// durum koşullu; yarışı kaybeden 409, audit yok) · başarı 200 + CASE_ACCEPT (hasta erişim kaydında görür).
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    case: { findUnique: vi.fn(), updateMany: vi.fn(async (_args: unknown) => ({ count: 1 })) },
    user: { findUnique: vi.fn() },
    doctor: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/audit", () => ({ recordAccess: vi.fn(async () => {}), reqMeta: () => ({ ip: null, userAgent: null }) }));

import { POST } from "@/app/api/cases/[id]/accept/route";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { recordAccess } from "@/lib/audit";
import type { SessionUser } from "@/lib/session";

const asUser = (u: Partial<SessionUser> | null) => vi.mocked(getCurrentUser).mockResolvedValue((u as SessionUser) ?? null);
const call = () => POST(new Request("http://localhost/api/cases/case-1/accept", { method: "POST" }), { params: Promise.resolve({ id: "case-1" }) });
const CASE = { id: "case-1", userId: "patient-1", doctorId: null as string | null, branch: "Kardiyoloji", status: "NEW", deletionLockedAt: null as Date | null };
const setCase = (o: Partial<typeof CASE>) => vi.mocked(db.case.findUnique).mockResolvedValue({ ...CASE, ...o } as never);
// DOCTOR bağlamı (doctor-activation.clinicalDoctorFor → db.user + db.doctor; hasClinicalAccess = activatedAt)
const setDoctor = (doctorId: string, o: { verified?: boolean; activatedAt?: Date | null; branch?: string } = {}) => {
  vi.mocked(db.user.findUnique).mockResolvedValue({ doctorId } as never);
  vi.mocked(db.doctor.findUnique).mockResolvedValue({ verified: true, activatedAt: new Date(), branch: "Kardiyoloji", ...o } as never);
};
const actions = () => vi.mocked(recordAccess).mock.calls.map((c) => c[0].action);

beforeEach(() => {
  vi.mocked(db.case.findUnique).mockReset();
  vi.mocked(db.case.updateMany).mockReset().mockResolvedValue({ count: 1 } as never);
  vi.mocked(db.user.findUnique).mockReset();
  vi.mocked(db.doctor.findUnique).mockReset();
  vi.mocked(recordAccess).mockClear();
});

describe("POST /accept — yetki", () => {
  it("kimliksiz → 401", async () => { asUser(null); expect((await call()).status).toBe(401); });

  it("hasta / koordinatör / admin → 403 (yalnız doktor üstlenir), sorgu yok", async () => {
    for (const role of ["PATIENT", "COORDINATOR", "ADMIN", "PARTNER"]) {
      asUser({ id: "x", role: role as SessionUser["role"] });
      expect((await call()).status).toBe(403);
    }
    expect(db.case.findUnique).not.toHaveBeenCalled();
  });

  it("silme kilitli vaka → 404 (varlığı ele verilmez), yazım yok", async () => {
    asUser({ id: "u-doc", role: "DOCTOR" }); setCase({ deletionLockedAt: new Date("2026-07-15") }); setDoctor("doc-1");
    expect((await call()).status).toBe(404);
    expect(db.case.updateMany).not.toHaveBeenCalled();
  });

  it("aktivasyonsuz / doğrulanmamış / profilsiz doktor → 403", async () => {
    asUser({ id: "u-doc", role: "DOCTOR" }); setCase({});
    setDoctor("doc-1", { activatedAt: null });
    expect((await call()).status).toBe(403);
    setDoctor("doc-1", { verified: false });
    expect((await call()).status).toBe(403);
    vi.mocked(db.user.findUnique).mockResolvedValue({ doctorId: null } as never);
    expect((await call()).status).toBe(403);
    expect(db.case.updateMany).not.toHaveBeenCalled();
  });

  it("yabancı branş havuz vakası → 403", async () => {
    asUser({ id: "u-doc", role: "DOCTOR" }); setCase({ branch: "Onkoloji" }); setDoctor("doc-1");
    const r = await call();
    expect(r.status).toBe(403);
    expect((await r.json()).error).toContain("branşınızın havuzunda değil");
    expect(db.case.updateMany).not.toHaveBeenCalled();
  });
});

describe("POST /accept — durum makinesi ve atomik atama", () => {
  beforeEach(() => { asUser({ id: "u-doc", role: "DOCTOR" }); setDoctor("doc-1"); });

  it("zaten BANA atanmış → 200 already:true, yazım ve audit YOK (idempotent)", async () => {
    setCase({ doctorId: "doc-1" });
    const r = await call();
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ accepted: true, already: true });
    expect(db.case.updateMany).not.toHaveBeenCalled();
    expect(actions()).toEqual([]);
  });

  it("BAŞKA doktora atanmış → 409", async () => {
    setCase({ doctorId: "doc-2" });
    expect((await call()).status).toBe(409);
    expect(db.case.updateMany).not.toHaveBeenCalled();
  });

  it("havuz dışı durumlar → 409 (DOCS_PENDING · IN_CONSULT · DONE), yazım yok", async () => {
    for (const status of ["DOCS_PENDING", "IN_CONSULT", "DONE"]) {
      setCase({ status });
      expect((await call()).status).toBe(409);
    }
    expect(db.case.updateMany).not.toHaveBeenCalled();
  });

  it("başarı: koşullu updateMany (doctorId:null + branş + NEW/IN_REVIEW) → 200 + CASE_ACCEPT (subject = hasta)", async () => {
    setCase({ status: "IN_REVIEW" });
    const r = await call();
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ accepted: true });
    expect(vi.mocked(db.case.updateMany).mock.calls[0][0]).toEqual({
      where: { id: "case-1", doctorId: null, branch: "Kardiyoloji", status: { in: ["NEW", "IN_REVIEW"] } },
      data: { doctorId: "doc-1" },
    });
    expect(actions()).toEqual(["CASE_ACCEPT"]);
    const rec = vi.mocked(recordAccess).mock.calls[0][0];
    expect(rec.subjectUserId).toBe("patient-1");
    expect(rec.resourceId).toBe("case-1");
  });

  it("YARIŞ: updateMany count=0 (biri önce üstlendi) → 409, audit yok", async () => {
    setCase({});
    vi.mocked(db.case.updateMany).mockResolvedValue({ count: 0 } as never);
    const r = await call();
    expect(r.status).toBe(409);
    expect((await r.json()).error).toContain("üstlenildi");
    expect(actions()).toEqual([]);
  });
});
