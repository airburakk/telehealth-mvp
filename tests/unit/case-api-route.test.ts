// Birim — GET /api/cases/[id] erişim SEVİYESİ dalları (K06 1C-a/1C-b): hasta/atanmış doktor tam gövde · koordinatör/yönetici LOJİSTİK
// DTO (klinik içerik yok, CASE_VIEW "lojistik" detayı) · Etik Kurul 403 (kayıt yok) · kimliksiz 401. db/auth/audit/crypto mock, ownership GERÇEK.
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: { case: { findUnique: vi.fn() }, user: { findUnique: vi.fn() }, doctor: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/postop-access", () => ({ staffAccessClosed: vi.fn(async () => ({ closed: false, reason: null })) }));
vi.mock("@/lib/audit", () => ({ recordAccess: vi.fn(async () => {}), reqMeta: () => ({ ip: null, userAgent: null }) }));
vi.mock("@/lib/crypto", () => ({ decryptField: (v: string | null) => v, decryptCaseFields: <T,>(c: T) => c }));

import { GET } from "@/app/api/cases/[id]/route";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { recordAccess } from "@/lib/audit";
import type { SessionUser } from "@/lib/session";

const asUser = (u: Partial<SessionUser> | null) => vi.mocked(getCurrentUser).mockResolvedValue((u as SessionUser) ?? null);
const call = () => GET(new Request("http://localhost/api/cases/case-1"), { params: Promise.resolve({ id: "case-1" }) });
const ITEM = {
  id: "case-1", userId: "patient-1", doctorId: "doc-1", branch: "Kardiyoloji", status: "NEW", deletionLockedAt: null,
  patientName: "Ayşe Yılmaz", patientPhone: "+90 555", contactPreference: "phone", country: "TR", language: "tr", urgency: 4,
  createdAt: new Date("2026-09-21T10:00:00Z"), consultFee: 60, payMethod: null, payStatus: "PENDING", freeCare: false, freeCareStatus: null,
  tourismPlan: null, hospitalName: null, treatmentDaysMin: null, treatmentDaysMax: null, agencySentAt: null, pendingDocs: null,
  attachments: "a.pdf", symptoms: "GİZLİ şikâyet", reasoning: "GİZLİ gerekçe", extra: "{\"soru\":\"GİZLİ\"}", dischargeReport: "GİZLİ epikriz",
  healthDeclaration: "GİZLİ beyan", labResults: null,
  doctor: { id: "doc-1", title: "Dr.", name: "X", branch: "Kardiyoloji" },
  consultations: [{ id: "cons-1", notes: "GİZLİ görüşme notu", doctor: null }],
};
const CLINICAL_KEYS = ["symptoms", "reasoning", "extra", "dischargeReport", "healthDeclaration", "consultations", "attachments", "labResults"];

beforeEach(() => {
  vi.mocked(db.case.findUnique).mockReset().mockResolvedValue(ITEM as never);
  vi.mocked(recordAccess).mockClear();
});

describe("GET /api/cases/[id] — seviye dalları", () => {
  it("kimliksiz → 401", async () => { asUser(null); expect((await call()).status).toBe(401); });

  it("koordinatör → 200 LOJİSTİK DTO: kimlik+iletişim var, klinik anahtarlar YOK, CASE_VIEW 'lojistik'", async () => {
    asUser({ id: "u-coord", role: "COORDINATOR" });
    const r = await call();
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.logistics).toBe(true);
    expect(body.patientName).toBe("Ayşe Yılmaz");
    expect(body.patientPhone).toBe("+90 555");
    expect(body.fileCount).toBe(1);
    for (const k of CLINICAL_KEYS) expect(k in body, k).toBe(false);
    expect(JSON.stringify(body)).not.toContain("GİZLİ");
    expect(vi.mocked(recordAccess).mock.calls.map((c) => c[0].action)).toEqual(["CASE_VIEW"]);
    expect(vi.mocked(recordAccess).mock.calls[0][0].detail).toContain("lojistik");
  });

  it("yönetici → aynı lojistik DTO (A09 10.4)", async () => {
    asUser({ id: "u-admin", role: "ADMIN" });
    const body = await (await call()).json();
    expect(body.logistics).toBe(true);
    for (const k of CLINICAL_KEYS) expect(k in body, k).toBe(false);
  });

  it("Etik Kurul → 403, kayıt yok (10.3: yalnız anonim panel)", async () => {
    asUser({ id: "u-ethics", role: "ETHICS" });
    expect((await call()).status).toBe(403);
    expect(recordAccess).not.toHaveBeenCalled();
  });

  it("sahibi hasta → tam gövde (şikâyet + görüşme notu çözülmüş)", async () => {
    asUser({ id: "patient-1", role: "PATIENT" });
    const body = await (await call()).json();
    expect(body.logistics).toBeUndefined();
    expect(body.symptoms).toBe("GİZLİ şikâyet");
    expect(body.consultations[0].notes).toBe("GİZLİ görüşme notu");
  });

  it("başka hasta → 403", async () => {
    asUser({ id: "patient-2", role: "PATIENT" });
    expect((await call()).status).toBe(403);
  });
});
