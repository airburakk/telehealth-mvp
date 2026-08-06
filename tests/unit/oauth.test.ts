// Birim testleri — lib/oauth.ts.
//  · Google: exchangeGoogleCode email_verified kapısı.
//  · Apple (v6.82): client secret JWT'sinin claim'leri + ID token doğrulama kapıları. Apple akışı
//    localhost'ta DENENEMEZ (Apple http/localhost Return URL kabul etmez) → tarayıcısız güvence
//    yalnız burasıdır; kapıları gevşetmeden önce iki kez düşün.
// Google userinfo doğrulanmamış e-posta döndürürse null (callback → /kayit?oauth=error);
// callback e-postayı hesap anahtarı olarak kullandığından doğrulanmamış e-posta hesap ele geçirmeye yol açar.
import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from "vitest";
import { generateKeyPair, exportPKCS8, exportJWK, SignJWT, decodeJwt, decodeProtectedHeader } from "jose";
import {
  exchangeGoogleCode,
  appleClientSecret,
  verifyAppleIdToken,
  exchangeAppleCode,
  appleDisplayName,
  isAppleConfigured,
} from "@/lib/oauth";

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

// ─────────────────────────────────────────────────────────────────────────────
// Apple ile Giriş (v6.82)
const APPLE_CLIENT_ID = "health.aura.web"; // Services ID
const APPLE_TEAM_ID = "TEAM123456";
const APPLE_KEY_ID = "KEYABCDEF1";
const SUB = "001234.fedcba9876543210.1234"; // Apple'ın kalıcı kullanıcı kimliği biçimi

let privatePem = "";
let signKey: CryptoKey;
let publicJwk: Record<string, unknown> = {};

beforeAll(async () => {
  // Gerçek ES256 çifti: Apple'ın .p8 anahtarının yerine geçer (imza yolu gerçekten koşulur).
  const { privateKey, publicKey } = await generateKeyPair("ES256", { extractable: true });
  signKey = privateKey as CryptoKey;
  privatePem = await exportPKCS8(privateKey);
  publicJwk = { ...(await exportJWK(publicKey)), kid: APPLE_KEY_ID, alg: "ES256", use: "sig" };
});

// Apple'ın döndüreceği ID token'ı taklit et (varsayılan: geçerli, doğrulanmış, nonce=n1).
async function makeIdToken(over: Record<string, unknown> = {}, aud = APPLE_CLIENT_ID) {
  return await new SignJWT({
    sub: SUB,
    email: "hasta@ornek.com",
    email_verified: true,
    nonce: "n1",
    ...over,
  })
    .setProtectedHeader({ alg: "ES256", kid: APPLE_KEY_ID })
    .setIssuer("https://appleid.apple.com")
    .setAudience(aud)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(signKey);
}

// JWKS ucu + token takası ucu tek mock'ta (jose imza anahtarını kendisi çeker).
function stubAppleFetch(opts: { idToken?: string; tokenOk?: boolean } = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => {
      const u = String(input);
      if (u.includes("/auth/keys")) {
        return { ok: true, status: 200, json: async () => ({ keys: [publicJwk] }) } as never;
      }
      if (u.includes("/auth/token")) {
        return (opts.tokenOk === false
          ? { ok: false, status: 400, json: async () => ({}) }
          : { ok: true, status: 200, json: async () => ({ id_token: opts.idToken }) }) as never;
      }
      throw new Error(`beklenmeyen fetch: ${u}`);
    }),
  );
}

describe("Apple — client secret JWT (ES256)", () => {
  beforeEach(() => {
    vi.stubEnv("APPLE_CLIENT_ID", APPLE_CLIENT_ID);
    vi.stubEnv("APPLE_TEAM_ID", APPLE_TEAM_ID);
    vi.stubEnv("APPLE_KEY_ID", APPLE_KEY_ID);
    vi.stubEnv("APPLE_PRIVATE_KEY", privatePem);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("Apple'ın beklediği claim'leri taşır (iss=Team, sub=Services ID, aud=appleid, kid başlıkta)", async () => {
    const jwt = await appleClientSecret();
    expect(decodeProtectedHeader(jwt)).toMatchObject({ alg: "ES256", kid: APPLE_KEY_ID });
    const p = decodeJwt(jwt);
    expect(p.iss).toBe(APPLE_TEAM_ID);
    expect(p.sub).toBe(APPLE_CLIENT_ID);
    expect(p.aud).toBe("https://appleid.apple.com");
  });

  it("kısa ömürlüdür (5 dk) — Apple üst sınırı 6 ay, sabit secret saklamıyoruz", async () => {
    const p = decodeJwt(await appleClientSecret());
    expect((p.exp ?? 0) - (p.iat ?? 0)).toBe(300);
  });

  it("env'e CRLF bulaşmış .p8 anahtarı da çalışır (PowerShell pipe dersi)", async () => {
    vi.stubEnv("APPLE_PRIVATE_KEY", privatePem.replace(/\n/g, "\r\n"));
    await expect(appleClientSecret()).resolves.toBeTypeOf("string");
  });

  it("satır sonları \\n olarak kaçışlanmış tek satırlık anahtar da çalışır (Vercel env biçimi)", async () => {
    vi.stubEnv("APPLE_PRIVATE_KEY", privatePem.replace(/\n/g, "\\n"));
    await expect(appleClientSecret()).resolves.toBeTypeOf("string");
  });

  // Canlı ders (2026-08-06): panele yapıştırırken satır sonları YUTULDU → importPKCS8
  // 'must be PKCS#8 formatted string' attı. Normalizasyon bu üç bozuk biçimi de kabul eder.
  it("satır sonları tamamen yutulmuş TEK SATIR PEM de çalışır (canlı yapıştırma dersi)", async () => {
    vi.stubEnv("APPLE_PRIVATE_KEY", privatePem.replace(/\n/g, ""));
    await expect(appleClientSecret()).resolves.toBeTypeOf("string");
  });

  it("BEGIN/END'siz salt base64 gövde de çalışır", async () => {
    const body = privatePem.replace(/-----(BEGIN|END)[^-]*-----/g, "").replace(/\s+/g, "");
    vi.stubEnv("APPLE_PRIVATE_KEY", body);
    await expect(appleClientSecret()).resolves.toBeTypeOf("string");
  });

  it("tırnak içinde yapıştırılmış anahtar da çalışır", async () => {
    vi.stubEnv("APPLE_PRIVATE_KEY", `"${privatePem}"`);
    await expect(appleClientSecret()).resolves.toBeTypeOf("string");
  });

  it("isAppleConfigured: dört anahtardan biri eksikse DORMANT", () => {
    expect(isAppleConfigured()).toBe(true);
    vi.stubEnv("APPLE_KEY_ID", "");
    expect(isAppleConfigured()).toBe(false);
  });
});

describe("Apple — ID token doğrulama kapıları", () => {
  beforeEach(() => {
    vi.stubEnv("APPLE_CLIENT_ID", APPLE_CLIENT_ID);
    vi.stubEnv("APPLE_TEAM_ID", APPLE_TEAM_ID);
    vi.stubEnv("APPLE_KEY_ID", APPLE_KEY_ID);
    vi.stubEnv("APPLE_PRIVATE_KEY", privatePem);
    stubAppleFetch();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("geçerli token → sub + küçük harfli e-posta", async () => {
    const t = await makeIdToken({ email: "Hasta@Ornek.com" });
    expect(await verifyAppleIdToken(t, "n1")).toEqual({
      sub: SUB,
      email: "hasta@ornek.com",
      isPrivateRelay: false,
    });
  });

  it("email_verified=false → null (Google kapısının Apple eşleniği)", async () => {
    expect(await verifyAppleIdToken(await makeIdToken({ email_verified: false }), "n1")).toBeNull();
  });

  it("email_verified string 'true' → kabul (Apple bu alanı string döndürebilir)", async () => {
    expect(await verifyAppleIdToken(await makeIdToken({ email_verified: "true" }), "n1")).not.toBeNull();
  });

  it("nonce uyuşmuyorsa → null (yeniden-oynatma koruması)", async () => {
    expect(await verifyAppleIdToken(await makeIdToken(), "baska-nonce")).toBeNull();
  });

  it("audience başka bir Services ID ise → null", async () => {
    expect(await verifyAppleIdToken(await makeIdToken({}, "baska.servis.id"), "n1")).toBeNull();
  });

  it("e-posta yoksa → null (e-posta hesap anahtarı; sub tek başına yetmez)", async () => {
    expect(await verifyAppleIdToken(await makeIdToken({ email: undefined }), "n1")).toBeNull();
  });

  it("is_private_email → relay işaretlenir", async () => {
    const r = await verifyAppleIdToken(await makeIdToken({ is_private_email: "true" }), "n1");
    expect(r?.isPrivateRelay).toBe(true);
  });

  it("claim gelmese bile relay ALAN ADI yakalanır (savunmacı yedek)", async () => {
    const r = await verifyAppleIdToken(await makeIdToken({ email: "a1b2c3@privaterelay.appleid.com" }), "n1");
    expect(r?.isPrivateRelay).toBe(true);
  });

  it("exchangeAppleCode: token takası başarılıysa kimlik döner", async () => {
    stubAppleFetch({ idToken: await makeIdToken() });
    expect(await exchangeAppleCode("code", "https://x/api/auth/apple/callback", "n1")).toMatchObject({ sub: SUB });
  });

  it("exchangeAppleCode: token ucu hata verirse → null", async () => {
    stubAppleFetch({ tokenOk: false });
    expect(await exchangeAppleCode("code", "https://x/api/auth/apple/callback", "n1")).toBeNull();
  });
});

describe("Apple — görünen ad", () => {
  const normal = { sub: SUB, email: "ayse@ornek.com", isPrivateRelay: false };
  const relay = { sub: SUB, email: "a1b2c3@privaterelay.appleid.com", isPrivateRelay: true };

  it("ilk yetkilendirmedeki `user` alanından ad + soyad", () => {
    const u = JSON.stringify({ name: { firstName: "Ayşe", lastName: "Yılmaz" } });
    expect(appleDisplayName(u, normal)).toBe("Ayşe Yılmaz");
  });

  it("`user` yoksa (ikinci giriş) e-postanın yerel kısmı", () => {
    expect(appleDisplayName(null, normal)).toBe("ayse");
  });

  it("relay adresinde yerel kısım rastgeledir → jenerik ad", () => {
    expect(appleDisplayName(null, relay)).toBe("Apple kullanıcısı");
  });

  it("bozuk JSON akışı düşürmez, yedeğe düşer", () => {
    expect(appleDisplayName("{bozuk", normal)).toBe("ayse");
  });
});
