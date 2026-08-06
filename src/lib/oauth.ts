// M5 Kayıt — sosyal giriş (Google + Apple). İkisi de env-gated: anahtar yoksa buton "Yakında"
// (Anthropic/Gemini/Metered deseni — özellik sessizce uykuda, uygulama çalışır).
// Ek bağımlılık yok: standart OAuth 2.0 authorization-code akışı; Apple'ın JWT işleri `jose` ile
// (oturum katmanı zaten jose kullanıyor — lib/session.ts).

import { SignJWT, jwtVerify, importPKCS8, createRemoteJWKSet } from "jose";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO = "https://openidconnect.googleapis.com/v1/userinfo";

// Google ile giriş yapılandırıldı mı? (credential yoksa buton dormant.)
export function isGoogleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

// İstek origin'inden callback URI türet (yerel + Vercel origin uyumlu — Google Console'a bu eklenir).
export function googleRedirectUri(origin: string): string {
  return `${origin}/api/auth/google/callback`;
}

export function googleAuthUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH}?${params.toString()}`;
}

// Authorization code → access token → userinfo (email + ad). Hata/eksikte null.
export async function exchangeGoogleCode(code: string, redirectUri: string): Promise<{ email: string; name: string } | null> {
  try {
    const tokenRes = await fetch(GOOGLE_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) return null;
    const token = (await tokenRes.json()) as { access_token?: string };
    if (!token.access_token) return null;

    const userRes = await fetch(GOOGLE_USERINFO, { headers: { Authorization: `Bearer ${token.access_token}` } });
    if (!userRes.ok) return null;
    const u = (await userRes.json()) as { email?: string; name?: string; email_verified?: boolean | string };
    const email = typeof u.email === "string" ? u.email.trim().toLowerCase() : "";
    if (!email) return null;
    // Google e-postayı DOĞRULAMAMIŞSA reddet. Callback e-postayı hesap anahtarı olarak kullanır
    // (mevcut kullanıcı e-posta ile eşleşince parolasız giriş) → doğrulanmamış e-posta hesap ele
    // geçirmeye yol açar (gmail hep verified'dır ama Workspace/kurumsal doğrulanmamış domain false
    // dönebilir). userinfo ucu boolean döndürür; ID-token uyumu için string "true" da kabul edilir.
    if (u.email_verified !== true && u.email_verified !== "true") return null;
    const name = typeof u.name === "string" && u.name.trim() ? u.name.trim().slice(0, 120) : email.split("@")[0];
    return { email, name };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Apple ile Giriş ("Sign in with Apple") — v6.82. Google ile aynı dormant deseni, ama ÜÇ yapısal
// farkı var; bunları bilmeden dokunma:
//
//  1) CLIENT SECRET SABİT DEĞİL, İMZADIR. Apple, `.p8` özel anahtarıyla ES256 imzalanmış ve ömrü
//     ≤6 ay olan bir JWT bekler. Env'e sabit yazılsaydı 6 ayda bir sessizce ölürdü (giriş bir sabah
//     "bilinmeyen hata" verirdi) → her token takasında 5 dk ömürlü TAZE JWT üretiyoruz. Saklanan tek
//     sır .p8 anahtarının kendisi; rotasyon borcu doğmaz.
//  2) DÖNÜŞ GET DEĞİL POST'TUR. `scope=name email` istendiğinde Apple `response_mode=form_post`
//     zorunlu kılar → callback POST'tur ve state/nonce cookie'leri SameSite=Lax OLAMAZ (Lax cookie
//     cross-site POST'ta gönderilmez, akış "state uyuşmadı" ile ölür). Detay: api/auth/apple/start.
//  3) USERINFO UCU YOK. Google'da kimliği ayrı bir uçtan çekiyoruz; Apple'da kimlik ID token'ın
//     İÇİNDEDİR → imza (JWKS) + iss/aud/nonce doğrulaması burada yapılır.
const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_AUTH = `${APPLE_ISSUER}/auth/authorize`;
const APPLE_TOKEN = `${APPLE_ISSUER}/auth/token`;
const APPLE_JWKS_URL = `${APPLE_ISSUER}/auth/keys`;
// "E-postamı Gizle" adresleri. Kullanıcı gerçek adresini paylaşmadıysa buraya düşer; hesap AÇILIR
// (ürün kararı 2026-08-05) ama bu adrese posta gidebilmesi Apple'da ayrı bir DNS/SPF yapılandırması
// ister ("Sign in with Apple for Email Communication") — bkz. .env.example APPLE_* bloğu.
const APPLE_RELAY_DOMAIN = "@privaterelay.appleid.com";

// Apple ile giriş yapılandırıldı mı? Dördü de şart: eksik biri = buton dormant ("Yakında").
export function isAppleConfigured(): boolean {
  return !!(
    process.env.APPLE_CLIENT_ID &&
    process.env.APPLE_TEAM_ID &&
    process.env.APPLE_KEY_ID &&
    process.env.APPLE_PRIVATE_KEY
  );
}

// Apple Developer > Services ID > "Return URL" alanına BİREBİR bu yazılır (localhost KABUL EDİLMEZ).
export function appleRedirectUri(origin: string): string {
  return `${origin}/api/auth/apple/callback`;
}

export function appleAuthUrl(state: string, nonce: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env.APPLE_CLIENT_ID!, // Services ID (uygulamanın Bundle ID'si DEĞİL)
    redirect_uri: redirectUri,
    response_type: "code",
    response_mode: "form_post", // "name email" scope'unun bedeli: dönüş POST (bkz. üstteki not 2)
    scope: "name email",
    state,
    nonce,
  });
  return `${APPLE_AUTH}?${params.toString()}`;
}

// .p8 anahtarını STANDART PEM'e normalize et. Canlı ders (2026-08-06): kullanıcı anahtarı Vercel'e
// yapıştırdığında satır sonları kayboldu → importPKCS8 'TypeError: "pkcs8" must be PKCS#8 formatted
// string' attı ve Apple'a hiç ulaşılamadı. Yapıştırma biçimini kullanıcıya dert etmek yerine
// (find-kek "kodlama varyantı" dersinin PEM karşılığı) her varyantı kabul ediyoruz:
//   · \n kaçışlı tek satır (eski Vercel önerisi) · gerçek çok satır · CRLF (PowerShell pipe dersi)
//   · TEK SATIRA inmiş PEM (satır sonları yutulmuş) · BEGIN/END'siz salt base64 gövde · tırnaklı
// Yöntem: başlık/altlık ve tüm boşlukları at → kalan saf base64 gövdeyi 64'lük satırlarla
// standart PKCS#8 zarfına yeniden sar. Gövde bozuksa importPKCS8 yine anlamlı hata verir.
function applePrivateKeyPem(): string {
  const body = (process.env.APPLE_PRIVATE_KEY ?? "")
    .replace(/\\n/g, "\n")
    .replace(/-----(BEGIN|END)[^-]*-----/g, "")
    .replace(/["']/g, "")
    .replace(/\s+/g, "");
  const lines = body.match(/.{1,64}/g)?.join("\n") ?? "";
  return `-----BEGIN PRIVATE KEY-----\n${lines}\n-----END PRIVATE KEY-----\n`;
}

// Apple'ın beklediği client_secret: Team ID'nin imzaladığı, Services ID'yi özne yapan kısa ömürlü JWT.
export async function appleClientSecret(): Promise<string> {
  const key = await importPKCS8(applePrivateKeyPem(), "ES256");
  return await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: process.env.APPLE_KEY_ID! })
    .setIssuer(process.env.APPLE_TEAM_ID!)
    .setSubject(process.env.APPLE_CLIENT_ID!)
    .setAudience(APPLE_ISSUER)
    .setIssuedAt()
    .setExpirationTime("5m") // üst sınır 6 ay; kısa tutmak sızan secret'ın ömrünü de kısaltır
    .sign(key);
}

// JWKS istemcisi (imza anahtarlarını çeker + önbellekler). Modül ömrü boyunca tek örnek.
let appleJwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function jwks() {
  appleJwks ??= createRemoteJWKSet(new URL(APPLE_JWKS_URL));
  return appleJwks;
}

export type AppleIdentity = {
  sub: string; // Apple'ın kalıcı kullanıcı kimliği → User.appleSub (hesap eşlemesinin asıl anahtarı)
  email: string;
  isPrivateRelay: boolean;
};

// ID token → kimlik. İmza + issuer + audience jose tarafından; nonce ve e-posta kapısı elle.
export async function verifyAppleIdToken(idToken: string, nonce: string): Promise<AppleIdentity | null> {
  try {
    const { payload } = await jwtVerify(idToken, jwks(), {
      issuer: APPLE_ISSUER,
      audience: process.env.APPLE_CLIENT_ID!,
    });
    // nonce: yeniden-oynatma koruması. state CSRF'i kapatır, nonce "başka bir oturumda alınmış
    // geçerli ID token"ın buraya sokulmasını kapatır — ikisi farklı saldırıya bakar, ikisi de şart.
    if (typeof payload.nonce !== "string" || payload.nonce !== nonce) {
      console.error("[apple-auth] nonce uyuşmadı");
      return null;
    }

    const sub = typeof payload.sub === "string" ? payload.sub.trim() : "";
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    if (!sub || !email) {
      console.error(`[apple-auth] kimlik eksik: sub=${!!sub} email=${!!email}`);
      return null;
    }

    // Google tarafındaki kapının aynısı: e-posta hesap anahtarı olarak da kullanıldığı için
    // doğrulanmamış e-posta kabul edilemez (hesap ele geçirme yolu). Apple bu alanları bazen
    // boolean, bazen string ("true") döndürür — ikisi de kabul, gerisi RED.
    const verified = payload.email_verified;
    if (verified !== true && verified !== "true") {
      console.error("[apple-auth] email_verified kapısı reddetti");
      return null;
    }

    const relayClaim = payload.is_private_email;
    const isPrivateRelay =
      relayClaim === true || relayClaim === "true" || email.endsWith(APPLE_RELAY_DOMAIN);
    return { sub, email, isPrivateRelay };
  } catch (e) {
    // jwtVerify buraya düşer: imza/iss/aud hatası sınıf adıyla ayrışır (JWTClaimValidationFailed vb.).
    console.error(`[apple-auth] ID token doğrulaması düştü: ${e instanceof Error ? `${e.name}: ${e.message}` : "?"}`);
    return null;
  }
}

// Authorization code → token takası → doğrulanmış kimlik. Hata/eksikte null (çağıran ?oauth=error'a döner).
// Teşhis logları (2026-08-06): kullanıcının canlı denemesi sessizce düşünce hangi aşamanın öldüğü
// görülemedi → aşama-bazlı console.error. ASLA-LOGLAMA kuralına (lib/alerts başlığı) uygun:
// yalnız aşama adı + Apple'ın hata KODU + hata sınıfı; e-posta/sub/token İÇERİĞİ loglanmaz.
export async function exchangeAppleCode(
  code: string,
  redirectUri: string,
  nonce: string,
): Promise<AppleIdentity | null> {
  try {
    const res = await fetch(APPLE_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.APPLE_CLIENT_ID!,
        client_secret: await appleClientSecret(),
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!res.ok) {
      // Apple hata gövdesi {error:"invalid_client"|"invalid_grant"|...} — kod PII değildir, sebeptir.
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      console.error(`[apple-auth] token takası HTTP ${res.status} error=${body.error ?? "?"}`);
      return null;
    }
    const token = (await res.json()) as { id_token?: string };
    if (!token.id_token) {
      console.error("[apple-auth] token yanıtında id_token yok");
      return null;
    }
    return await verifyAppleIdToken(token.id_token, nonce);
  } catch (e) {
    // appleClientSecret (importPKCS8 dahil) buraya düşer — .p8 biçim sorunu en olası aday.
    console.error(`[apple-auth] takas istisnası: ${e instanceof Error ? `${e.name}: ${e.message}` : "?"}`);
    return null;
  }
}

// Görünen ad. ⚠️ Apple adı YALNIZ İLK yetkilendirmede gönderir (callback POST gövdesindeki `user`
// alanı, JSON string). İkinci girişte alan YOKTUR — o an yakalanmazsa bir daha alınamaz.
export function appleDisplayName(userField: string | null, id: AppleIdentity): string {
  if (userField) {
    try {
      const parsed = JSON.parse(userField) as { name?: { firstName?: string; lastName?: string } };
      const full = [parsed.name?.firstName, parsed.name?.lastName].filter(Boolean).join(" ").trim();
      if (full) return full.slice(0, 120);
    } catch {
      // Bozuk JSON akışı düşürmez — ada aşağıdaki yedekten karar verilir.
    }
  }
  // Relay adresinin yerel kısmı rastgele bir dizidir ("a1b2c3d4@privaterelay...") → isim yerine geçmez.
  if (id.isPrivateRelay) return "Apple kullanıcısı";
  return id.email.split("@")[0].slice(0, 120);
}
