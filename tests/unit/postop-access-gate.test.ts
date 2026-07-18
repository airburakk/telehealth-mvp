// Birim — staffAccessClosed / caseRecoveryClosed SARMALAYICI dallanması (denetim 2026-07-18 #30).
// postop-access.test.ts saf çekirdeği (autoCloseDays/recoveryClosed) kapsar; buradaki nöbet ROL
// dallanması içindir: hasta post-op kapanmasından MUAFTIR (erişimi ownsCase yönetir), yalnız klinik
// personel kapanmaya tabidir. Bu kontrol ters çevrilirse ya hasta kendi verisinden kilitlenir ya da
// kapanmış post-op klinik personele yanlışça açılır (E2EE Faz 2A daraltmasının baypası). DB mock'lanır.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { staffAccessClosed, caseRecoveryClosed } from "@/lib/postop-access";
import { db } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  db: { recovery: { findUnique: vi.fn() } },
}));

const findUnique = vi.mocked(db.recovery.findUnique);
const COMPLETED = { status: "COMPLETED", startedAt: new Date(), branch: "Kardiyoloji", reopenedAt: null };

beforeEach(() => {
  findUnique.mockReset();
});

describe("staffAccessClosed — rol dallanması (hasta muaf, personel tabi)", () => {
  it("PATIENT: recovery COMPLETED olsa bile daima closed:false (DB'ye hiç gidilmez)", async () => {
    const r = await staffAccessClosed("case-1", { role: "PATIENT" });
    expect(r).toEqual({ closed: false, reason: null });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("null user: closed:false (kapı auth katmanının işi; burası fail-open kalır, DB'ye gidilmez)", async () => {
    const r = await staffAccessClosed("case-1", null);
    expect(r).toEqual({ closed: false, reason: null });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("klinik personel + COMPLETED recovery → closed:true reason:MANUAL", async () => {
    findUnique.mockResolvedValue(COMPLETED as never);
    for (const role of ["DOCTOR", "COORDINATOR", "ADMIN"]) {
      const r = await staffAccessClosed("case-1", { role });
      expect(r).toEqual({ closed: true, reason: "MANUAL" });
    }
  });

  it("klinik personel + recovery YOK (post-op hiç başlamadı) → closed:false", async () => {
    findUnique.mockResolvedValue(null as never);
    const r = await staffAccessClosed("case-1", { role: "DOCTOR" });
    expect(r).toEqual({ closed: false, reason: null });
  });

  it("klinik personel + AKTİF taze recovery → closed:false (süre dolmadı)", async () => {
    findUnique.mockResolvedValue({ status: "ACTIVE", startedAt: new Date(), branch: "Kardiyoloji", reopenedAt: null } as never);
    const r = await staffAccessClosed("case-1", { role: "DOCTOR" });
    expect(r).toEqual({ closed: false, reason: null });
  });
});

describe("caseRecoveryClosed — recovery satırı köprüsü", () => {
  it("recovery satırı recoveryClosed'a AYNEN taşınır (COMPLETED → MANUAL)", async () => {
    findUnique.mockResolvedValue(COMPLETED as never);
    expect(await caseRecoveryClosed("case-1")).toEqual({ closed: true, reason: "MANUAL" });
    expect(findUnique).toHaveBeenCalledWith({
      where: { caseId: "case-1" },
      select: { status: true, startedAt: true, branch: true, reopenedAt: true },
    });
  });
});
