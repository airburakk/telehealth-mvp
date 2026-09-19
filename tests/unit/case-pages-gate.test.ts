// Birim — vaka SAYFALARININ okuma kapısı (kontrol raporu 2026-09-17 K03 + K05).
// K03: hasta vaka merkezi (/vaka/[caseId]) sahiplik kapısından sonra post-op kapanışına da bakar — personel kapalı
//      takipte sağlık metnini bu alternatif yoldan göremez; hasta muaf.
// K05: iki sayfa da decrypt'ten ÖNCE CASE_VIEW erişim kaydı yazar (JSON ucu api/cases/[id] ile aynı politika).
// Teknik: sayfa modülleri gerçek; decrypt mock'u "STOP_AFTER_GATE" fırlatır → kapı+kayıt sırası doğrulanır, sayfanın
// geri kalanı (ağır bileşen ağacı) koşmaz. Bu, "kayıt decrypt'ten önce" sözleşmesinin kendisidir.
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: { case: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/ownership", () => ({ canCaseBeAccessedBy: vi.fn(async () => true) }));
vi.mock("@/lib/postop-access", () => ({ staffAccessClosed: vi.fn(async () => ({ closed: false, reason: null })) }));
vi.mock("@/lib/audit", () => ({ recordAccess: vi.fn(async () => {}), reqMeta: () => ({ ip: null, userAgent: null }) }));
vi.mock("@/lib/request-meta", () => ({ headersMeta: vi.fn(async () => ({ ip: "10.0.0.1", userAgent: "vitest" })) }));
vi.mock("@/lib/crypto", () => ({
  decryptCaseFields: vi.fn(() => { throw new Error("STOP_AFTER_GATE"); }),
  decryptField: (v: string | null) => v,
}));
vi.mock("@/lib/doctor-activation", () => ({ clinicalDoctorFor: vi.fn(async () => ({ doctorId: "doc-1", branch: "Kardiyoloji", verified: true })) }));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }),
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }),
  useRouter: vi.fn(),
  usePathname: vi.fn(),
  useSearchParams: vi.fn(),
}));

import CaseHubPage from "@/app/vaka/[caseId]/page";
import CaseDetail from "@/app/doktor/vaka/[id]/page";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { staffAccessClosed } from "@/lib/postop-access";
import { recordAccess } from "@/lib/audit";
import { decryptCaseFields } from "@/lib/crypto";
import type { SessionUser } from "@/lib/session";

const RAW = { id: "case-1", userId: "patient-1", doctorId: "doc-1", branch: "Kardiyoloji", deletionLockedAt: null, status: "IN_CONSULT", bookings: [], recovery: { id: "r" }, consultations: [], documents: [], doctor: null };
const asUser = (u: Partial<SessionUser>) => vi.mocked(getCurrentUser).mockResolvedValue(u as SessionUser);
const actions = () => vi.mocked(recordAccess).mock.calls.map((c) => c[0].action);

beforeEach(() => {
  vi.mocked(db.case.findUnique).mockReset().mockResolvedValue(RAW as never);
  vi.mocked(staffAccessClosed).mockReset().mockResolvedValue({ closed: false, reason: null });
  vi.mocked(recordAccess).mockClear();
  vi.mocked(decryptCaseFields).mockClear();
});

describe("/vaka/[caseId] — hasta vaka merkezi (K03 + K05)", () => {
  const params = Promise.resolve({ caseId: "case-1" });

  it("personel + KAPALI post-op → PostopClosedScreen; POSTOP_ACCESS_DENIED yazılır; decrypt HİÇ çağrılmaz", async () => {
    asUser({ id: "u-doc", role: "DOCTOR" });
    vi.mocked(staffAccessClosed).mockResolvedValue({ closed: true, reason: "AUTO" });
    const el = (await CaseHubPage({ params })) as { type: { name: string } };
    expect(el.type.name).toBe("PostopClosedScreen");
    expect(actions()).toEqual(["POSTOP_ACCESS_DENIED"]);
    expect(vi.mocked(recordAccess).mock.calls[0][0]).toMatchObject({ resourceId: "case-1", subjectUserId: "patient-1", ip: "10.0.0.1" });
    expect(decryptCaseFields).not.toHaveBeenCalled();
  });

  it("personel + AÇIK post-op → decrypt'ten ÖNCE CASE_VIEW kaydı (sayfa yolu da audit'li)", async () => {
    asUser({ id: "u-doc", role: "DOCTOR" });
    await expect(CaseHubPage({ params })).rejects.toThrow("STOP_AFTER_GATE");
    expect(actions()).toEqual(["CASE_VIEW"]);
    expect(vi.mocked(recordAccess).mock.calls[0][0]).toMatchObject({ actor: { id: "u-doc" }, subjectUserId: "patient-1", userAgent: "vitest" });
    expect(decryptCaseFields).toHaveBeenCalledTimes(1);
  });

  it("sahibi HASTA: kapanış onu bağlamaz (helper PATIENT→false) → CASE_VIEW + decrypt", async () => {
    asUser({ id: "patient-1", role: "PATIENT" });
    await expect(CaseHubPage({ params })).rejects.toThrow("STOP_AFTER_GATE");
    expect(vi.mocked(staffAccessClosed).mock.calls[0][1]).toMatchObject({ role: "PATIENT" });
    expect(actions()).toEqual(["CASE_VIEW"]);
  });
});

describe("/doktor/vaka/[id] — kokpit (K05)", () => {
  const params = Promise.resolve({ id: "case-1" });

  it("kapalı post-op → PostopClosedScreen + POSTOP_ACCESS_DENIED (subject dar select ile), decrypt yok", async () => {
    asUser({ id: "u-doc", role: "DOCTOR" });
    vi.mocked(staffAccessClosed).mockResolvedValue({ closed: true, reason: "MANUAL" });
    vi.mocked(db.case.findUnique).mockResolvedValue({ userId: "patient-1" } as never);
    const el = (await CaseDetail({ params })) as { type: { name: string } };
    expect(el.type.name).toBe("PostopClosedScreen");
    expect(actions()).toEqual(["POSTOP_ACCESS_DENIED"]);
    expect(vi.mocked(recordAccess).mock.calls[0][0]).toMatchObject({ subjectUserId: "patient-1" });
    expect(decryptCaseFields).not.toHaveBeenCalled();
  });

  it("açık vaka → sahiplik kapısından sonra, decrypt'ten ÖNCE CASE_VIEW", async () => {
    asUser({ id: "u-doc", role: "DOCTOR" });
    await expect(CaseDetail({ params })).rejects.toThrow("STOP_AFTER_GATE");
    expect(actions()).toEqual(["CASE_VIEW"]);
    expect(vi.mocked(recordAccess).mock.calls[0][0]).toMatchObject({ resourceId: "case-1", subjectUserId: "patient-1", detail: "kokpit sayfası" });
  });

  it("rol dışı (PATIENT) → notFound; kayıt ve decrypt yok", async () => {
    asUser({ id: "patient-1", role: "PATIENT" });
    await expect(CaseDetail({ params })).rejects.toThrow("NOT_FOUND");
    expect(recordAccess).not.toHaveBeenCalled();
    expect(decryptCaseFields).not.toHaveBeenCalled();
  });
});
