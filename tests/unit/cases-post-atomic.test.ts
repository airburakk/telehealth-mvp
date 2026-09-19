// Birim — POST /api/cases (kontrol raporu 2026-09-17 K04 + K07).
// K04: AI kapısı (rol·hız·rıza·boyut) `runTriage`'dan ÖNCE — kapı reddederse LLM çağrılmaz.
// K07: belge imzaları HİÇBİR yazımdan (ve LLM çağrısından) ÖNCE doğrulanır — 415'te vaka OLUŞMAZ; vaka + belgeler tek
//      transaction; transaction düşerse depoya yüklenen nesneler temizlenir.
import { describe, it, expect, vi, beforeEach } from "vitest";

const tx = {
  case: { create: vi.fn(async (_a: unknown) => ({ id: "case-new", status: "NEW", branch: "Nöroloji" })) },
  caseDocument: { createMany: vi.fn(async (_a: unknown) => ({ count: 1 })) },
};
vi.mock("@/lib/db", () => ({
  db: {
    case: { create: vi.fn(), count: vi.fn(), findMany: vi.fn() },
    caseDocument: { createMany: vi.fn() },
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  },
}));
vi.mock("@/lib/api-auth", () => ({
  requireUser: vi.fn(async () => ({ user: { id: "p1", role: "PATIENT", name: "Hasta" }, error: null })),
  requireStaff: vi.fn(),
}));
vi.mock("@/lib/ai-gate", () => ({ requireAiTriage: vi.fn() }));
vi.mock("@/lib/triage-llm", () => ({ runTriage: vi.fn(async () => ({ branch: "Nöroloji", branchKey: "noroloji", urgency: 2, confidence: 0.8, reasoning: "gerekçe" })) }));
vi.mock("@/lib/notify", () => ({ notifyDoctorsByBranch: vi.fn(async () => {}), notifyUser: vi.fn(async () => {}) }));
vi.mock("@/lib/patient-journey", () => ({ stampPatientProfile: vi.fn(async () => {}) }));
vi.mock("@/lib/contact-pref", () => ({ parseContactFields: () => ({ phone: null, contactPreference: "APP" }) }));
vi.mock("@/lib/crypto", () => ({ encryptField: (v: string | null) => v, decryptField: (v: string | null) => v }));
vi.mock("@/lib/storage", () => ({
  storeDocument: vi.fn(async (uri: string) => `blob:v1:${uri.slice(-4)}`),
  deleteDocument: vi.fn(async (_ref: string | null) => true),
}));
vi.mock("@/lib/document-mime", () => ({
  detectDocumentKind: (uri: string) => (uri.includes("GOOD") ? { mime: "application/pdf", ext: "pdf" } : null),
  DOC_REJECT_MESSAGE: "Belge türü tanınmadı.",
}));
vi.mock("@/lib/doctor-activation", () => ({ clinicalDoctorFor: vi.fn() }));

import { POST } from "@/app/api/cases/route";
import { db } from "@/lib/db";
import { requireAiTriage } from "@/lib/ai-gate";
import { runTriage } from "@/lib/triage-llm";
import { storeDocument, deleteDocument } from "@/lib/storage";
import { notifyDoctorsByBranch } from "@/lib/notify";
import { NextResponse } from "next/server";

const GOOD = "data:application/pdf;base64,GOOD";
const BAD = "data:application/octet-stream;base64,BAD!";
const call = (b: Record<string, unknown>) =>
  POST(new Request("http://localhost/api/cases", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ patientName: "Test", symptoms: "baş ağrısı", ...b }) }));
const gateOk = () => vi.mocked(requireAiTriage).mockResolvedValue({ ok: true, input: { symptoms: "baş ağrısı" } });

beforeEach(() => {
  vi.mocked(requireAiTriage).mockReset();
  vi.mocked(runTriage).mockClear();
  vi.mocked(db.$transaction).mockClear();
  vi.mocked(storeDocument).mockClear();
  vi.mocked(deleteDocument).mockClear();
  vi.mocked(notifyDoctorsByBranch).mockClear();
  tx.case.create.mockClear();
  tx.caseDocument.createMany.mockClear();
});

describe("POST /api/cases — K04 AI kapısı", () => {
  it("kapı reddetti (rıza yok → 403) → runTriage ve yazım YOK", async () => {
    vi.mocked(requireAiTriage).mockResolvedValue({ ok: false, response: NextResponse.json({ error: "rıza", code: "AI_CONSENT_REQUIRED" }, { status: 403 }) });
    const r = await call({});
    expect(r.status).toBe(403);
    expect(runTriage).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.case.create).not.toHaveBeenCalled();
  });

  it("boş ad/şikayet → 400 kapıdan ÖNCE (ucuz doğrulama önce)", async () => {
    gateOk();
    expect((await call({ symptoms: "" })).status).toBe(400);
    expect(requireAiTriage).not.toHaveBeenCalled();
  });
});

describe("POST /api/cases — K07 doğrula→yaz + tek işlem", () => {
  it("geçersiz belge → 415; vaka OLUŞMAZ, LLM çağrılmaz, depoya yükleme yok", async () => {
    gateOk();
    const r = await call({ documents: [{ label: "x", content: BAD }] });
    expect(r.status).toBe(415);
    expect(runTriage).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(tx.case.create).not.toHaveBeenCalled();
    expect(storeDocument).not.toHaveBeenCalled();
  });

  it("geçerli belge → 201; vaka + belge AYNI transaction'da; bildirim gider", async () => {
    gateOk();
    const r = await call({ documents: [{ label: "rapor.pdf", content: GOOD }] });
    expect(r.status).toBe(201);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.case.create).toHaveBeenCalledTimes(1);
    expect(tx.caseDocument.createMany).toHaveBeenCalledTimes(1);
    const rows = (tx.caseDocument.createMany.mock.calls[0][0] as { data: { caseId: string; mimeType: string; content: string }[] }).data;
    expect(rows[0]).toMatchObject({ caseId: "case-new", mimeType: "application/pdf", content: "blob:v1:GOOD" });
    expect(notifyDoctorsByBranch).toHaveBeenCalled();
  });

  it("transaction düşerse yüklenen depo nesneleri temizlenir ve hata yükselir (yarım vaka yok)", async () => {
    gateOk();
    vi.mocked(db.$transaction).mockRejectedValueOnce(new Error("DB düştü"));
    await expect(call({ documents: [{ label: "a", content: GOOD }, { label: "b", content: GOOD }] })).rejects.toThrow("DB düştü");
    expect(deleteDocument).toHaveBeenCalledTimes(2);
    expect(vi.mocked(deleteDocument).mock.calls[0][0]).toBe("blob:v1:GOOD");
    expect(notifyDoctorsByBranch).not.toHaveBeenCalled();
  });

  it("belgesiz başvuru → 201, createMany çağrılmaz", async () => {
    gateOk();
    expect((await call({})).status).toBe(201);
    expect(tx.caseDocument.createMany).not.toHaveBeenCalled();
  });
});
