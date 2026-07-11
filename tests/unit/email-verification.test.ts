// Birim testleri — lib/email-verification token modeli (v5.6) + lib/email dormant kapısı.
// Token DB'de yalnız sha256 hash olarak durur; kıyas sabit-zamanlı, TTL 24 saat.
import { describe, it, expect, vi, afterEach } from "vitest";
import { hashVerifyToken, verifyTokenMatches, VERIFY_TOKEN_TTL_MS } from "@/lib/email-verification";
import { isEmailConfigured, sendEmail } from "@/lib/email";

describe("verifyTokenMatches — token doğrulaması", () => {
  const token = "a".repeat(64);
  const row = (over: Partial<{ emailVerifyTokenHash: string | null; emailVerifySentAt: Date | null }> = {}) => ({
    emailVerifyTokenHash: hashVerifyToken(token),
    emailVerifySentAt: new Date(),
    ...over,
  });

  it("doğru token + taze sentAt → true", () => {
    expect(verifyTokenMatches(row(), token)).toBe(true);
  });

  it("yanlış token → false", () => {
    expect(verifyTokenMatches(row(), "b".repeat(64))).toBe(false);
  });

  it("hash yok (token hiç üretilmemiş / tüketilmiş) → false", () => {
    expect(verifyTokenMatches(row({ emailVerifyTokenHash: null }), token)).toBe(false);
  });

  it("sentAt yok → false", () => {
    expect(verifyTokenMatches(row({ emailVerifySentAt: null }), token)).toBe(false);
  });

  it("TTL dolmuş (24 saatten eski) → false", () => {
    const old = new Date(Date.now() - VERIFY_TOKEN_TTL_MS - 1000);
    expect(verifyTokenMatches(row({ emailVerifySentAt: old }), token)).toBe(false);
  });

  it("TTL sınırının hemen içinde → true", () => {
    const nearEdge = new Date(Date.now() - VERIFY_TOKEN_TTL_MS + 60_000);
    expect(verifyTokenMatches(row({ emailVerifySentAt: nearEdge }), token)).toBe(true);
  });

  it("hash deterministik ve ham token'dan farklı (DB sızıntısı token vermez)", () => {
    expect(hashVerifyToken(token)).toBe(hashVerifyToken(token));
    expect(hashVerifyToken(token)).not.toBe(token);
    expect(hashVerifyToken(token)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("sendEmail — dormant kapısı", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("RESEND_API_KEY yok → simülasyon (fetch hiç çağrılmaz)", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect(isEmailConfigured()).toBe(false);
    const r = await sendEmail({ to: "x@example.com", subject: "t", text: "b" });
    expect(r).toEqual({ sent: false, simulated: true });
    expect(f).not.toHaveBeenCalled();
  });

  it("anahtar var + sağlayıcı 200 → sent:true (Resend ucuna Bearer ile gider)", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    const f = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", f);
    const r = await sendEmail({ to: "x@example.com", subject: "t", text: "b" });
    expect(r).toEqual({ sent: true, simulated: false });
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test");
  });

  it("sağlayıcı hatası akışı BOZMAZ → sent:false döner (throw yok)", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const r = await sendEmail({ to: "x@example.com", subject: "t", text: "b" });
    expect(r).toEqual({ sent: false, simulated: false });
  });
});
