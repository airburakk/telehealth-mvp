import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
const m = vi.hoisted(() => ({ find: vi.fn(), update: vi.fn(), match: vi.fn(), email: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { user: { findUnique: m.find, update: m.update } } }));
vi.mock("@/lib/email", () => ({ sendEmail: m.email, isEmailConfigured: () => true }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(async () => ({ ok: true })), clientIp: () => "fixture" }));
const user = { id: "fixture", email: "fixture@example.test", name: "Fixture", role: "DOCTOR", emailVerifiedAt: null, emailVerifyTokenHash: null, emailVerifySentAt: null };
beforeEach(() => { vi.clearAllMocks(); m.find.mockResolvedValue(user); m.update.mockResolvedValue(user); });
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
async function route(brand: string) {
  vi.resetModules(); vi.stubEnv("BRAND_MODE", brand);
  const verification = await import("@/lib/email-verification");
  m.find.mockResolvedValue({ ...user, emailVerifyTokenHash: verification.hashVerifyToken("fixture-token"), emailVerifySentAt: new Date() });
  return import("@/app/api/auth/verify-email/route");
}
describe("Doctorium e-posta doğrulaması — marka ve giriş dönüşü", () => {
  it.each([["doctorium", "/doctorium/giris"], ["", "/kurumsal-giris"]])("%s doğrulanmış doktoru doğru kapıya yollar", async (brand, loginPath) => {
    const r = await (await route(brand)).GET(new Request("https://fixture.example.test/api/auth/verify-email?uid=fixture&token=fixture-token"));
    expect(r.headers.get("location")).toBe(`https://fixture.example.test${loginPath}?verify=ok`);
    expect(m.update).toHaveBeenCalledWith(expect.objectContaining({ data: { emailVerifiedAt: expect.any(Date), emailVerifyTokenHash: null } }));
  });
  it("yanlış token doğrulama damgası yazamaz", async () => {
    const r = await (await route("doctorium")).GET(new Request("https://fixture.example.test/api/auth/verify-email?uid=fixture&token=wrong"));
    expect(r.headers.get("location")).toContain("/doctorium/giris?verify=invalid"); expect(m.update).not.toHaveBeenCalled();
  });
  it("Doctorium dağıtımında hasta dönüşünü değiştirmez", async () => {
    const api = await route("doctorium"); m.find.mockResolvedValue({ ...user, role: "PATIENT", emailVerifiedAt: new Date() });
    const r = await api.GET(new Request("https://fixture.example.test/api/auth/verify-email?uid=fixture&token=fixture-token"));
    expect(r.headers.get("location")).toContain("/giris?verify=already"); expect(m.update).not.toHaveBeenCalled();
  });
  it("Doctorium doğrulama e-postası marka adı taşır; varsayılan AURA kalır", async () => {
    const { issueVerificationEmail } = await import("@/lib/email-verification");
    await issueVerificationEmail(user, "https://fixture.example.test", "Doctorium");
    expect(m.email).toHaveBeenLastCalledWith(expect.objectContaining({ subject: "E-posta adresinizi doğrulayın — Doctorium", text: expect.stringContaining("Doctorium hesabınızı") }));
    await issueVerificationEmail(user, "https://fixture.example.test");
    expect(m.email).toHaveBeenLastCalledWith(expect.objectContaining({ subject: "E-posta adresinizi doğrulayın — AURA" }));
  });
});
it("süresi dolmuş doğrulama Doctorium kapısına döner ve yeni token istenebilir", async () => {
  const api = await route("doctorium");
  const { hashVerifyToken } = await import("@/lib/email-verification");
  m.find.mockResolvedValue({ ...user, emailVerifyTokenHash: hashVerifyToken("fixture-token"), emailVerifySentAt: new Date(Date.now() - 25 * 60 * 60 * 1000) });
  const r = await api.GET(new Request("https://fixture.example.test/api/auth/verify-email?uid=fixture&token=fixture-token"));
  expect(r.headers.get("location")).toContain("/doctorium/giris?verify=invalid");
  expect(m.update).not.toHaveBeenCalled();
  const resend = await import("@/app/api/auth/resend-verification/route");
  await resend.POST(new Request("https://fixture.example.test/api/auth/resend-verification", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: user.email }),
  }));
  expect(m.email).toHaveBeenLastCalledWith(expect.objectContaining({ subject: "E-posta adresinizi doğrulayın — Doctorium" }));
  expect(m.update).toHaveBeenCalledWith(expect.objectContaining({ data: { emailVerifyTokenHash: expect.any(String), emailVerifySentAt: expect.any(Date) } }));
});