// Birim — src/app/vakalarim/page.tsx (kontrol raporu 2026-09-17 K09-hasta / H11, v6.281). Sözleşme: rol kapısı
// (PATIENT/ADMIN; diğerleri giriş yönlendirmesi, sorgusuz) · sahiplik where'i HER sorguda · grup sayıları sunucuda
// (3 grup × 2 model) · varsayılan sekme "işlem gerekiyor" varsa o · imleç → keyset where · sayfa+1 kesimi + sonraki imleç.
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    case: { count: vi.fn(async () => 0), findMany: vi.fn(async () => []) },
    secondOpinionCase: { count: vi.fn(async () => 0), findMany: vi.fn(async () => []) },
  },
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }) }));
vi.mock("@/lib/crypto", () => ({ decryptField: (v: string | null) => v }));

import MyCasesPage from "@/app/vakalarim/page";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { PATIENT_PAGE_SIZE, encodeCursor } from "@/lib/patient-cases";
import type { SessionUser } from "@/lib/session";

type Where = { AND: Record<string, unknown>[] };
const render = (sp: Record<string, string> = {}) => MyCasesPage({ searchParams: Promise.resolve(sp) });
const caseRow = (i: number) => ({
  id: `case${String(i).padStart(3, "0")}`, patientName: "Ad", country: "TR", status: "NEW", urgency: 2, branch: "Kardiyoloji",
  symptoms: "s", createdAt: new Date(Date.UTC(2026, 8, 1, 0, 0, i)), tourismPlan: null, freeCare: false, bookings: [], recovery: null,
});

describe("vakalarim sayfası", () => {
  beforeEach(() => {
    vi.mocked(db.case.count).mockReset().mockResolvedValue(0);
    vi.mocked(db.secondOpinionCase.count).mockReset().mockResolvedValue(0);
    vi.mocked(db.case.findMany).mockReset().mockResolvedValue([] as never);
    vi.mocked(db.secondOpinionCase.findMany).mockReset().mockResolvedValue([] as never);
  });

  it("kimliksiz ve DOCTOR → giriş yönlendirmesi, HİÇBİR sorgu yok", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    await expect(render()).rejects.toThrow("REDIRECT:/giris?next=/vakalarim");
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "d", role: "DOCTOR" } as SessionUser);
    await expect(render()).rejects.toThrow("REDIRECT:");
    expect(db.case.count).not.toHaveBeenCalled();
    expect(db.case.findMany).not.toHaveBeenCalled();
  });

  it("PATIENT: sahiplik her where'de; 3 grup × 2 model sayım; varsayılan sekme devam (aksiyon 0)", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "p1", role: "PATIENT" } as SessionUser);
    const el = await render();
    expect(db.case.count).toHaveBeenCalledTimes(3);
    expect(db.secondOpinionCase.count).toHaveBeenCalledTimes(3);
    for (const call of vi.mocked(db.case.count).mock.calls) expect((call[0]!.where as Where).AND[0]).toEqual({ userId: "p1" });
    for (const call of vi.mocked(db.secondOpinionCase.count).mock.calls) expect((call[0]!.where as Where).AND[0]).toEqual({ patientId: "p1" });
    const listWhere = vi.mocked(db.case.findMany).mock.calls[0][0]!.where as { AND: [Where, Record<string, unknown>] };
    expect(listWhere.AND[0].AND[0]).toEqual({ userId: "p1" });
    expect(listWhere.AND[0].AND[1]).toEqual({ status: { in: ["NEW", "IN_REVIEW", "IN_CONSULT"] } }); // devam
    expect(listWhere.AND[1]).toEqual({}); // imleç yok
    expect(vi.mocked(db.case.findMany).mock.calls[0][0]!.take).toBe(PATIENT_PAGE_SIZE + 1);
    expect(el.props.group).toBe("devam");
    expect(el.props.nextCursor).toBeNull();
  });

  it("işlem gerektiren başvuru varsa varsayılan sekme 'aksiyon'; ?grup=tamam DONE listeler", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "p1", role: "PATIENT" } as SessionUser);
    vi.mocked(db.case.count).mockResolvedValueOnce(1); // ilk çağrı = aksiyon grubu (Case)
    let el = await render();
    expect(el.props.group).toBe("aksiyon");
    expect(el.props.counts.aksiyon).toBe(1);
    el = await render({ grup: "tamam" });
    expect(el.props.group).toBe("tamam");
    const w = vi.mocked(db.case.findMany).mock.calls.at(-1)![0]!.where as { AND: [Where, Record<string, unknown>] };
    expect(w.AND[0].AND[1]).toEqual({ status: { in: ["DONE"] } });
  });

  it("imleç keyset where'e çevrilir; sayfa+1 gelirse sonraki imleç var ve sayfa kesilir", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "p1", role: "PATIENT" } as SessionUser);
    const cursor = encodeCursor({ createdAt: new Date("2026-09-10T00:00:00.000Z"), id: "case999" });
    vi.mocked(db.case.findMany).mockResolvedValue(Array.from({ length: PATIENT_PAGE_SIZE + 1 }, (_, i) => caseRow(i)) as never);
    const el = await render({ cursor, grup: "devam" });
    const w = vi.mocked(db.case.findMany).mock.calls[0][0]!.where as { AND: [Where, { OR: unknown[] }] };
    expect(w.AND[1].OR).toHaveLength(2);
    expect(el.props.items).toHaveLength(PATIENT_PAGE_SIZE);
    expect(el.props.nextCursor).toBe(encodeCursor(el.props.items[PATIENT_PAGE_SIZE - 1]));
    expect(el.props.cursor).toBe(cursor);
    expect(el.props.items[0].row.nextStep.length).toBeGreaterThan(10);
  });

  it("ADMIN: sahiplik kısıtı yok ({})", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "a1", role: "ADMIN" } as SessionUser);
    await render();
    expect((vi.mocked(db.case.count).mock.calls[0][0]!.where as Where).AND[0]).toEqual({});
  });
});
