// Birim testleri — lib/ownership.ts (T2 vaka-ataması bazlı erişim + branş-daraltması + T15b). db + auth mock'lanır.
import { describe, it, expect, vi, beforeEach } from "vitest";

// canCaseBeAccessedBy DOCTOR dalı için db lookup yapar → mock. auth (next/headers) import zincirini de kes.
vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: vi.fn() },
    doctor: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));

import { canCaseBeAccessedBy, ownsSecondOpinionCase, isSecondOpinionPatient } from "@/lib/ownership";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/session";

const user = (role: string, id = "u1"): SessionUser => ({ id, role } as SessionUser);

describe("canCaseBeAccessedBy — rol bazlı", () => {
  it("kimliksiz → false", async () => {
    expect(await canCaseBeAccessedBy(null, { userId: "u1", doctorId: null, branch: "Kardiyoloji" })).toBe(false);
  });

  it("PATIENT yalnız kendi vakası", async () => {
    expect(await canCaseBeAccessedBy(user("PATIENT", "u1"), { userId: "u1", doctorId: null, branch: "Kardiyoloji" })).toBe(true);
    expect(await canCaseBeAccessedBy(user("PATIENT", "u1"), { userId: "u2", doctorId: null, branch: "Kardiyoloji" })).toBe(false);
  });

  it("PARTNER hiçbir vakaya erişemez (hasta DB erişimi yok)", async () => {
    expect(await canCaseBeAccessedBy(user("PARTNER"), { userId: "u1", doctorId: null, branch: "Kardiyoloji" })).toBe(false);
  });

  it("COORDINATOR/ETHICS/ADMIN geniş erişim (branş fark etmez)", async () => {
    for (const role of ["COORDINATOR", "ETHICS", "ADMIN"]) {
      expect(await canCaseBeAccessedBy(user(role), { userId: "x", doctorId: "y", branch: "Onkoloji" })).toBe(true);
    }
  });
});

describe("canCaseBeAccessedBy — DOCTOR atama + doğrulama + branş-daraltması", () => {
  beforeEach(() => {
    vi.mocked(db.user.findUnique).mockReset();
    vi.mocked(db.doctor.findUnique).mockReset();
  });

  function asVerifiedDoctor(doctorId: string, branch = "Kardiyoloji") {
    vi.mocked(db.user.findUnique).mockResolvedValue({ doctorId } as never);
    vi.mocked(db.doctor.findUnique).mockResolvedValue({ verified: true, branch } as never);
  }

  it("doğrulanmış hekim kendisine ATANMIŞ vakaya erişir (branş fark etmez)", async () => {
    asVerifiedDoctor("d1", "Kardiyoloji");
    expect(await canCaseBeAccessedBy(user("DOCTOR"), { userId: "p", doctorId: "d1", branch: "Onkoloji" })).toBe(true);
  });

  it("doğrulanmış hekim ATANMAMIŞ + KENDİ branşındaki (kuyruk) vakaya erişir", async () => {
    asVerifiedDoctor("d1", "Kardiyoloji");
    expect(await canCaseBeAccessedBy(user("DOCTOR"), { userId: "p", doctorId: null, branch: "Kardiyoloji" })).toBe(true);
  });

  it("doğrulanmış hekim ATANMAMIŞ + YABANCI branş vakaya erişemez (branş-daraltması)", async () => {
    asVerifiedDoctor("d1", "Kardiyoloji");
    expect(await canCaseBeAccessedBy(user("DOCTOR"), { userId: "p", doctorId: null, branch: "Onkoloji" })).toBe(false);
  });

  it("BOŞ branşlı doğrulanmış hekim ATANMAMIŞ vakadan fail-closed kesilir", async () => {
    asVerifiedDoctor("d1", "");
    expect(await canCaseBeAccessedBy(user("DOCTOR"), { userId: "p", doctorId: null, branch: "Kardiyoloji" })).toBe(false);
  });

  it("doğrulanmış hekim BAŞKA hekime atanmış vakaya erişemez", async () => {
    asVerifiedDoctor("d1", "Kardiyoloji");
    expect(await canCaseBeAccessedBy(user("DOCTOR"), { userId: "p", doctorId: "d2", branch: "Kardiyoloji" })).toBe(false);
  });

  it("DOĞRULANMAMIŞ hekim hiçbir vakaya erişemez (branş uysa bile)", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ doctorId: "d1" } as never);
    vi.mocked(db.doctor.findUnique).mockResolvedValue({ verified: false, branch: "Kardiyoloji" } as never);
    expect(await canCaseBeAccessedBy(user("DOCTOR"), { userId: "p", doctorId: "d1", branch: "Kardiyoloji" })).toBe(false);
  });

  it("hekim profili olmayan DOCTOR kullanıcı → erişim yok", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ doctorId: null } as never);
    expect(await canCaseBeAccessedBy(user("DOCTOR"), { userId: "p", doctorId: null, branch: "Kardiyoloji" })).toBe(false);
  });
});

describe("ownsSecondOpinionCase — saf/sync (fail-closed allow-list)", () => {
  it("PATIENT yalnız kendi SO vakası", () => {
    expect(ownsSecondOpinionCase(user("PATIENT", "u1"), { patientId: "u1" })).toBe(true);
    expect(ownsSecondOpinionCase(user("PATIENT", "u1"), { patientId: "u2" })).toBe(false);
  });
  it("klinik personel (DOCTOR/COORDINATOR/ETHICS/ADMIN) erişir", () => {
    for (const role of ["DOCTOR", "COORDINATOR", "ETHICS", "ADMIN"]) {
      expect(ownsSecondOpinionCase(user(role), { patientId: "u1" })).toBe(true);
    }
  });
  it("AGENCY erişemez (klinik personel DEĞİL — BOLA fail-open düzeltmesi 2026-07-12)", () => {
    expect(ownsSecondOpinionCase(user("AGENCY"), { patientId: "u1" })).toBe(false);
  });
  it("PARTNER + tanınmayan/malformed rol → fail-closed (eski else→true kapandı)", () => {
    expect(ownsSecondOpinionCase(user("PARTNER"), { patientId: "u1" })).toBe(false);
    expect(ownsSecondOpinionCase(user("SUPPORT" as never), { patientId: "u1" })).toBe(false);
    expect(ownsSecondOpinionCase(user("Patient" as never), { patientId: "u1" })).toBe(false); // case-mismatch typo
  });
  it("kimliksiz → false", () => {
    expect(ownsSecondOpinionCase(null, { patientId: "u1" })).toBe(false);
  });
});

describe("isSecondOpinionPatient — T15b hasta-aksiyon daraltması (pay/fulfill/respond-video)", () => {
  it("yalnız vaka sahibi hasta → true", () => {
    expect(isSecondOpinionPatient(user("PATIENT", "u1"), { patientId: "u1" })).toBe(true);
    expect(isSecondOpinionPatient(user("PATIENT", "u1"), { patientId: "u2" })).toBe(false);
  });
  it("personel (DOCTOR/COORDINATOR/ETHICS/ADMIN) ve PARTNER → false (state-tamper önlemi)", () => {
    for (const role of ["DOCTOR", "COORDINATOR", "ETHICS", "ADMIN", "PARTNER"]) {
      expect(isSecondOpinionPatient(user(role, "u1"), { patientId: "u1" })).toBe(false);
    }
  });
  it("kimliksiz → false", () => {
    expect(isSecondOpinionPatient(null, { patientId: "u1" })).toBe(false);
  });
});
