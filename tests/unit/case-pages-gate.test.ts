// Birim — vaka SAYFALARININ okuma kapısı (kontrol raporu 2026-09-17 K03 + K05).
// K03: hasta vaka merkezi (/vaka/[caseId]) sahiplik kapısından sonra post-op kapanışına da bakar — personel kapalı
//      takipte sağlık metnini bu alternatif yoldan göremez; hasta muaf.
// K05: iki sayfa da decrypt'ten ÖNCE CASE_VIEW erişim kaydı yazar (JSON ucu api/cases/[id] ile aynı politika).
// Teknik: sayfa modülleri gerçek; decrypt mock'u "STOP_AFTER_GATE" fırlatır → kapı+kayıt sırası doğrulanır, sayfanın
// geri kalanı (ağır bileşen ağacı) koşmaz. Bu, "kayıt decrypt'ten önce" sözleşmesinin kendisidir.
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: { case: { findUnique: vi.fn() }, caseDocument: { findMany: vi.fn(async () => []) }, booking: { findFirst: vi.fn(async () => null) } },
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));
// K06 1C-a: kokpit sayfası erişim SEVİYESİNE bakar (none/preview/full); hasta vaka merkezi hâlâ canCaseBeAccessedBy.
vi.mock("@/lib/ownership", () => ({ canCaseBeAccessedBy: vi.fn(async () => true), caseAccessLevel: vi.fn(async () => "full") }));
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
import { caseAccessLevel } from "@/lib/ownership";
import { staffAccessClosed } from "@/lib/postop-access";
import { recordAccess } from "@/lib/audit";
import { decryptCaseFields } from "@/lib/crypto";
import type { SessionUser } from "@/lib/session";

const RAW = { id: "case-1", userId: "patient-1", doctorId: "doc-1", branch: "Kardiyoloji", deletionLockedAt: null, status: "IN_CONSULT", bookings: [], recovery: { id: "r" }, consultations: [], documents: [], doctor: null };
const asUser = (u: Partial<SessionUser>) => vi.mocked(getCurrentUser).mockResolvedValue(u as SessionUser);
const actions = () => vi.mocked(recordAccess).mock.calls.map((c) => c[0].action);

beforeEach(() => {
  vi.mocked(db.case.findUnique).mockReset().mockResolvedValue(RAW as never);
  vi.mocked(db.caseDocument.findMany).mockClear();
  vi.mocked(caseAccessLevel).mockReset().mockResolvedValue("full");
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

  it("açık vaka (full) → sahiplik kapısından sonra, decrypt'ten ÖNCE CASE_VIEW; belge üstverisi decrypt'ten önce ayrı sorguyla", async () => {
    asUser({ id: "u-doc", role: "DOCTOR" });
    await expect(CaseDetail({ params })).rejects.toThrow("STOP_AFTER_GATE");
    expect(actions()).toEqual(["CASE_VIEW"]);
    expect(vi.mocked(recordAccess).mock.calls[0][0]).toMatchObject({ resourceId: "case-1", subjectUserId: "patient-1", detail: "kokpit sayfası" });
    expect(db.caseDocument.findMany).toHaveBeenCalledTimes(1);
  });

  // K06 1C-a: aynı branştaki ATANMAMIŞ havuz vakası → KİMLİKSİZ önizleme (A09 madde 10.1) — belge üstverisi HİÇ sorgulanmaz,
  // tam decrypt yapılmaz (yalnız şikâyet + ad maskeleme için decryptField), erişim yine kayda geçer.
  it("havuz vakası (preview) → CasePreview ekranı; CASE_VIEW 'kimliksiz' detayıyla; belge sorgusu ve tam decrypt YOK", async () => {
    asUser({ id: "u-doc", role: "DOCTOR" });
    vi.mocked(caseAccessLevel).mockResolvedValue("preview");
    vi.mocked(db.case.findUnique).mockResolvedValue({ ...RAW, doctorId: null, status: "NEW", urgency: 4, country: "TR", language: "tr", createdAt: new Date(), durationText: null, attachments: "a.pdf", symptoms: "Ayşe Yılmaz göğüs ağrısı", patientName: "Ayşe Yılmaz" } as never);
    const el = (await CaseDetail({ params })) as { type: { name: string }; props: { dto: { complaint: string; fileCount: number } } };
    expect(el.type.name).toBe("CasePreview");
    expect(el.props.dto.complaint).toBe("[HASTA] göğüs ağrısı");
    expect(el.props.dto.fileCount).toBe(1);
    expect(actions()).toEqual(["CASE_VIEW"]);
    expect(vi.mocked(recordAccess).mock.calls[0][0].detail).toContain("kimliksiz havuz önizlemesi");
    expect(db.caseDocument.findMany).not.toHaveBeenCalled();
    expect(decryptCaseFields).not.toHaveBeenCalled();
  });

  // K06 1C-b: koordinatör/yönetici → LOJİSTİK görünüm (A09 10.2/10.4) — kimlik+iletişim+durum+rezervasyon; klinik bölüm ve belge sorgusu YOK.
  it("koordinatör (logistics) → CaseLogisticsView; CASE_VIEW 'lojistik' detayıyla; belge sorgusu ve tam decrypt YOK; DTO'da şikâyet yok", async () => {
    asUser({ id: "u-coord", role: "COORDINATOR" });
    vi.mocked(caseAccessLevel).mockResolvedValue("logistics");
    vi.mocked(db.case.findUnique).mockResolvedValue({ ...RAW, urgency: 3, country: "TR", language: "tr", createdAt: new Date(), patientName: "Ayşe Yılmaz", patientPhone: "+90 555", contactPreference: "phone", consultFee: 60, payMethod: null, payStatus: "PENDING", freeCare: false, freeCareStatus: null, tourismPlan: null, hospitalName: null, treatmentDaysMin: null, treatmentDaysMax: null, agencySentAt: null, pendingDocs: null, attachments: "a.pdf", symptoms: "GİZLİ şikâyet", doctor: { id: "doc-1", title: "Dr.", name: "X", branch: "Kardiyoloji" } } as never);
    const el = (await CaseDetail({ params })) as { type: { name: string }; props: { dto: Record<string, unknown> } };
    expect(el.type.name).toBe("CaseLogisticsView");
    expect(el.props.dto.logistics).toBe(true);
    expect(el.props.dto.patientName).toBe("Ayşe Yılmaz");
    for (const k of ["symptoms", "reasoning", "extra", "documents", "attachments", "healthDeclaration"]) expect(k in el.props.dto, k).toBe(false);
    expect(actions()).toEqual(["CASE_VIEW"]);
    expect(vi.mocked(recordAccess).mock.calls[0][0].detail).toContain("lojistik");
    expect(db.caseDocument.findMany).not.toHaveBeenCalled();
    expect(db.booking.findFirst).toHaveBeenCalledTimes(1);
    expect(decryptCaseFields).not.toHaveBeenCalled();
  });

  it("erişim seviyesi none → notFound; kayıt/decrypt/belge sorgusu yok", async () => {
    asUser({ id: "u-doc", role: "DOCTOR" });
    vi.mocked(caseAccessLevel).mockResolvedValue("none");
    await expect(CaseDetail({ params })).rejects.toThrow("NOT_FOUND");
    expect(recordAccess).not.toHaveBeenCalled();
    expect(db.caseDocument.findMany).not.toHaveBeenCalled();
  });

  it("rol dışı (PATIENT) → notFound; kayıt ve decrypt yok", async () => {
    asUser({ id: "patient-1", role: "PATIENT" });
    await expect(CaseDetail({ params })).rejects.toThrow("NOT_FOUND");
    expect(recordAccess).not.toHaveBeenCalled();
    expect(decryptCaseFields).not.toHaveBeenCalled();
  });
});
