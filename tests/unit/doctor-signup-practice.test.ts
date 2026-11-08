import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ doctorCreate: vi.fn(), userCreate: vi.fn(), registry: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { $transaction: m.transaction } }));
vi.mock("@/lib/crypto", () => ({ encryptField: (v: string) => v }));
vi.mock("@/lib/ht-registry", () => ({ verifyDoctorAgainstRegistry: m.registry }));
vi.mock("@/lib/doctorium-trial-flag", () => ({ isTrialEnabled: () => false }));
import { createDoctorAccount, type DoctorSignupInput } from "@/lib/doctor-signup";
const input: DoctorSignupInput = { name: "Fixture", email: "fixture@example.test", passwordHash: "hash", title: "Dr.", branch: "Pratisyen Hekim (Uzmanlık Yok)", city: "Ankara", languages: "Türkçe" };
beforeEach(() => {
 vi.clearAllMocks(); m.doctorCreate.mockResolvedValue({ id: "doctor" }); m.userCreate.mockResolvedValue({ id: "user", doctorId: "doctor" });
 m.transaction.mockImplementation(fn => fn({ doctor: { create: m.doctorCreate }, user: { create: m.userCreate } }));
});
describe("shared account creation practice preference", () => {
 it.each(["asm", "egitim-arastirma", "diger"] as const)("stores only explicit setting %s", async practiceSetting => {
   await createDoctorAccount({ ...input, practiceSetting });
   const data=m.doctorCreate.mock.calls[0][0].data;
   expect(JSON.parse(data.doctoriumViewPrefs)).toEqual({ practice: { setting: practiceSetting } });
   expect(data.branch).toBe(input.branch);
   expect(data).not.toHaveProperty("newsBranches"); expect(data).not.toHaveProperty("digestChannel"); expect(data).not.toHaveProperty("feedModules");
 });
 it.each([undefined, null])("leaves existing defaults alone when setting is omitted (%s)", async practiceSetting => {
   await createDoctorAccount({ ...input, practiceSetting });
   expect(m.doctorCreate.mock.calls[0][0].data).not.toHaveProperty("doctoriumViewPrefs");
 });
 it("rejects invalid internal input before account creation", async () => {
   await expect(createDoctorAccount({ ...input, practiceSetting: "invalid" as never })).rejects.toThrow("Invalid practice setting");
   expect(m.transaction).not.toHaveBeenCalled(); expect(m.registry).not.toHaveBeenCalled();
 });
});
