// Birim — GET /api/second-opinion/cases (K06 1C-b, 2026-09-21): personel (koordinatör/yönetici) LOJİSTİK liste — tanı özeti DTO'dan
// düşer (A09 10.2/10.4); hasta kendi vakalarını tam görür; Etik Kurul 403 (soCaseListScope null — 10.3); kapsam tek kaynaktan.
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: { secondOpinionCase: { findMany: vi.fn(), create: vi.fn() }, user: { findUnique: vi.fn() }, doctor: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/crypto", () => ({
  decryptSoCaseFields: <T,>(c: T) => c, decryptField: (v: string | null) => v, encryptField: (v: string) => v,
}));

import { GET } from "@/app/api/second-opinion/cases/route";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import type { SessionUser } from "@/lib/session";

const asUser = (u: Partial<SessionUser> | null) => vi.mocked(getCurrentUser).mockResolvedValue((u as SessionUser) ?? null);
const ROW = { id: "so-1", patientId: "patient-1", branch: "cardiology", diagnosisSummary: "GİZLİ tanı özeti", status: "SUBMITTED", createdAt: new Date(), deletionLockedAt: null, documents: [], payment: null, requests: [] };

beforeEach(() => {
  vi.mocked(db.secondOpinionCase.findMany).mockReset().mockResolvedValue([ROW] as never);
});

describe("GET /api/second-opinion/cases — lojistik liste", () => {
  it("koordinatör → 200, tanı özeti NULL, kapsam kilitsiz tüm vakalar", async () => {
    asUser({ id: "u-coord", role: "COORDINATOR" });
    const r = await GET();
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body[0].diagnosisSummary).toBeNull();
    expect(JSON.stringify(body)).not.toContain("GİZLİ");
    expect(vi.mocked(db.secondOpinionCase.findMany).mock.calls[0][0]).toMatchObject({ where: { deletionLockedAt: null } });
  });

  it("yönetici → tanı özeti NULL", async () => {
    asUser({ id: "u-admin", role: "ADMIN" });
    expect((await (await GET()).json())[0].diagnosisSummary).toBeNull();
  });

  it("Etik Kurul → 403, sorgu yok", async () => {
    asUser({ id: "u-ethics", role: "ETHICS" });
    expect((await GET()).status).toBe(403);
    expect(db.secondOpinionCase.findMany).not.toHaveBeenCalled();
  });

  it("hasta → kendi vakaları, tanı özeti görünür", async () => {
    asUser({ id: "patient-1", role: "PATIENT" });
    const body = await (await GET()).json();
    expect(body[0].diagnosisSummary).toBe("GİZLİ tanı özeti");
    expect(vi.mocked(db.secondOpinionCase.findMany).mock.calls[0][0]).toMatchObject({ where: { patientId: "patient-1", deletionLockedAt: null } });
  });
});
