// KVKK m.11 başvuru kütüğü — birim testleri (06-veri-sahibi-basvuru-usul-esaslari.md madde A.2/A.3/B.2,
// Paket 2, 2026-09-09). db/audit/notify mock'lu — audit-2026-08-03.test.ts deseni.
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    kvkkApplication: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() },
  },
}));
vi.mock("@/lib/audit", () => ({ recordAccess: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notifyUser: vi.fn() }));

import {
  submitKvkkApplication, decideKvkkApplication, purgeOldKvkkApplications, KVKK_REQUEST_TYPES,
} from "@/lib/kvkk-applications";
import { db } from "@/lib/db";
import { recordAccess } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import type { SessionUser } from "@/lib/session";

const actor = { id: "u1", role: "DOCTOR" } as SessionUser;

describe("KVKK_REQUEST_TYPES — 06 madde B.4 talep türleri", () => {
  it("bilgi/erişim, düzeltme, silme, itiraz, diğer eksiksiz", () => {
    expect(KVKK_REQUEST_TYPES.map((t) => t.value)).toEqual(["BILGI_ERISIM", "DUZELTME", "SILME", "ITIRAZ", "DIGER"]);
  });
});

describe("submitKvkkApplication", () => {
  beforeEach(() => vi.resetAllMocks());

  it("geçersiz talep türü DB'ye hiç gitmeden reddedilir", async () => {
    await expect(submitKvkkApplication(actor, "GECERSIZ", "yeterince uzun bir mesaj")).rejects.toThrow("Geçersiz talep türü.");
    expect(db.kvkkApplication.create).not.toHaveBeenCalled();
  });

  it("çok kısa mesaj reddedilir", async () => {
    await expect(submitKvkkApplication(actor, "BILGI_ERISIM", "kısa")).rejects.toThrow(/açıklar mısınız/);
  });

  it("geçerli başvuru kaydedilir + kendi kimliği/ip'siyle audit'e yazılır", async () => {
    vi.mocked(db.kvkkApplication.create).mockResolvedValue({ id: "app1" } as never);
    const res = await submitKvkkApplication(actor, "SILME", "hesabımı ve verilerimi silmenizi istiyorum", "1.2.3.4", "ua");
    expect(res.id).toBe("app1");
    expect(db.kvkkApplication.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: "u1", requestType: "SILME", ip: "1.2.3.4", userAgent: "ua" }),
    }));
    expect(recordAccess).toHaveBeenCalledWith(expect.objectContaining({
      actor, action: "KVKK_APPLICATION_SUBMIT", resourceId: "app1", subjectUserId: "u1",
    }));
  });
});

describe("decideKvkkApplication", () => {
  beforeEach(() => vi.resetAllMocks());

  it("kısa yanıt reddedilir (DB'ye hiç gitmez)", async () => {
    await expect(decideKvkkApplication("app1", actor, "ok")).rejects.toThrow(/kısa bir açıklama/);
    expect(db.kvkkApplication.findUnique).not.toHaveBeenCalled();
  });

  it("bulunamayan başvuru hata verir", async () => {
    vi.mocked(db.kvkkApplication.findUnique).mockResolvedValue(null);
    await expect(decideKvkkApplication("app1", actor, "yeterli açıklama")).rejects.toThrow("Başvuru bulunamadı.");
  });

  it("zaten yanıtlanmış başvuru tekrar kararlaştırılamaz (çift-tık koruması)", async () => {
    vi.mocked(db.kvkkApplication.findUnique).mockResolvedValue({ userId: "u2", status: "ANSWERED" } as never);
    await expect(decideKvkkApplication("app1", actor, "yeterli açıklama")).rejects.toThrow("zaten yanıtlanmış");
    expect(db.kvkkApplication.update).not.toHaveBeenCalled();
  });

  it("PENDING başvuru yanıtlanır + audit + başvurana bildirim", async () => {
    vi.mocked(db.kvkkApplication.findUnique).mockResolvedValue({ userId: "u2", status: "PENDING" } as never);
    await decideKvkkApplication("app1", actor, "başvurunuz incelendi, talep karşılandı");
    expect(db.kvkkApplication.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "app1" },
      data: expect.objectContaining({ status: "ANSWERED", decision: "başvurunuz incelendi, talep karşılandı" }),
    }));
    expect(recordAccess).toHaveBeenCalledWith(expect.objectContaining({ action: "KVKK_APPLICATION_DECIDE", subjectUserId: "u2" }));
    expect(notifyUser).toHaveBeenCalledWith("u2", expect.objectContaining({ type: "KVKK_APPLICATION_ANSWERED" }));
  });
});

describe("purgeOldKvkkApplications — 05 madde 3.12 (3 yıl, sonuçlandırmadan itibaren)", () => {
  beforeEach(() => vi.resetAllMocks());

  it("yalnız sonuçlanmış (decidedAt dolu) + süresi geçmiş kayıtları hedefler", async () => {
    vi.mocked(db.kvkkApplication.deleteMany).mockResolvedValue({ count: 2 } as never);
    const res = await purgeOldKvkkApplications(new Date("2029-09-09"));
    expect(res.purged).toBe(2);
    expect(db.kvkkApplication.deleteMany).toHaveBeenCalledWith({
      where: { decidedAt: { not: null, lt: expect.any(Date) } },
    });
  });
});
