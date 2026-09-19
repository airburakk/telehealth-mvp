// Birim — lib/signup-email-gate.ts (kontrol raporu 2026-09-17 K08): "doğrulanmış damgala" kolaylığı yalnız geliştirme/test;
// üretimde sağlayıcı yoksa kayıt 503 + alarm, hesap açılmaz. Rota provası: signup (doktor) kapıyı hesap yazımından ÖNCE koşar.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/alerts", () => ({ sendAlert: vi.fn(async () => ({ logged: true, emailed: false, suppressed: null })) }));
// signup rotasının ağır bağımlılıkları — kapı hesap yazımından ÖNCE koştuğu için hiçbiri çağrılmamalı.
vi.mock("@/lib/db", () => ({ db: { user: { findUnique: vi.fn() } } }));
vi.mock("@/lib/auth", () => ({ hashPassword: vi.fn(), createSession: vi.fn() }));
vi.mock("@/lib/doctorium-consent", () => ({ gateConsentVersion: vi.fn() }));
vi.mock("@/lib/doctor-signup", () => ({ createDoctorAccount: vi.fn() }));
vi.mock("@/lib/email-verification", () => ({ issueVerificationEmail: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(async () => ({ ok: true, retryAfter: 0 })), clientIp: () => "1.1.1.1", tooMany: vi.fn() }));

import { unverifiedSignupAllowed, signupEmailBlocked } from "@/lib/signup-email-gate";
import { sendAlert } from "@/lib/alerts";
import { createDoctorAccount } from "@/lib/doctor-signup";
import { POST as signupDoctor } from "@/app/api/auth/signup/route";

type Env = Record<string, string | undefined>;
const env = (o: Env): NodeJS.ProcessEnv => o as NodeJS.ProcessEnv;

describe("unverifiedSignupAllowed — ortam matrisi", () => {
  it("sağlayıcı varsa bypass'a GEREK yok → false (her ortamda)", () => {
    expect(unverifiedSignupAllowed(env({ RESEND_API_KEY: "re_x", NODE_ENV: "development" }))).toBe(false);
    expect(unverifiedSignupAllowed(env({ RESEND_API_KEY: "re_x", NODE_ENV: "production", ALLOW_UNVERIFIED_SIGNUP: "1" }))).toBe(false);
  });
  it("geliştirme/test (production değil) → true (bugünkü dormant kolaylık sürer)", () => {
    expect(unverifiedSignupAllowed(env({ NODE_ENV: "development" }))).toBe(true);
    expect(unverifiedSignupAllowed(env({ NODE_ENV: "test" }))).toBe(true);
    expect(unverifiedSignupAllowed(env({}))).toBe(true);
  });
  it("üretim (NODE_ENV ya da VERCEL_ENV production) → false; yalnız açık bayrakla true", () => {
    expect(unverifiedSignupAllowed(env({ NODE_ENV: "production" }))).toBe(false);
    expect(unverifiedSignupAllowed(env({ NODE_ENV: "development", VERCEL_ENV: "production" }))).toBe(false);
    expect(unverifiedSignupAllowed(env({ NODE_ENV: "production", ALLOW_UNVERIFIED_SIGNUP: "1" }))).toBe(true);
    expect(unverifiedSignupAllowed(env({ NODE_ENV: "production", ALLOW_UNVERIFIED_SIGNUP: "true" }))).toBe(false); // yalnız "1"
  });
});

describe("signupEmailBlocked — 503 + alarm", () => {
  beforeEach(() => { vi.mocked(sendAlert).mockClear(); });
  afterEach(() => { vi.unstubAllEnvs(); });

  it("üretim + sağlayıcı yok → 503 EMAIL_PROVIDER_MISSING + alarm (rota adıyla)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("ALLOW_UNVERIFIED_SIGNUP", "");
    const r = signupEmailBlocked("signup");
    expect(r?.status).toBe(503);
    expect((await r!.json()).code).toBe("EMAIL_PROVIDER_MISSING");
    expect(vi.mocked(sendAlert).mock.calls[0][0]).toBe("email-provider-missing");
    expect(vi.mocked(sendAlert).mock.calls[0][2]).toBe("signup");
  });

  it("geliştirme + sağlayıcı yok → null (kayıt sürer); üretim + sağlayıcı var → null; üretim + bayrak → null, alarm yok", () => {
    vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("RESEND_API_KEY", ""); vi.stubEnv("VERCEL_ENV", "");
    expect(signupEmailBlocked("signup")).toBeNull();
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("RESEND_API_KEY", "re_x");
    expect(signupEmailBlocked("signup")).toBeNull();
    vi.stubEnv("RESEND_API_KEY", ""); vi.stubEnv("ALLOW_UNVERIFIED_SIGNUP", "1");
    expect(signupEmailBlocked("signup")).toBeNull();
    expect(sendAlert).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/signup — kapı hesap yazımından ÖNCE", () => {
  afterEach(() => { vi.unstubAllEnvs(); });

  it("üretim + sağlayıcı yok → 503; createDoctorAccount ÇAĞRILMAZ (doğrulanmamış hesap açılmaz)", async () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("RESEND_API_KEY", ""); vi.stubEnv("ALLOW_UNVERIFIED_SIGNUP", ""); vi.stubEnv("VERCEL_ENV", "");
    const r = await signupDoctor(new Request("http://localhost/api/auth/signup", { method: "POST", body: "{}" }));
    expect(r.status).toBe(503);
    expect(createDoctorAccount).not.toHaveBeenCalled();
  });
});
