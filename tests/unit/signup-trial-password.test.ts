import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const m = vi.hoisted(() => ({
  find: vi.fn(), update: vi.fn(), hash: vi.fn(), session: vi.fn(), create: vi.fn(),
  verify: vi.fn(), legacy: vi.fn(), existingMail: vi.fn(), ready: vi.fn(), enabled: vi.fn(), limit: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: { user: { findUnique: m.find, updateMany: m.update } } }));
vi.mock("@/lib/auth", () => ({ hashPassword: m.hash, createSession: m.session }));
vi.mock("@/lib/doctor-signup", () => ({ createDoctorAccount: m.create }));
vi.mock("@/lib/email-verification", () => ({ issueVerificationEmail: m.verify }));
vi.mock("@/lib/doctorium-consent", () => ({ gateConsentVersion: vi.fn(async () => 0) }));
vi.mock("@/lib/roles", () => ({ brandRoleHome: () => "/doktor/doctorium" }));
vi.mock("@/lib/procedures", () => ({ BRANCH_LABELS: { kardiyoloji: "Kardiyoloji" } }));
vi.mock("@/lib/cities", () => ({ isAllowedCity: (city: string) => city === "Ankara" }));
vi.mock("@/lib/doctorium-trial-flag", () => ({ isTrialEnabled: m.enabled }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: m.limit, clientIp: () => "fixture", tooMany: () => new Response(null, { status: 429 }) }));
vi.mock("@/lib/login-link", () => ({
  loginLinkChannelReady: m.ready, loginLinkCooldownActive: () => false,
  canUseLoginLink: (u: { passwordSetAt: Date | null; role: string }) => !u.passwordSetAt && u.role === "DOCTOR",
  issueLoginLinkEmail: m.legacy, issueExistingAccountEmail: m.existingMail,
}));
import { POST } from "@/app/api/auth/signup-trial/route";
const body = { name: "Fixture Doktor", email: "fixture@example.test", password: "fixture-only-password", branch: "Kardiyoloji", city: "Ankara" };
const post = (b: unknown = body) => POST(new Request("https://doctorium.example.test/api/auth/signup-trial", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b),
}));
const user = { id: "fixture", name: body.name, email: body.email, role: "DOCTOR", passwordSetAt: new Date(), deletedAt: null, loginTokenSentAt: null };
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("VERCEL_ENV", "");
  m.find.mockResolvedValue(null); m.create.mockResolvedValue(user); m.hash.mockResolvedValue("hashed-fixture");
  m.ready.mockReturnValue(true); m.enabled.mockReturnValue(true); m.limit.mockResolvedValue({ ok: true });
});
afterEach(() => vi.unstubAllEnvs());

describe("Doctorium deneme kaydı — parola + e-posta doğrulaması", () => {
  it("kullanıcı parolasını hash'ler, doğrulama gönderir; doğrulamadan oturum açmaz", async () => {
    const r = await post();
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, sent: true, needsVerification: true });
    expect(m.hash).toHaveBeenCalledWith(body.password);
    expect(m.create).toHaveBeenCalledWith(expect.objectContaining({ passwordHash: "hashed-fixture", passwordSet: true }));
    expect(m.verify).toHaveBeenCalledWith(expect.objectContaining({ id: "fixture" }), "https://doctorium.example.test", "Doctorium");
    expect(m.session).not.toHaveBeenCalled(); expect(m.update).not.toHaveBeenCalled(); expect(m.legacy).not.toHaveBeenCalled();
  });
  it.each([undefined, "", "1234567"])("eksik/kısa parola hesabı veya e-postayı değiştirmez (%s)", async (password) => {
    expect((await post({ ...body, password })).status).toBe(400);
    expect(m.find).not.toHaveBeenCalled(); expect(m.create).not.toHaveBeenCalled(); expect(m.verify).not.toHaveBeenCalled();
  });
  it("üretimde e-posta kanalı kapalıysa hesap ve oturum oluşturmaz", async () => {
    m.ready.mockReturnValue(false);
    expect((await post()).status).toBe(503);
    expect(m.create).not.toHaveBeenCalled(); expect(m.session).not.toHaveBeenCalled();
  });
  it("mevcut parolalı hesabın parolasını değiştirmez; yeni hesapla aynı yanıtı verir", async () => {
    const fresh = await (await post()).json(); vi.clearAllMocks(); m.find.mockResolvedValue(user);
    expect(await (await post()).json()).toEqual(fresh);
    expect(m.hash).not.toHaveBeenCalled(); expect(m.create).not.toHaveBeenCalled(); expect(m.update).not.toHaveBeenCalled();
    expect(m.existingMail).toHaveBeenCalled(); expect(m.session).not.toHaveBeenCalled();
  });
  it("eski parolasız hesabın bağlantı yolunu korur; gönderilen parola hesabı devralamaz", async () => {
    m.find.mockResolvedValue({ ...user, passwordSetAt: null });
    expect((await post()).status).toBe(200);
    expect(m.legacy).toHaveBeenCalled(); expect(m.hash).not.toHaveBeenCalled(); expect(m.create).not.toHaveBeenCalled(); expect(m.session).not.toHaveBeenCalled();
  });
  it("silinmiş hesaba e-posta göndermez veya oturum açmaz", async () => {
    m.find.mockResolvedValue({ ...user, deletedAt: new Date() });
    expect((await post()).status).toBe(200);
    expect(m.legacy).not.toHaveBeenCalled(); expect(m.existingMail).not.toHaveBeenCalled(); expect(m.session).not.toHaveBeenCalled();
  });
  it("geliştirme kısayolu mevcut hesabın kimliğini kanıtsız doğrulayamaz", async () => {
    vi.stubEnv("NODE_ENV", "development"); m.ready.mockReturnValue(false); m.find.mockResolvedValue({ ...user, passwordSetAt: null });
    await post(); expect(m.update).not.toHaveBeenCalled(); expect(m.session).not.toHaveBeenCalled();
  });
  it("bayrak veya rate limit kapalıyken hesap oluşturmaz", async () => {
    m.enabled.mockReturnValue(false); expect((await post()).status).toBe(404);
    m.enabled.mockReturnValue(true); m.limit.mockResolvedValue({ ok: false }); expect((await post()).status).toBe(429);
    expect(m.create).not.toHaveBeenCalled();
  });
});
it("VERCEL_ENV üretimse geliştirme bypass'ı açılamaz", async () => {
  vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("VERCEL_ENV", "production"); m.ready.mockReturnValue(false);
  expect((await post()).status).toBe(503); expect(m.create).not.toHaveBeenCalled(); expect(m.session).not.toHaveBeenCalled();
});