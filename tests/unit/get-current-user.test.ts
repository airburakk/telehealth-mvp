// getCurrentUser — rol DB'den otoriter (rol bayatlığı kapatma, 2026-07-12) + sv iptal kontrolü.
// Rol token'dan okunsaydı DB'de değişse bile token TTL'i (7 gün) kadar bayat kalırdı; artık her
// istekte DB rolü kazanır. React cache() burada memoizasyonu bypass etmek için passthrough'a mock'lanır
// (test bağlamında request-scope yok). revokeUserSessions "session tablosu" primitifi ayrıca test edilir.
import { describe, it, expect, vi, beforeEach } from "vitest";

const getCookie = vi.fn();
vi.mock("react", async (importOriginal) => ({ ...(await importOriginal<typeof import("react")>()), cache: (fn: unknown) => fn }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: getCookie }) }));
vi.mock("@/lib/db", () => ({ db: { user: { findUnique: vi.fn(), update: vi.fn() } } }));

import { getCurrentUser, revokeUserSessions } from "@/lib/auth";
import { db } from "@/lib/db";
import { signToken } from "@/lib/session";

const TOKEN_USER = { id: "u1", email: "a@b.c", name: "T", role: "PATIENT" as const, cv: 2, sv: 1 };

describe("getCurrentUser — rol kaynağı DB", () => {
  beforeEach(() => {
    getCookie.mockReset();
    vi.mocked(db.user.findUnique).mockReset();
  });

  it("token PATIENT taşısa da DB rolü (ADMIN) döner — rol bayatlığı kapalı", async () => {
    getCookie.mockReturnValue({ value: await signToken(TOKEN_USER) }); // token role=PATIENT
    vi.mocked(db.user.findUnique).mockResolvedValue({ sessionVersion: 1, role: "ADMIN" } as never);
    const u = await getCurrentUser();
    expect(u?.role).toBe("ADMIN"); // token değil, DB kazanır
    expect(u?.id).toBe("u1"); // kimlik token'dan korunur
  });

  it("rol DB'de düşürülmüşse (DOCTOR→PATIENT) anında yansır", async () => {
    getCookie.mockReturnValue({ value: await signToken({ ...TOKEN_USER, role: "DOCTOR" }) });
    vi.mocked(db.user.findUnique).mockResolvedValue({ sessionVersion: 1, role: "PATIENT" } as never);
    expect((await getCurrentUser())?.role).toBe("PATIENT");
  });

  it("sv uyuşmazsa null (revocation korunur — rol taze olsa bile)", async () => {
    getCookie.mockReturnValue({ value: await signToken(TOKEN_USER) }); // sv=1
    vi.mocked(db.user.findUnique).mockResolvedValue({ sessionVersion: 2, role: "PATIENT" } as never);
    expect(await getCurrentUser()).toBeNull();
  });

  it("kullanıcı silinmişse null", async () => {
    getCookie.mockReturnValue({ value: await signToken(TOKEN_USER) });
    vi.mocked(db.user.findUnique).mockResolvedValue(null as never);
    expect(await getCurrentUser()).toBeNull();
  });

  it("cookie yoksa null (DB'ye gidilmez)", async () => {
    getCookie.mockReturnValue(undefined);
    expect(await getCurrentUser()).toBeNull();
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });
});

describe("revokeUserSessions (session tablosu primitifi)", () => {
  it("sessionVersion +1 artırır (logout-all + gelecek rol/parola değişiklikleri tek nokta)", async () => {
    vi.mocked(db.user.update).mockResolvedValue({} as never);
    await revokeUserSessions("u1");
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { sessionVersion: { increment: 1 } } });
  });
});
