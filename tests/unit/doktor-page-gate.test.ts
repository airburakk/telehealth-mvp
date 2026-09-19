// Birim — src/app/doktor/page.tsx KAPISI (kontrol raporu 2026-09-17 K01/K02/K09; raporun .cjs provasının vitest eşleniği).
// Sözleşme: kimliksiz/iptal edilmiş oturum → giriş yönlendirmesi ve HİÇBİR vaka sorgusu · yanlış rol → kendi ana
// sayfası · profilsiz / doğrulanmamış DOCTOR → sorgusuz kapı ekranı (personel dalına DÜŞMEZ) · aktivasyonsuz →
// /doktor/baslangic · geçerli doktor → kapsam lib/case-access'ten (deletionLockedAt:null + OR) · COORDINATOR →
// personel kapsamı. Sayfa modülü gerçek; db/auth/yan modüller mock.
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: vi.fn() },
    doctor: { findUnique: vi.fn() },
    case: { count: vi.fn(async () => 0), findMany: vi.fn(async () => []) },
    secondOpinionCase: { findMany: vi.fn(async () => []), count: vi.fn(async () => 0) },
  },
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }),
  useRouter: vi.fn(),
  usePathname: vi.fn(),
}));
vi.mock("@/lib/clinical-duty", () => ({ dutyFeed: vi.fn(async () => null) }));
vi.mock("@/lib/free-care", () => ({ waitingCount: vi.fn(async () => 0) }));
vi.mock("@/lib/consultation-requests", () => ({ openCountForDoctor: vi.fn(async () => 0), openRowsForDoctor: vi.fn(async () => []) }));
vi.mock("@/lib/crypto", () => ({ decryptField: (v: string | null) => v }));
vi.mock("@/lib/doctor-home", () => ({ panelVisibility: () => ({ duty: true, so: false, freeCare: false, consult: false, tourism: false }) }));
vi.mock("@/lib/doctor-activation", () => ({ hasClinicalAccess: (d: { activatedAt: Date | null }) => !!d.activatedAt }));

import DoctorPanel from "@/app/doktor/page";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { SessionUser } from "@/lib/session";

const asUser = (u: Partial<SessionUser> | null) => vi.mocked(getCurrentUser).mockResolvedValue((u as SessionUser) ?? null);
const render = (sp: Record<string, string> = {}) => DoctorPanel({ searchParams: Promise.resolve(sp) });
const DOC = { id: "doc-1", branch: "Kardiyoloji", verified: true, onboardedAt: new Date(), activatedAt: new Date() };
const noCaseQueries = () => {
  expect(db.case.count).not.toHaveBeenCalled();
  expect(db.case.findMany).not.toHaveBeenCalled();
};

beforeEach(() => {
  vi.mocked(db.user.findUnique).mockReset();
  vi.mocked(db.doctor.findUnique).mockReset();
  vi.mocked(db.case.count).mockClear();
  vi.mocked(db.case.findMany).mockClear();
  vi.mocked(redirect).mockClear();
});

describe("DoctorPanel — kapı (K01)", () => {
  it("kimliksiz / iptal edilmiş oturum (getCurrentUser=null) → giriş yönlendirmesi, HİÇBİR vaka sorgusu yok", async () => {
    asUser(null);
    await expect(render()).rejects.toThrow("REDIRECT:/giris?next=%2Fdoktor");
    noCaseQueries();
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it("yanlış rol (PATIENT) → kendi ana sayfasına yönlendirme, sorgu yok", async () => {
    asUser({ id: "p1", role: "PATIENT" });
    await expect(render()).rejects.toThrow(/^REDIRECT:/);
    expect(vi.mocked(redirect).mock.calls[0][0]).not.toMatch(/^\/doktor/);
    noCaseQueries();
  });

  it("DOCTOR profilsiz (doctorId yok) → sorgusuz kapı ekranı; personel dalına DÜŞMEZ", async () => {
    asUser({ id: "u-doc", role: "DOCTOR" });
    vi.mocked(db.user.findUnique).mockResolvedValue({ doctorId: null } as never);
    const el = (await render()) as { type: { name: string } };
    expect(el.type.name).toBe("GateScreen");
    noCaseQueries();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("DOCTOR aktivasyonsuz → /doktor/baslangic, sorgu yok", async () => {
    asUser({ id: "u-doc", role: "DOCTOR" });
    vi.mocked(db.user.findUnique).mockResolvedValue({ doctorId: "doc-1" } as never);
    vi.mocked(db.doctor.findUnique).mockResolvedValue({ ...DOC, activatedAt: null } as never);
    await expect(render()).rejects.toThrow("REDIRECT:/doktor/baslangic");
    noCaseQueries();
  });

  it("DOCTOR aktive ama admin onaysız (verified=false) → sorgusuz kapı ekranı", async () => {
    asUser({ id: "u-doc", role: "DOCTOR" });
    vi.mocked(db.user.findUnique).mockResolvedValue({ doctorId: "doc-1" } as never);
    vi.mocked(db.doctor.findUnique).mockResolvedValue({ ...DOC, verified: false } as never);
    const el = (await render()) as { type: { name: string } };
    expect(el.type.name).toBe("GateScreen");
    noCaseQueries();
  });
});

describe("DoctorPanel — kapsam (K02/K09)", () => {
  it("geçerli doktor → sayılar ve liste lib/case-access kapsamıyla (deletionLockedAt:null + atanan/havuz OR), sayfalı", async () => {
    asUser({ id: "u-doc", role: "DOCTOR" });
    vi.mocked(db.user.findUnique).mockResolvedValue({ doctorId: "doc-1" } as never);
    vi.mocked(db.doctor.findUnique).mockResolvedValue(DOC as never);
    const el = (await render({ page: "2" })) as { type: string | { name: string } };
    expect(el.type).toBe("div"); // tam panel çizildi (kök <div>; kapı ekranı GateScreen DEĞİL)
    const scope = { deletionLockedAt: null, OR: [{ doctorId: "doc-1" }, { doctorId: null, branch: "Kardiyoloji", status: { in: ["NEW", "IN_REVIEW"] } }] };
    // toplam sayımı kapsamla
    expect(vi.mocked(db.case.count).mock.calls[0][0]).toEqual({ where: scope });
    // liste sorgusu: aynı kapsam + sayfalama (take 50 — eski take:100/sayfasız yol yok)
    const listCall = vi.mocked(db.case.findMany).mock.calls.find((c) => (c[0] as { take?: number }).take === 50) as [{ where: unknown; skip: number }];
    expect(listCall).toBeDefined();
    expect(listCall[0].where).toEqual(scope);
    expect(listCall[0].skip).toBe(0); // toplam 0 → sayfa 1'e sıkıştırıldı
    expect(vi.mocked(db.case.findMany).mock.calls.some((c) => (c[0] as { take?: number }).take === 100)).toBe(false);
  });

  it("COORDINATOR → personel kapsamı (tüm kuyruk, kilitliler hariç); doktor profili sorgulanmaz", async () => {
    asUser({ id: "u-coord", role: "COORDINATOR" });
    const el = (await render()) as { type: string | { name: string } };
    expect(el.type).toBe("div"); // tam panel (kapı ekranı değil)
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(vi.mocked(db.case.count).mock.calls[0][0]).toEqual({ where: { deletionLockedAt: null } });
  });
});
