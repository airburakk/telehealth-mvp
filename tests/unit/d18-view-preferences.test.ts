import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  role: "DOCTOR", stored: '{"mevzuat":{"d":"180"}}', tail: Promise.resolve(),
  lock: vi.fn(), transaction: vi.fn(), update: vi.fn(), find: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => ({ id: "fixture-user", role: m.role }) }));
vi.mock("@/lib/doctorium", () => ({ RANGE_OPTIONS: [{ key: "7" }, { key: "30" }, { key: "180" }, { key: "365" }], DEFAULT_RANGE: "30", SECTOR_CATEGORIES: [{ key: "teknoloji" }] }));
vi.mock("@/lib/tus-data", () => ({ approvedTusSummaries: () => [], tusBranches: () => [] }));
vi.mock("@/lib/db", () => ({ db: { user: { findUnique: async () => ({ doctorId: "fixture-doctor" }) }, doctor: { findUnique: m.find, update: m.update }, $transaction: m.transaction } }));
import { POST } from "@/app/api/doctor/view-filters/route";

beforeEach(() => {
  vi.clearAllMocks(); m.role = "DOCTOR"; m.stored = '{"mevzuat":{"d":"180"}}'; m.tail = Promise.resolve();
  m.find.mockImplementation(async () => { const snapshot = m.stored; await Promise.resolve(); return { doctoriumViewPrefs: snapshot }; });
  m.update.mockImplementation(async ({ data }: { data: { doctoriumViewPrefs: string } }) => { m.stored = data.doctoriumViewPrefs; });
  m.lock.mockResolvedValue([{ id: "fixture-doctor" }]);
  m.transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => {
    const pending = m.tail.then(() => fn({ $queryRaw: m.lock, doctor: { findUnique: m.find, update: m.update } }));
    m.tail = pending.then(() => undefined, () => undefined); return pending;
  });
});
const post = (body: object) => POST(new Request("http://localhost/api/doctor/view-filters", { method: "POST", body: JSON.stringify(body) }));
describe("D18 account preference merge", () => {
  it("preserves both concurrent module changes and an unrelated existing preference", async () => {
    const responses = await Promise.all([post({ module: "sektorel", source: "ulusal", range: "7" }), post({ module: "ilac", range: "365" })]);
    expect(responses.map(r => r.status)).toEqual([200, 200]);
    expect(JSON.parse(m.stored)).toEqual({ mevzuat: { d: "180" }, sektorel: { s: "ulusal", d: "7", c: null }, ilac: { d: "365" } });
    expect(m.lock).toHaveBeenCalledTimes(2);
    expect(m.lock.mock.calls.every(call => call[1] === "fixture-doctor")).toBe(true);
  });
  it("keeps the existing normalization contract", async () => {
    expect((await post({ module: "sektorel", source: "unknown", range: "unknown", category: "unknown" })).status).toBe(200);
    expect(JSON.parse(m.stored).sektorel).toEqual({ s: null, d: "30", c: null });
  });
  it("rejects an unknown module before writing", async () => {
    expect((await post({ module: "unknown" })).status).toBe(400); expect(m.transaction).not.toHaveBeenCalled();
  });
  it("preserves the existing role rejection", async () => {
    m.role = "COORDINATOR"; expect((await post({ module: "ilac", range: "7" })).status).toBe(401); expect(m.transaction).not.toHaveBeenCalled();
  });
});


describe("optional work setting API", () => {
  it("stores the setting without altering specialty or other preferences", async () => {
    expect((await post({ module: "practice", setting: "asm" })).status).toBe(200);
    expect(JSON.parse(m.stored)).toEqual({ mevzuat: { d: "180" }, practice: { setting: "asm" } });
    expect(Object.keys(m.update.mock.calls[0][0].data)).toEqual(["doctoriumViewPrefs"]);
  });
  it("allows explicitly clearing the setting", async () => {
    m.stored = '{"practice":{"setting":"asm"},"ilac":{"d":"7"}}';
    expect((await post({ module: "practice", setting: null })).status).toBe(200);
    expect(JSON.parse(m.stored)).toEqual({ practice: { setting: null }, ilac: { d: "7" } });
  });
  it("rejects missing and invalid settings before writing", async () => {
    for (const setting of [undefined, "Aile Hekimliği", "unknown", [], {}, true]) {
      expect((await post({ module: "practice", setting })).status).toBe(400);
    }
    expect(m.transaction).not.toHaveBeenCalled();
  });
  it("preserves concurrent setting and existing-module writes", async () => {
    await Promise.all([post({ module: "practice", setting: "egitim-arastirma" }), post({ module: "ilac", range: "365" })]);
    expect(JSON.parse(m.stored)).toEqual({ mevzuat: { d: "180" }, practice: { setting: "egitim-arastirma" }, ilac: { d: "365" } });
  });
  it("requires the existing doctor role", async () => {
    m.role = "COORDINATOR";
    expect((await post({ module: "practice", setting: "asm" })).status).toBe(401);
    expect(m.transaction).not.toHaveBeenCalled();
  });
  it("recovers a legacy array without silently discarding the new setting", async () => {
    m.stored = "[]";
    expect((await post({ module: "practice", setting: "diger" })).status).toBe(200);
    expect(JSON.parse(m.stored)).toEqual({ practice: { setting: "diger" } });
  });
});
