// Birim testleri — kurumsal üyelik başvurusu (2026-08-12): rol-config bütünlüğü +
// validateStaffAnswers süzgeci + onay/ret damga akışı (db mock). Kapı davranışının
// (staffVerifiedAt) tek doğruluk kaynağı approveStaffApplication olduğundan PARTNER
// özel yolu (PartnerDoctor oluştur + User.partnerId bağla) burada sabitlenir.
import { describe, it, expect, vi, beforeEach } from "vitest";

// staff-application.ts db + crypto ister → mock (ownership.test deseni). encryptField/decryptField
// kimlikli veri katmanına dokunmadan JSON'u olduğu gibi taşısın (şifreleme crypto.test.ts'in işi).
vi.mock("@/lib/db", () => ({
  db: {
    staffApplication: { findUnique: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn() },
    partnerDoctor: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/crypto", () => ({
  encryptField: (v: string) => v,
  decryptField: (v: string) => v,
}));

import {
  validateStaffAnswers,
  approveStaffApplication,
  rejectStaffApplication,
} from "@/lib/staff-application";
import { STAFF_ROLE_CONFIGS, staffConfigBySlug } from "@/lib/staff-application-config";
import { STAFF_SIGNUP_ROLES, isStaffSignupRole, roleHome, ROLES, ROLE_LABELS } from "@/lib/roles";
import { db } from "@/lib/db";

/* eslint-disable @typescript-eslint/no-explicit-any */
const mock = db as any;

describe("rol-config bütünlüğü", () => {
  it("3 self-signup rolün TAMAMI için config var; slug'lar benzersiz ve rotayla eşleşir", () => {
    expect(Object.keys(STAFF_ROLE_CONFIGS).sort()).toEqual([...STAFF_SIGNUP_ROLES].sort());
    const slugs = Object.values(STAFF_ROLE_CONFIGS).map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    // /kayit/<slug> sayfaları bu üç slug'la yazıldı — config'te slug değişirse rota da taşınmalı
    expect(slugs.sort()).toEqual(["acente", "partner", "saglik-uzmani"]);
  });

  it("her config'in nameKey'i fields içinde ZORUNLU bir alandır (User.name buradan dolar)", () => {
    for (const c of Object.values(STAFF_ROLE_CONFIGS)) {
      const f = c.fields.find((x) => x.key === c.nameKey);
      expect(f, `${c.role} nameKey=${c.nameKey}`).toBeTruthy();
      expect(f!.required, `${c.role} nameKey zorunlu olmalı`).toBe(true);
    }
  });

  it("belge tipleri rol içinde benzersiz; staffConfigBySlug çözümü çalışır", () => {
    for (const c of Object.values(STAFF_ROLE_CONFIGS)) {
      const types = c.docs.map((d) => d.type);
      expect(new Set(types).size).toBe(types.length);
      expect(staffConfigBySlug(c.slug)?.role).toBe(c.role);
    }
    expect(staffConfigBySlug("olmayan-rol")).toBeNull();
  });
});

describe("roles — HEALTH_PRO entegrasyonu", () => {
  it("HEALTH_PRO tanınan roldür, etiketi ve iniş sayfası doğru", () => {
    expect(ROLES).toContain("HEALTH_PRO");
    expect(ROLE_LABELS.HEALTH_PRO).toBe("Sağlık Uzmanı");
    expect(roleHome("HEALTH_PRO")).toBe("/uzman");
  });

  it("isStaffSignupRole yalnız 3 başvuru rolünü tanır (COORDINATOR/ETHICS davetli — başvuru YOK)", () => {
    expect(isStaffSignupRole("PARTNER")).toBe(true);
    expect(isStaffSignupRole("AGENCY")).toBe(true);
    expect(isStaffSignupRole("HEALTH_PRO")).toBe(true);
    for (const r of ["COORDINATOR", "ETHICS", "ADMIN", "DOCTOR", "PATIENT", "BOZUK"]) {
      expect(isStaffSignupRole(r), r).toBe(false);
    }
  });
});

describe("validateStaffAnswers", () => {
  const config = STAFF_ROLE_CONFIGS.HEALTH_PRO;

  const valid = {
    name: "Ayşe Yılmaz",
    profession: "Hemşire",
    licenseNo: "12345",
    city: "İstanbul",
  };

  it("geçerli yanıtları kabul eder; bilinmeyen anahtarları ATAR (fazla veri saklanmaz)", () => {
    const r = validateStaffAnswers(config, { ...valid, gizliAlan: "sızmasın", role: "ADMIN" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.answers.gizliAlan).toBeUndefined();
      expect(r.answers.role).toBeUndefined();
      expect(r.answers.name).toBe("Ayşe Yılmaz");
    }
  });

  it("zorunlu alan eksikse reddeder", () => {
    const r = validateStaffAnswers(config, { ...valid, name: "" });
    expect(r.ok).toBe(false);
  });

  it("select alanında liste dışı değer reddedilir", () => {
    const r = validateStaffAnswers(config, { ...valid, profession: "Uydurma Meslek" });
    expect(r.ok).toBe(false);
  });

  // ⚠️ Örnek alan `city` İDİ; v6.194'te şehir KAPALI LİSTEYE geçince ("A".repeat(500) artık
  // geçerli bir seçenek değil) bu test kırıldı. Testin NİYETİ hâlâ doğru — kırpma serbest metinde
  // çalışmalı — yalnız örneği bayatlamıştı: hâlâ serbest metin olan `institution` (maxLen 160)
  // kullanılıyor. Kapalı listenin kendi denetimi alttaki testte ayrıca kilitli.
  it("maxLen aşımı kırpılır (hata değil)", () => {
    const r = validateStaffAnswers(config, { ...valid, institution: "A".repeat(500) });
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.answers.institution as string).length).toBeLessThanOrEqual(160);
  });

  it("şehir artık kapalı liste: liste dışı değer REDDEDİLİR (v6.194)", () => {
    expect(validateStaffAnswers(config, { ...valid, city: "Istanbul" }).ok).toBe(false); // ASCII I
    expect(validateStaffAnswers(config, { ...valid, city: "Uydurma Şehir" }).ok).toBe(false);
    expect(validateStaffAnswers(config, { ...valid, city: "Lefkoşa" }).ok).toBe(true); // KKTC kapsamda
  });

  it("string olmayan girdiler güvenle yok sayılır (opsiyonel) / reddedilir (zorunlu)", () => {
    const r = validateStaffAnswers(config, { ...valid, phone: { evil: true } });
    expect(r.ok).toBe(true); // phone opsiyonel — obje yok sayılır
    const r2 = validateStaffAnswers(config, { ...valid, name: 42 });
    expect(r2.ok).toBe(false); // name zorunlu — sayı reddedilir
  });
});

describe("approve / reject — damga akışı (db mock)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // $transaction: callback'e tx olarak AYNI mock'u geç (tx.* çağrıları da izlensin)
    mock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(mock));
  });

  it("PARTNER onayı: PartnerDoctor oluşturur, partnerId bağlar, staffVerifiedAt damgalar", async () => {
    mock.staffApplication.findUnique.mockResolvedValue({
      id: "app1", userId: "u1", role: "PARTNER", status: "PENDING",
      answers: JSON.stringify({ name: "Dr. X", title: "Prof. Dr.", country: "Almanya", institution: "Charité", branch: "Kardiyoloji" }),
    });
    mock.user.findUnique.mockResolvedValue({ id: "u1", email: "p@x.com", name: "Dr. X", partnerId: null, deletedAt: null });
    mock.partnerDoctor.create.mockResolvedValue({ id: "pd1" });

    const r = await approveStaffApplication("app1", "admin1");
    expect(r).toEqual({ userId: "u1", role: "PARTNER" });
    expect(mock.partnerDoctor.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: "p@x.com", verified: true, country: "Almanya" }) }),
    );
    const userUpdate = mock.user.update.mock.calls[0][0];
    expect(userUpdate.data.staffVerifiedAt).toBeInstanceOf(Date);
    expect(userUpdate.data.partnerId).toBe("pd1");
  });

  it("APPROVED başvuru tekrar onaylanırsa idempotent (ikinci damga/side-effect yok)", async () => {
    mock.staffApplication.findUnique.mockResolvedValue({ id: "app1", userId: "u1", role: "AGENCY", status: "APPROVED", answers: "{}" });
    const r = await approveStaffApplication("app1", "admin1");
    expect(r).toEqual({ userId: "u1", role: "AGENCY" });
    expect(mock.user.update).not.toHaveBeenCalled();
    expect(mock.partnerDoctor.create).not.toHaveBeenCalled();
  });

  it("silinmiş hesabın başvurusu onaylanamaz", async () => {
    mock.staffApplication.findUnique.mockResolvedValue({ id: "app1", userId: "u1", role: "AGENCY", status: "PENDING", answers: "{}" });
    mock.user.findUnique.mockResolvedValue({ id: "u1", email: "a@x.com", name: "A", partnerId: null, deletedAt: new Date() });
    await expect(approveStaffApplication("app1", "admin1")).rejects.toThrow();
    expect(mock.user.update).not.toHaveBeenCalled();
  });

  it("ret: gerekçe 500 karaktere kırpılır ve REJECTED yazılır", async () => {
    mock.staffApplication.update.mockResolvedValue({ userId: "u1", role: "HEALTH_PRO" });
    const r = await rejectStaffApplication("app1", "admin1", "x".repeat(600));
    expect(r).toEqual({ userId: "u1", role: "HEALTH_PRO" });
    const arg = mock.staffApplication.update.mock.calls[0][0];
    expect(arg.data.status).toBe("REJECTED");
    expect(arg.data.reviewNote.length).toBe(500);
  });
});
