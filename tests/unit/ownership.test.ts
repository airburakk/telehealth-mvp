// Birim testleri — lib/ownership.ts (T2 vaka-ataması bazlı erişim modeli). db + auth mock'lanır.
import { describe, it, expect, vi, beforeEach } from "vitest";

// canCaseBeAccessedBy DOCTOR dalı için db lookup yapar → mock. auth (next/headers) import zincirini de kes.
vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: vi.fn() },
    doctor: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));

import { canCaseBeAccessedBy, ownsSecondOpinionCase } from "@/lib/ownership";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/session";

const user = (role: string, id = "u1"): SessionUser => ({ id, role } as SessionUser);

describe("canCaseBeAccessedBy — rol bazlı", () => {
  it("kimliksiz → false", async () => {
    expect(await canCaseBeAccessedBy(null, { userId: "u1", doctorId: null })).toBe(false);
  });

  it("PATIENT yalnız kendi vakası", async () => {
    expect(await canCaseBeAccessedBy(user("PATIENT", "u1"), { userId: "u1", doctorId: null })).toBe(true);
    expect(await canCaseBeAccessedBy(user("PATIENT", "u1"), { userId: "u2", doctorId: null })).toBe(false);
  });

  it("PARTNER hiçbir vakaya erişemez (hasta DB erişimi yok)", async () => {
    expect(await canCaseBeAccessedBy(user("PARTNER"), { userId: "u1", doctorId: null })).toBe(false);
  });

  it("COORDINATOR/ETHICS/ADMIN geniş erişim", async () => {
    for (const role of ["COORDINATOR", "ETHICS", "ADMIN"]) {
      expect(await canCaseBeAccessedBy(user(role), { userId: "x", doctorId: "y" })).toBe(true);
    }
  });
});

describe("canCaseBeAccessedBy — DOCTOR atama + doğrulama", () => {
  beforeEach(() => {
    vi.mocked(db.user.findUnique).mockReset();
    vi.mocked(db.doctor.findUnique).mockReset();
  });

  function asVerifiedDoctor(doctorId: string) {
    vi.mocked(db.user.findUnique).mockResolvedValue({ doctorId } as never);
    vi.mocked(db.doctor.findUnique).mockResolvedValue({ verified: true } as never);
  }

  it("doğrulanmış hekim kendisine ATANMIŞ vakaya erişir", async () => {
    asVerifiedDoctor("d1");
    expect(await canCaseBeAccessedBy(user("DOCTOR"), { userId: "p", doctorId: "d1" })).toBe(true);
  });

  it("doğrulanmış hekim ATANMAMIŞ (kuyruk) vakaya erişir", async () => {
    asVerifiedDoctor("d1");
    expect(await canCaseBeAccessedBy(user("DOCTOR"), { userId: "p", doctorId: null })).toBe(true);
  });

  it("doğrulanmış hekim BAŞKA hekime atanmış vakaya erişemez", async () => {
    asVerifiedDoctor("d1");
    expect(await canCaseBeAccessedBy(user("DOCTOR"), { userId: "p", doctorId: "d2" })).toBe(false);
  });

  it("DOĞRULANMAMIŞ hekim hiçbir vakaya erişemez", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ doctorId: "d1" } as never);
    vi.mocked(db.doctor.findUnique).mockResolvedValue({ verified: false } as never);
    expect(await canCaseBeAccessedBy(user("DOCTOR"), { userId: "p", doctorId: "d1" })).toBe(false);
  });

  it("hekim profili olmayan DOCTOR kullanıcı → erişim yok", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ doctorId: null } as never);
    expect(await canCaseBeAccessedBy(user("DOCTOR"), { userId: "p", doctorId: null })).toBe(false);
  });
});

describe("ownsSecondOpinionCase — saf/sync", () => {
  it("PATIENT yalnız kendi SO vakası", () => {
    expect(ownsSecondOpinionCase(user("PATIENT", "u1"), { patientId: "u1" })).toBe(true);
    expect(ownsSecondOpinionCase(user("PATIENT", "u1"), { patientId: "u2" })).toBe(false);
  });
  it("PARTNER erişemez, klinik personel erişir", () => {
    expect(ownsSecondOpinionCase(user("PARTNER"), { patientId: "u1" })).toBe(false);
    expect(ownsSecondOpinionCase(user("DOCTOR"), { patientId: "u1" })).toBe(true);
    expect(ownsSecondOpinionCase(user("COORDINATOR"), { patientId: "u1" })).toBe(true);
  });
  it("kimliksiz → false", () => {
    expect(ownsSecondOpinionCase(null, { patientId: "u1" })).toBe(false);
  });
});
