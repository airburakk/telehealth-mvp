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

import { canCaseBeAccessedBy, canSoCaseBeAccessedBy, ownsSecondOpinionCase, isSecondOpinionPatient } from "@/lib/ownership";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/session";

const user = (role: string, id = "u1"): SessionUser => ({ id, role } as SessionUser);

// Hesap silme kilidi (v6.11) — kilit ROL KONTROLÜNDEN ÖNCE uygulanmalı: hasta silinmesini istedi,
// kayıt yalnız yasal saklama yükümlülüğü gereği duruyor → HİÇ KİMSE okuyamaz. Bu testler, ileride
// biri kilidi rol switch'inin ALTINA taşırsa (admin/koordinatör geniş dalları kilidi delerdi) yakalar.
describe("canCaseBeAccessedBy — hesap silme kilidi (v6.11)", () => {
  const LOCKED = { userId: "u1", doctorId: "d1", branch: "Kardiyoloji", deletionLockedAt: new Date("2026-07-15") };

  it("kilitli vaka: SAHİBİ hasta bile erişemez", async () => {
    expect(await canCaseBeAccessedBy(user("PATIENT", "u1"), LOCKED)).toBe(false);
  });

  it("kilitli vaka: ADMIN / COORDINATOR / ETHICS geniş erişimi DELEMEZ", async () => {
    for (const role of ["ADMIN", "COORDINATOR", "ETHICS"]) {
      expect(await canCaseBeAccessedBy(user(role, "x"), LOCKED)).toBe(false);
    }
  });

  it("kilitli vaka: ATANMIŞ doğrulanmış doktor bile erişemez", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ doctorId: "d1" } as never);
    vi.mocked(db.doctor.findUnique).mockResolvedValue({ verified: true, branch: "Kardiyoloji" } as never);
    expect(await canCaseBeAccessedBy(user("DOCTOR", "du"), LOCKED)).toBe(false);
  });

  it("kilit YOKSA aynı vaka normal kurallarla açılır (kilit fazladan kısıtlamaz)", async () => {
    expect(await canCaseBeAccessedBy(user("PATIENT", "u1"), { ...LOCKED, deletionLockedAt: null })).toBe(true);
    expect(await canCaseBeAccessedBy(user("ADMIN", "x"), { ...LOCKED, deletionLockedAt: null })).toBe(true);
  });

  it("İkinci Görüş vakası da aynı kilide tabi (hasta + personel)", async () => {
    const so = { patientId: "u1", assignedDoctorId: "d1", deletionLockedAt: new Date("2026-07-15") };
    expect(await canSoCaseBeAccessedBy(user("PATIENT", "u1"), so)).toBe(false);
    expect(await canSoCaseBeAccessedBy(user("ADMIN", "x"), so)).toBe(false);
    expect(await canSoCaseBeAccessedBy(user("PATIENT", "u1"), { ...so, deletionLockedAt: null })).toBe(true);
  });
});

describe("canCaseBeAccessedBy — rol bazlı", () => {
  it("kimliksiz → false", async () => {
    expect(await canCaseBeAccessedBy(null, { userId: "u1", doctorId: null, branch: "Kardiyoloji", deletionLockedAt: null })).toBe(false);
  });

  it("PATIENT yalnız kendi vakası", async () => {
    expect(await canCaseBeAccessedBy(user("PATIENT", "u1"), { userId: "u1", doctorId: null, branch: "Kardiyoloji", deletionLockedAt: null })).toBe(true);
    expect(await canCaseBeAccessedBy(user("PATIENT", "u1"), { userId: "u2", doctorId: null, branch: "Kardiyoloji", deletionLockedAt: null })).toBe(false);
  });

  it("PARTNER hiçbir vakaya erişemez (hasta DB erişimi yok)", async () => {
    expect(await canCaseBeAccessedBy(user("PARTNER"), { userId: "u1", doctorId: null, branch: "Kardiyoloji", deletionLockedAt: null })).toBe(false);
  });

  it("COORDINATOR/ETHICS/ADMIN geniş erişim (branş fark etmez)", async () => {
    for (const role of ["COORDINATOR", "ETHICS", "ADMIN"]) {
      expect(await canCaseBeAccessedBy(user(role), { userId: "x", doctorId: "y", branch: "Onkoloji", deletionLockedAt: null })).toBe(true);
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
    expect(await canCaseBeAccessedBy(user("DOCTOR"), { userId: "p", doctorId: "d1", branch: "Onkoloji", deletionLockedAt: null })).toBe(true);
  });

  it("doğrulanmış hekim ATANMAMIŞ + KENDİ branşındaki (kuyruk) vakaya erişir", async () => {
    asVerifiedDoctor("d1", "Kardiyoloji");
    expect(await canCaseBeAccessedBy(user("DOCTOR"), { userId: "p", doctorId: null, branch: "Kardiyoloji", deletionLockedAt: null })).toBe(true);
  });

  it("doğrulanmış hekim ATANMAMIŞ + YABANCI branş vakaya erişemez (branş-daraltması)", async () => {
    asVerifiedDoctor("d1", "Kardiyoloji");
    expect(await canCaseBeAccessedBy(user("DOCTOR"), { userId: "p", doctorId: null, branch: "Onkoloji", deletionLockedAt: null })).toBe(false);
  });

  it("BOŞ branşlı doğrulanmış hekim ATANMAMIŞ vakadan fail-closed kesilir", async () => {
    asVerifiedDoctor("d1", "");
    expect(await canCaseBeAccessedBy(user("DOCTOR"), { userId: "p", doctorId: null, branch: "Kardiyoloji", deletionLockedAt: null })).toBe(false);
  });

  it("doğrulanmış hekim BAŞKA hekime atanmış vakaya erişemez", async () => {
    asVerifiedDoctor("d1", "Kardiyoloji");
    expect(await canCaseBeAccessedBy(user("DOCTOR"), { userId: "p", doctorId: "d2", branch: "Kardiyoloji", deletionLockedAt: null })).toBe(false);
  });

  it("DOĞRULANMAMIŞ hekim hiçbir vakaya erişemez (branş uysa bile)", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ doctorId: "d1" } as never);
    vi.mocked(db.doctor.findUnique).mockResolvedValue({ verified: false, branch: "Kardiyoloji" } as never);
    expect(await canCaseBeAccessedBy(user("DOCTOR"), { userId: "p", doctorId: "d1", branch: "Kardiyoloji", deletionLockedAt: null })).toBe(false);
  });

  it("hekim profili olmayan DOCTOR kullanıcı → erişim yok", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ doctorId: null } as never);
    expect(await canCaseBeAccessedBy(user("DOCTOR"), { userId: "p", doctorId: null, branch: "Kardiyoloji", deletionLockedAt: null })).toBe(false);
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
