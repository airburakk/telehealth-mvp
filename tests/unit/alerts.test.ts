// Birim testleri — lib/alerts kritik alarm modülü (Faz 5 Ray C).
// Sözleşme: fire-safe (asla throw yok) · test ortamında susar · cooldown olay-anahtarı başına ·
// decrypt küme sayacı eşikte TEK alarm üretir. E-posta katmanı mock'lanır (gerçek Resend çağrısı yok).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendAlert, noteDecryptFailure, __resetAlertStateForTests } from "@/lib/alerts";
import { sendEmail } from "@/lib/email";

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(async () => ({ sent: true, simulated: false })),
}));

const mockedSendEmail = vi.mocked(sendEmail);
// vitest NODE_ENV=test koşar; alarm davranışını test edebilmek için env'i geçici "production" yapıp
// console.error'ı susturuyoruz (alarm satırları test çıktısını kirletmesin).
let errSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  __resetAlertStateForTests();
  mockedSendEmail.mockClear();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("ALERT_EMAIL", "ops@example.test");
  errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  errSpy.mockRestore();
});

describe("sendAlert — kanal ve bastırma davranışı", () => {
  it("NODE_ENV=test iken tamamen susar (kurcalama testleri alarm üretmesin)", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const r = await sendAlert("deneme", "başlık");
    expect(r).toEqual({ logged: false, emailed: false, suppressed: "test" });
    expect(mockedSendEmail).not.toHaveBeenCalled();
  });

  it("ilk alarm: [ALERT] log satırı + e-posta (ALERT_EMAIL set)", async () => {
    const r = await sendAlert("consent-write", "Onam yazılamadı", "scope=GENERAL_KVKK");
    expect(r).toEqual({ logged: true, emailed: true, suppressed: null });
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("[ALERT] consent-write"));
    expect(mockedSendEmail).toHaveBeenCalledTimes(1);
    expect(mockedSendEmail.mock.calls[0][0].to).toBe("ops@example.test");
    expect(mockedSendEmail.mock.calls[0][0].subject).toContain("consent-write");
  });

  it("aynı olay anahtarı cooldown penceresinde bastırılır; farklı anahtar geçer", async () => {
    await sendAlert("audit-chain", "kırık");
    const tekrar = await sendAlert("audit-chain", "kırık");
    expect(tekrar.suppressed).toBe("cooldown");
    const farkli = await sendAlert("kek-missing", "anahtar yok");
    expect(farkli.suppressed).toBeNull();
    expect(mockedSendEmail).toHaveBeenCalledTimes(2); // audit-chain (1) + kek-missing (1)
  });

  it("ALERT_EMAIL boşsa e-posta denenmez, log kanalı yine çalışır", async () => {
    vi.stubEnv("ALERT_EMAIL", "");
    const r = await sendAlert("cron-purge", "cron düştü");
    expect(r).toEqual({ logged: true, emailed: false, suppressed: null });
    expect(mockedSendEmail).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("[ALERT] cron-purge"));
  });

  it("fire-safe: e-posta katmanı patlasa bile sendAlert throw ETMEZ", async () => {
    mockedSendEmail.mockRejectedValueOnce(new Error("Resend çöktü"));
    await expect(sendAlert("decrypt-cluster", "küme")).resolves.toEqual(
      { logged: false, emailed: false, suppressed: null },
    );
  });

  it("uzun detail 400 karaktere kırpılır (log taşması/PHI hacmi sınırlanır)", async () => {
    await sendAlert("cron-registry", "başlık", "x".repeat(1000));
    const line = errSpy.mock.calls.find((c) => String(c[0]).includes("cron-registry"))?.[0] as string;
    expect(line).toContain("x".repeat(400));
    expect(line).not.toContain("x".repeat(401));
  });
});

describe("noteDecryptFailure — küme eşiği", () => {
  it("eşik altı (4 hata) alarm üretmez; 5. hata TEK alarm üretir, sonrası eşikte tekrar etmez", async () => {
    for (let i = 0; i < 4; i++) noteDecryptFailure("decryptField");
    await new Promise((r) => setTimeout(r, 10)); // fire-and-forget alarmın oturması için nefes
    expect(mockedSendEmail).not.toHaveBeenCalled();

    noteDecryptFailure("decryptField"); // 5. → eşik
    noteDecryptFailure("decryptField"); // 6. → eşik AŞILDI, yeni alarm yok (=== eşleşmesi)
    await new Promise((r) => setTimeout(r, 10));
    expect(mockedSendEmail).toHaveBeenCalledTimes(1);
    expect(mockedSendEmail.mock.calls[0][0].subject).toContain("decrypt-cluster");
  });
});
