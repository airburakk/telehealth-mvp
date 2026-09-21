// Birim — POST /api/cases/[id]/consult (kontrol raporu 2026-09-19 D03) + lib/ownership canStartConsultation.
// Sözleşme: yetki YAZMA kapısıyla (hasta yalnız atanmış doktorla katılır · doktor kendi vakası ya da kendi branş
// havuzu [üstlenme=atama] · koordinatör/admin yalnız atanmış vakada) · post-op kapalı personel 403 + audit · aktif
// görüşme varsa 200 (idempotent) · yeni görüşme YALNIZ NEW/IN_REVIEW'dan (DONE → 409) · durum-koşullu updateMany
// yarışı kaybedince 409 ve consultation OLUŞMAZ · başarı CONSULT_START yazar.
import { describe, it, expect, vi, beforeEach } from "vitest";

const tx = {
  case: { updateMany: vi.fn(async (_args: unknown) => ({ count: 1 })) },
  consultation: { create: vi.fn(async (_args: unknown) => ({ id: "cons-new" })) },
};
vi.mock("@/lib/db", () => ({
  db: {
    case: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    doctor: { findUnique: vi.fn() },
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  },
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/postop-access", () => ({ staffAccessClosed: vi.fn(async () => ({ closed: false, reason: null })) }));
vi.mock("@/lib/audit", () => ({ recordAccess: vi.fn(async () => {}), reqMeta: () => ({ ip: null, userAgent: null }) }));

import { POST } from "@/app/api/cases/[id]/consult/route";
import { canStartConsultation } from "@/lib/ownership";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { staffAccessClosed } from "@/lib/postop-access";
import { recordAccess } from "@/lib/audit";
import type { SessionUser } from "@/lib/session";

const asUser = (u: Partial<SessionUser> | null) => vi.mocked(getCurrentUser).mockResolvedValue((u as SessionUser) ?? null);
const call = () => POST(new Request("http://localhost/api/cases/case-1/consult", { method: "POST" }), { params: Promise.resolve({ id: "case-1" }) });
type CaseRow = { id: string; userId: string; doctorId: string | null; branch: string; status: string; deletionLockedAt: Date | null; consultations: { id: string }[] };
const CASE: CaseRow = { id: "case-1", userId: "patient-1", doctorId: "doc-1", branch: "Kardiyoloji", status: "NEW", deletionLockedAt: null, consultations: [] };
const setCase = (o: Partial<typeof CASE>) => vi.mocked(db.case.findUnique).mockResolvedValue({ ...CASE, ...o } as never);
// DOCTOR bağlamı (ownership.doctorContext → db.user + db.doctor)
const setDoctor = (doctorId: string, o: { verified?: boolean; activatedAt?: Date | null; branch?: string } = {}) => {
  vi.mocked(db.user.findUnique).mockResolvedValue({ doctorId } as never);
  vi.mocked(db.doctor.findUnique).mockResolvedValue({ verified: true, activatedAt: new Date(), branch: "Kardiyoloji", ...o } as never);
};
const actions = () => vi.mocked(recordAccess).mock.calls.map((c) => c[0].action);

beforeEach(() => {
  vi.mocked(db.case.findUnique).mockReset();
  vi.mocked(db.user.findUnique).mockReset();
  vi.mocked(db.doctor.findUnique).mockReset();
  vi.mocked(db.$transaction).mockClear();
  tx.case.updateMany.mockReset().mockResolvedValue({ count: 1 });
  tx.consultation.create.mockReset().mockResolvedValue({ id: "cons-new" });
  vi.mocked(staffAccessClosed).mockReset().mockResolvedValue({ closed: false, reason: null });
  vi.mocked(recordAccess).mockClear();
});

describe("POST /consult — yetki (kim YAPAR)", () => {
  it("kimliksiz → 401", async () => { asUser(null); expect((await call()).status).toBe(401); });

  it("hasta: kendi vakası + atanmış doktor + NEW → 201, atama korunur, CONSULT_START", async () => {
    asUser({ id: "patient-1", role: "PATIENT" }); setCase({});
    const r = await call();
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ consultationId: "cons-new" });
    expect(tx.case.updateMany.mock.calls[0][0]).toEqual({ where: { id: "case-1", status: { in: ["NEW", "IN_REVIEW"] } }, data: { status: "IN_CONSULT", doctorId: "doc-1" } });
    expect(actions()).toEqual(["CONSULT_START"]);
    expect(vi.mocked(recordAccess).mock.calls[0][0].detail).toContain("atama=existing");
  });

  it("hasta: atanmış doktor YOK → 409, işlem yok (hasta doktor seçemez)", async () => {
    asUser({ id: "patient-1", role: "PATIENT" }); setCase({ doctorId: null });
    expect((await call()).status).toBe(409);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("hasta: başkasının vakası → 403", async () => {
    asUser({ id: "patient-2", role: "PATIENT" }); setCase({});
    expect((await call()).status).toBe(403);
  });

  it("doktor: BAŞKA doktora atanmış vaka → 403 (eskiden okuma kapısı geçirebiliyordu)", async () => {
    asUser({ id: "u-doc2", role: "DOCTOR" }); setDoctor("doc-2"); setCase({ doctorId: "doc-1" });
    expect((await call()).status).toBe(403);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("doktor: atanmamış KENDİ branş havuzu → üstlenir (doctorId=kendisi), atama=self", async () => {
    asUser({ id: "u-doc2", role: "DOCTOR" }); setDoctor("doc-2"); setCase({ doctorId: null });
    expect((await call()).status).toBe(201);
    expect(tx.case.updateMany.mock.calls[0][0]).toMatchObject({ data: { doctorId: "doc-2" } });
    expect(vi.mocked(recordAccess).mock.calls[0][0].detail).toContain("atama=self");
  });

  it("doktor: atanmamış YABANCI branş → 403; aktivasyonsuz doktor → 403", async () => {
    asUser({ id: "u-doc2", role: "DOCTOR" }); setDoctor("doc-2", { branch: "Onkoloji" }); setCase({ doctorId: null });
    expect((await call()).status).toBe(403);
    setDoctor("doc-2", { activatedAt: null }); setCase({ doctorId: "doc-2" });
    expect((await call()).status).toBe(403);
  });

  // K06 1C-b (2026-09-21): görüşme odası/transkript klinik içerik → koordinatör/yönetici görüşme AÇMAZ (A09 10.2/10.4). Eski D03 kuralı
  // ("atanmış vakada açabilir") koordinatörün odaya girebildiği döneme aitti.
  it("koordinatör / yönetici: atanmış doktor olsa da 403 — görüşme açmaz, işlem yok", async () => {
    for (const role of ["COORDINATOR", "ADMIN"]) {
      asUser({ id: `u-${role}`, role: role as SessionUser["role"] }); setCase({});
      expect((await call()).status).toBe(403);
      setCase({ doctorId: null });
      expect((await call()).status).toBe(403);
    }
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("silme-kilitli vaka → herkese 403", async () => {
    asUser({ id: "patient-1", role: "PATIENT" }); setCase({ deletionLockedAt: new Date() });
    expect((await call()).status).toBe(403);
  });
});

describe("POST /consult — durum makinesi + post-op + yarış", () => {
  it("DONE vaka → 409, yeni görüşme AÇILMAZ (yeniden açma ayrı süreç)", async () => {
    asUser({ id: "u-doc", role: "DOCTOR" }); setDoctor("doc-1"); setCase({ status: "DONE" });
    const r = await call();
    expect(r.status).toBe(409);
    expect((await r.json()).error).toMatch(/tamamlanmış/);
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(recordAccess).not.toHaveBeenCalled();
  });

  it("DOCS_PENDING → 409", async () => {
    asUser({ id: "u-doc", role: "DOCTOR" }); setDoctor("doc-1"); setCase({ status: "DOCS_PENDING" });
    expect((await call()).status).toBe(409);
  });

  it("post-op kapalı (personel) → 403 + POSTOP_ACCESS_DENIED; hasta muaf", async () => {
    vi.mocked(staffAccessClosed).mockImplementation(async (_id, u) => (u?.role === "PATIENT" ? { closed: false, reason: null } : { closed: true, reason: "AUTO" }));
    asUser({ id: "u-doc", role: "DOCTOR" }); setDoctor("doc-1"); setCase({});
    expect((await call()).status).toBe(403);
    expect(actions()).toEqual(["POSTOP_ACCESS_DENIED"]);
    expect(db.$transaction).not.toHaveBeenCalled();
    vi.mocked(recordAccess).mockClear();
    asUser({ id: "patient-1", role: "PATIENT" }); setCase({});
    expect((await call()).status).toBe(201);
  });

  it("aktif görüşme varsa 200 + mevcut id (DONE olsa bile yeni kayıt yok)", async () => {
    asUser({ id: "u-doc", role: "DOCTOR" }); setDoctor("doc-1"); setCase({ status: "DONE", consultations: [{ id: "cons-active" }] });
    const r = await call();
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ consultationId: "cons-active" });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("yarış: durum-koşullu updateMany count=0 → 409, consultation OLUŞMAZ, audit yok", async () => {
    asUser({ id: "u-doc", role: "DOCTOR" }); setDoctor("doc-1"); setCase({});
    tx.case.updateMany.mockResolvedValue({ count: 0 });
    expect((await call()).status).toBe(409);
    expect(tx.consultation.create).not.toHaveBeenCalled();
    expect(recordAccess).not.toHaveBeenCalled();
  });
});

describe("canStartConsultation — saf karar tablosu", () => {
  it("ETHICS/PARTNER/AGENCY görüşme açamaz; null kullanıcı 403", async () => {
    for (const role of ["ETHICS", "PARTNER", "AGENCY", "HEALTH_PRO"]) {
      const v = await canStartConsultation({ id: "x", role } as SessionUser, { userId: "p", doctorId: "d", branch: "K", deletionLockedAt: null, status: "NEW" });
      expect(v.ok).toBe(false);
    }
    expect((await canStartConsultation(null, { userId: "p", doctorId: "d", branch: "K", deletionLockedAt: null, status: "NEW" })).ok).toBe(false);
  });
});
