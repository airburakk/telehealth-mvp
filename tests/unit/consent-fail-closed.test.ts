// Birim — recordConsent hata dallanması (denetim 2026-07-18 #15). Sözleşme (CLAUDE.md "consent
// yazımı FAIL-CLOSED"): P2002 (unique yarışı) SESSİZCE yutulur (idempotent — başka istek aynı sürümü
// kaydetti); DİĞER her hata alarm + THROW'dur (çağıran 500 döner, kapı kapalı kalır). Bir regresyon
// hatayı yutarsa /api/consent oturumu yine "onaylı" imzalar ve kullanıcıya bir daha SORULMAZ →
// ispat zincirinde kalıcı delik. DB ve alerts mock'lanır (saf dallanma testi — gerçek yazım entegrasyonda).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { recordConsent } from "@/lib/consent";
import { db } from "@/lib/db";
import { sendAlert } from "@/lib/alerts";

vi.mock("@/lib/db", () => ({
  db: {
    consentRecord: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/alerts", () => ({
  sendAlert: vi.fn(async () => ({ logged: true, emailed: false, suppressed: null })),
}));

const findUnique = vi.mocked(db.consentRecord.findUnique);
const transaction = vi.mocked(db.$transaction);
const mockedAlert = vi.mocked(sendAlert);

beforeEach(() => {
  findUnique.mockReset();
  transaction.mockReset();
  mockedAlert.mockClear();
  findUnique.mockResolvedValue(null); // varsayılan: henüz onam yok → yazım denenir
});

describe("recordConsent — fail-closed dallanması", () => {
  it("P2002 (unique yarışı) sessizce yutulur: resolve olur, alarm YOK", async () => {
    transaction.mockRejectedValue(Object.assign(new Error("Unique constraint failed"), { code: "P2002" }));
    await expect(recordConsent("u1", "203.0.113.7", "test-agent")).resolves.toBeUndefined();
    expect(mockedAlert).not.toHaveBeenCalled();
  });

  it("diğer her hata FAIL-CLOSED: throw EDER + consent-write alarmı düşer", async () => {
    transaction.mockRejectedValue(new Error("connection reset"));
    await expect(recordConsent("u1", "203.0.113.7", "test-agent")).rejects.toThrow("connection reset");
    expect(mockedAlert).toHaveBeenCalledTimes(1);
    expect(mockedAlert.mock.calls[0][0]).toBe("consent-write");
    expect(mockedAlert.mock.calls[0][2]).toContain("scope=GENERAL_KVKK"); // hangi kova yazılamadı görünür
  });

  it("zaten onaylıysa (idempotent kısa devre) yazım hiç denenmez", async () => {
    findUnique.mockResolvedValue({ id: "mevcut" } as never);
    await expect(recordConsent("u1")).resolves.toBeUndefined();
    expect(transaction).not.toHaveBeenCalled();
    expect(mockedAlert).not.toHaveBeenCalled();
  });
});
