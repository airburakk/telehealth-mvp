// Birim testleri — lib/oauth.ts exchangeGoogleCode: email_verified kapısı.
// Google userinfo doğrulanmamış e-posta döndürürse null (callback → /kayit?oauth=error);
// callback e-postayı hesap anahtarı olarak kullandığından doğrulanmamış e-posta hesap ele geçirmeye yol açar.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { exchangeGoogleCode } from "@/lib/oauth";

const TOKEN_OK = { ok: true, json: async () => ({ access_token: "at" }) };

describe("exchangeGoogleCode — email_verified kapısı", () => {
  beforeEach(() => {
    // GOOGLE_CLIENT_ID/SECRET exchangeGoogleCode'da body'ye konur (! ile); tanımlı olsun.
    vi.stubEnv("GOOGLE_CLIENT_ID", "cid");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "csecret");
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  function mockUserinfo(body: Record<string, unknown>) {
    vi.mocked(fetch)
      .mockResolvedValueOnce(TOKEN_OK as never) // token takası
      .mockResolvedValueOnce({ ok: true, json: async () => body } as never); // userinfo
  }

  it("email_verified=true → {email,name} döner (e-posta küçük harfe indirilir)", async () => {
    mockUserinfo({ email: "Dr@Clinic.com", name: "Dr X", email_verified: true });
    expect(await exchangeGoogleCode("code", "uri")).toEqual({ email: "dr@clinic.com", name: "Dr X" });
  });

  it("email_verified=false → null (doğrulanmamış e-posta reddi)", async () => {
    mockUserinfo({ email: "spoof@corp.com", name: "X", email_verified: false });
    expect(await exchangeGoogleCode("code", "uri")).toBeNull();
  });

  it("email_verified eksik → null (varsayılan reddet)", async () => {
    mockUserinfo({ email: "x@corp.com", name: "X" });
    expect(await exchangeGoogleCode("code", "uri")).toBeNull();
  });

  it("email_verified string 'true' → kabul (ID-token/defansif uyum)", async () => {
    mockUserinfo({ email: "x@corp.com", name: "X", email_verified: "true" });
    expect(await exchangeGoogleCode("code", "uri")).not.toBeNull();
  });
});
