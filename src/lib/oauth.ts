// M5 Kayıt — Google OAuth (env-gated; GOOGLE_CLIENT_ID/SECRET yoksa DORMANT → buton "Yakında").
// Ek bağımlılık yok: standart OAuth 2.0 authorization-code akışı, fetch + Google uçları.
// Anthropic/Gemini/Metered deseni gibi: anahtar yoksa özellik sessizce uykuda, uygulama çalışır.

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO = "https://openidconnect.googleapis.com/v1/userinfo";

// Google ile giriş yapılandırıldı mı? (credential yoksa buton dormant.)
export function isGoogleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

// Apple "Sign in with Apple" — şimdilik PARKED (Apple Developer hesabı + Service ID + JWT client
// secret gerektirir). Yapılandırma noktası ileride buraya eklenecek; şu an her zaman false.
export function isAppleConfigured(): boolean {
  return false;
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
    const u = (await userRes.json()) as { email?: string; name?: string };
    const email = typeof u.email === "string" ? u.email.trim().toLowerCase() : "";
    if (!email) return null;
    const name = typeof u.name === "string" && u.name.trim() ? u.name.trim().slice(0, 120) : email.split("@")[0];
    return { email, name };
  } catch {
    return null;
  }
}
